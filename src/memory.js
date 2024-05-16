const { openai } = require("./openai");
const {
  getUserMemory,
  getAllMemories,
  storeUserMemory,
  getRelevantMemories,
} = require("./remember.js");
const {
  createTodo,
  deleteTodo,
  updateTodo,
} = require("../capabilities/supabasetodo.js");
const chance = require("chance").Chance();
const vision = require("./vision.js");
const logger = require("../src/logger.js")("memory");
// const preambleLogger = require("../src/logger.js")("preamble");

const preambleLogger = {
  info: (message) => {},
};

const { getPromptsFromSupabase, getConfigFromSupabase } = require("../helpers");

module.exports = (async () => {
  const { PROMPT_REMEMBER, PROMPT_CAPABILITY_REMEMBER, PROMPT_REMEMBER_INTRO } =
    await getPromptsFromSupabase();

  const { REMEMBER_MODEL } = await getConfigFromSupabase();

  /**
   * Generates a completion and stores it in the database
   * @param {string} prompt - The prompt to generate a response for
   * @param {string} response - The robot's response to the prompt
   * @param {string} username - The username of the user to generate a completion for
   * @param {Array} conversationHistory - The entire conversation history up to the point of the user's last message
   * @param {boolean} isCapability - Whether the completion is for a capability or not
   * @param {string} capabilityName - The name of the capability (if applicable)
   *
   * @returns {string} - The completion text
   */
  async function logInteraction(
    prompt,
    response,
    { username = "", channel = "", guild = "", related_message_id = "" },
    conversationHistory = [],
    isCapability = false,
    capabilityName = ""
  ) {
    // Validate input
    if (
      !prompt ||
      !response ||
      !username ||
      !channel ||
      !guild ||
      !related_message_id
    ) {
      logger.error("logInteraction error: Missing required parameters");
      return "Error: Missing required parameters";
    }

    const userMemoryCount = chance.integer({ min: 4, max: 24 });

    // Get memories
    const userMemories = await getUserMemory(username, userMemoryCount);
    const generalMemories = await getAllMemories(userMemoryCount);
    const relevantMemories = isCapability
      ? await getRelevantMemories(capabilityName)
      : await getRelevantMemories(prompt, userMemoryCount);

    const memories = [...userMemories, ...generalMemories, ...relevantMemories];
    const memoryMessages = memories.map((memory) => ({
      role: "system",
      content: `${memory.created_at}: ${memory.value}`,
    }));

    // Process response
    const processedResponse = await processResponse(response);

    // Generate remember completion
    const rememberCompletion = await generateRememberCompletion(
      isCapability,
      memoryMessages,
      conversationHistory,
      prompt,
      processedResponse,
      capabilityName
    );

    const rememberText = rememberCompletion.choices[0].message.content;

    // Store user memory if valid
    if (rememberText && rememberText !== "✨" && rememberText.length > 0) {
      await storeUserMemory(
        { username, channel, conversation_id: channel, related_message_id },
        rememberText
      );
    }

    // Analyze and execute tasks
    await analyzeAndExecuteTasks(memoryMessages, conversationHistory);

    return rememberText;
  }

  async function processResponse(response) {
    if (response.image) {
      const base64Image = response.image.split(";base64,").pop();
      vision.setImageBase64(base64Image);
      const imageDescription = await vision.fetchImageDescription();
      response.content = `${response.content}\n\nDescription of user-provided image: ${imageDescription}`;
      delete response.image;
    }
    return response;
  }

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
      {
        role: "user",
        content: `${prompt}`,
      },
      {
        role: "assistant",
        content: `${response}`,
      },
      {
        role: "user",
        content: isCapability ? PROMPT_CAPABILITY_REMEMBER : PROMPT_REMEMBER,
      },
    ];

    return await openai.chat.completions.create({
      model: REMEMBER_MODEL,
      presence_penalty: 0.1,
      max_tokens: 256,
      messages,
    });
  }

  async function analyzeAndExecuteTasks(memoryMessages, conversationHistory) {
    const taskAnalysisMessages = [
      ...memoryMessages,
      ...conversationHistory,
      {
        role: "system",
        content: `Analyze the previous messages for any content that could be a task or todo. If found, please add or modify the todo list using a few simple capabilities: 
  
        - todo:createTodo(name, description)
        - todo:deleteTodo(todoId)
        - todo:updateTodo(todoId, updates)
        `,
      },
    ];

    const taskAnalysisCompletion = await openai.chat.completions.create({
      model: REMEMBER_MODEL,
      presence_penalty: -0.1,
      max_tokens: 256,
      messages: taskAnalysisMessages,
    });

    const taskAnalysisText = taskAnalysisCompletion.choices[0].message.content;

    const createTodoRegex = /todo:createTodo\((.*?),(.*?)\)/g;
    const deleteTodoRegex = /todo:deleteTodo\((.*?)\)/g;
    const updateTodoRegex = /todo:updateTodo\((.*?),(.*?)\)/g;

    const createTodoMatches = taskAnalysisText.match(createTodoRegex);
    const deleteTodoMatches = taskAnalysisText.match(deleteTodoRegex);
    const updateTodoMatches = taskAnalysisText.match(updateTodoRegex);

    const createTodosPromises =
      createTodoMatches?.map((match) => {
        const [_, name, description] = match.split(",");
        return createTodo(name.trim(), description.trim());
      }) || [];

    const deleteTodosPromises =
      deleteTodoMatches?.map((match) => {
        const [_, todoId] = match.split(",");
        return deleteTodo(todoId.trim());
      }) || [];

    const updateTodosPromises =
      updateTodoMatches?.map((match) => {
        const [_, todoId, updates] = match.split(",");
        return updateTodo(todoId.trim(), updates.trim());
      }) || [];

    const promises = await Promise.all([
      ...createTodosPromises,
      ...deleteTodosPromises,
      ...updateTodosPromises,
    ]);

    return JSON.stringify(promises);
  }

  return {
    logInteraction,
  };
})();
