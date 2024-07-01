const { openai } = require("./openai");
const {
  getUserMemory,
  getAllMemories,
  storeUserMemory,
  getRelevantMemories,
  storeRobotMessage,
} = require("./remember.js");
const {
  createTodo,
  deleteTodo,
  updateTodo,
} = require("../capabilities/supabasetodo.js");
const { Chance } = require("chance");
const chance = new Chance();
const vision = require("./vision.js");
const logger = require("../src/logger.js")("memory");
const llmHelpers = require("../helpers-llm");

// Configuration flags
const DISABLE_MEMORIES = true; // Set to false to enable memory storage
const DISABLE_TASK_ANALYSIS = true; // Set to false to enable task analysis
const DISABLE_REMEMBER_COMPLETIONS = true; // Set to false to enable remember completions

// Initialize prompts and config
let PROMPT_REMEMBER,
  PROMPT_CAPABILITY_REMEMBER,
  PROMPT_REMEMBER_INTRO,
  REMEMBER_MODEL;

// Main module
module.exports = {
  logInteraction: async (
    prompt,
    response,
    options,
    conversationHistory,
    isCapability,
    capabilityName
  ) => {
    // Initialize prompts and config if not already done
    if (!PROMPT_REMEMBER) {
      const prompts = await getPromptsFromSupabase();
      PROMPT_REMEMBER = prompts.PROMPT_REMEMBER;
      PROMPT_CAPABILITY_REMEMBER = prompts.PROMPT_CAPABILITY_REMEMBER;
      PROMPT_REMEMBER_INTRO = prompts.PROMPT_REMEMBER_INTRO;

      const config = await getConfigFromSupabase();
      REMEMBER_MODEL = config.REMEMBER_MODEL;
    }

    // The main logInteraction function
    async function logInteraction(
      prompt,
      response,
      { username = "", channel = "", guild = "", related_message_id = "" },
      conversationHistory = [],
      isCapability = false,
      capabilityName = ""
    ) {
      logger.info(`Trying to log interaction for ${username} in ${channel}`);

      if (!prompt || !response || !conversationHistory) {
        logger.error(
          `Missing required parameters: ${JSON.stringify({
            prompt,
            response,
            conversationHistory,
          })}`
        );
        return "Error: Missing required parameters";
      }

      // Validate input parameters
      const requiredParams = [
        "prompt",
        "response",
        "username",
        "channel",
        "guild",
        "related_message_id",
      ];
      const missingParams = requiredParams.filter((param) => !eval(param));
      if (missingParams.length > 0) {
        const errorMessage = `logInteraction error: Missing required parameters: ${missingParams.join(
          ", "
        )}`;
        logger.error(errorMessage);
        return errorMessage;
      }

      // Gather memories
      const userMemoryCount = chance.integer({ min: 4, max: 24 });
      const userMemories = await getUserMemory(username, userMemoryCount);
      const generalMemories = await getAllMemories(userMemoryCount);
      const relevantMemories = isCapability
        ? await getRelevantMemories(capabilityName)
        : await getRelevantMemories(prompt, userMemoryCount);

      const memories = [
        ...userMemories,
        ...generalMemories,
        ...relevantMemories,
      ];
      const memoryMessages = memories.map((memory) => ({
        role: "system",
        content: `${memory.created_at}: ${memory.value}`,
      }));

      logger.info(`Memories gathered, ${memories.length} total`);

      // Process response (handle images if present)
      const processedResponse = await processResponse(response);
      logger.info(`Processed response: ${JSON.stringify(processedResponse)}`);
      logger.info(`Response processed, ${processedResponse.length} characters`);

      // store the robot message response
      await storeRobotMessage(
        { username, channel, conversation_id: channel, related_message_id },
        processedResponse
      );

      let rememberText = "";
      if (!DISABLE_REMEMBER_COMPLETIONS) {
        try {
          // Generate remember completion
          const rememberCompletion = await generateRememberCompletion(
            isCapability,
            memoryMessages,
            conversationHistory,
            prompt,
            processedResponse,
            capabilityName
          );
          rememberText = rememberCompletion.content;
        } catch (error) {
          logger.error(`Error generating remember completion: ${error}`);
          return error;
        }

        // Store user memory if valid and memories are enabled
        if (
          rememberText &&
          rememberText !== "✨" &&
          rememberText.length > 0 &&
          !DISABLE_MEMORIES
        ) {
          logger.info(`Storing user memory for ${username}`);
          await storeUserMemory(
            { username, channel, conversation_id: channel, related_message_id },
            rememberText
          );
        }
      } else {
        logger.info("Remember completions are disabled");
      }

      // Analyze and execute tasks if enabled
      if (!DISABLE_TASK_ANALYSIS) {
        await analyzeAndExecuteTasks(memoryMessages, conversationHistory);
      } else {
        logger.info("Task analysis is disabled");
      }

      return rememberText;
    }

    // Helper function to process response (handle images)
    async function processResponse(response) {
      if (!response) {
        logger.error("No response provided to processResponse");
        return null;
      }

      let content;

      if (typeof response === "string") {
        content = response;
      } else if (typeof response === "object" && response.content) {
        content = response.content;
      } else {
        logger.error("Invalid response format provided to processResponse");
        return null;
      }

      if (response.image) {
        const base64Image = response.image.split(";base64,").pop();
        vision.setImageBase64(base64Image);
        const imageDescription = await vision.fetchImageDescription();
        content = `${content}\n\nDescription of user-provided image: ${imageDescription}`;
      }

      return content;
    }

    // Generate remember completion using LLM
    async function generateRememberCompletion(
      isCapability,
      memoryMessages,
      conversationHistory,
      prompt,
      response,
      capabilityName
    ) {
      const messages = [
        ...memoryMessages,
        ...conversationHistory,
        {
          role: "system",
          content: "Take a deep breath and take things step by step.",
        },
        ...(isCapability
          ? [
              {
                role: "system",
                content: `You previously ran the capability: ${capabilityName} and got the response: ${response}`,
              },
            ]
          : []),
        { role: "user", content: prompt },
        { role: "assistant", content: response },
        { role: "system", content: PROMPT_REMEMBER_INTRO },
        {
          role: "user",
          content: isCapability ? PROMPT_CAPABILITY_REMEMBER : PROMPT_REMEMBER,
        },
      ];

      return await llmHelpers.createCompletion({
        model: REMEMBER_MODEL,
        messages: messages,
        presencePenalty: 0.1,
        maxTokens: 256,
      });
    }

    // Analyze conversation for tasks and execute them
    async function analyzeAndExecuteTasks(memoryMessages, conversationHistory) {
      const taskAnalysisMessages = [
        ...memoryMessages,
        ...conversationHistory,
        {
          role: "system",
          content: `Analyze the previous messages for any content that could be a task or todo. If found, please add or modify the todo list using these capabilities:
          - todo:createTodo(name, description)
          - todo:deleteTodo(todoId)
          - todo:updateTodo(todoId, updates)`,
        },
      ];

      logger.info(
        `Analyzing tasks with ${taskAnalysisMessages.length} messages`
      );

      const taskAnalysisCompletion = await llmHelpers.createCompletion({
        model: REMEMBER_MODEL,
        messages: taskAnalysisMessages,
        presencePenalty: -0.1,
        maxTokens: 256,
      });

      const taskAnalysisText = taskAnalysisCompletion.content;
      logger.info(`Task analysis text: ${taskAnalysisText}`);

      // Extract and execute todo actions
      const todoActions = extractTodoActions(taskAnalysisText);
      const results = await executeTodoActions(todoActions);

      logger.info(`Tasks analyzed and executed: ${results.length} total`);
      return JSON.stringify(results);
    }

    // Helper function to extract todo actions from analysis text
    function extractTodoActions(text) {
      const createTodoRegex = /todo:createTodo\((.*?),(.*?)\)/g;
      const deleteTodoRegex = /todo:deleteTodo\((.*?)\)/g;
      const updateTodoRegex = /todo:updateTodo\((.*?),(.*?)\)/g;

      return {
        create: Array.from(text.matchAll(createTodoRegex)).map((match) => ({
          name: match[1].trim(),
          description: match[2].trim(),
        })),
        delete: Array.from(text.matchAll(deleteTodoRegex)).map((match) =>
          match[1].trim()
        ),
        update: Array.from(text.matchAll(updateTodoRegex)).map((match) => ({
          id: match[1].trim(),
          updates: match[2].trim(),
        })),
      };
    }

    // Helper function to execute todo actions
    async function executeTodoActions(actions) {
      const promises = [
        ...actions.create.map((todo) =>
          createTodo(todo.name, todo.description)
        ),
        ...actions.delete.map((todoId) => deleteTodo(todoId)),
        ...actions.update.map((todo) => updateTodo(todo.id, todo.updates)),
      ];

      return await Promise.all(promises);
    }

    // Call the main function and return its result
    return logInteraction(
      prompt,
      response,
      options,
      conversationHistory,
      isCapability,
      capabilityName
    );
  },
};
