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
    { username = "", channel = "", guild = "", related_message_id = ""},
    conversationHistory = [],
    isCapability = false,
    capabilityName = "",
  ) {

    // make sure everything exists
    if(!prompt) return "No prompt provided";
    if(!response) return "No response provided";
    if(!username) logger.info(`logInteraction: No username provided`);
    if(!channel) logger.info(`logInteraction: No channel provided`);
    if(!guild) logger.info(`logInteraction: No guild provided`);
    if(!related_message_id) logger.info(`logInteraction: No related_message_id provided`);
    


    const userMemoryCount = chance.integer({ min: 4, max: 24 });
    const memoryMessages = [];

    const userMemories = await getUserMemory(username, userMemoryCount);
    const generalMemories = await getAllMemories(userMemoryCount);
    // const relevantMemories = isCapability
    //   ? await getRelevantMemories(capabilityName)
    //   : [];
    let relevantMemories = await getRelevantMemories(prompt, userMemoryCount);

    if (!relevantMemories) {
      relevantMemories = [];
    }

    let memories = [...userMemories, ...generalMemories];

    memories.forEach((memory) => {
      memoryMessages.push({
        role: "system",
        content: `${memory.created_at}: ${memory.value}  `,
      });
    });

    if (response.image) {
      const base64Image = response.image.split(";base64,").pop();
      vision.setImageBase64(base64Image);
      const imageDescription = await vision.fetchImageDescription();
      response.content = `${response.content}\n\nDescription of user-provided image: ${imageDescription}`;
      delete response.image;
    }

    const completeMessages = [
      ...conversationHistory,
      ...memoryMessages,
      {
        role: "system",
        content: "---",
      },
      {
        role: "system",
        content: PROMPT_REMEMBER_INTRO,
      },
      {
        role: "user",
        content: `# User (${username}): ${prompt} \n # Robot (Artie): ${response}`,
      },
      {
        role: "user",
        content: isCapability ? PROMPT_CAPABILITY_REMEMBER : PROMPT_REMEMBER,
      },
    ];

    // de-dupe memories
    memories = [...userMemories, ...generalMemories, ...relevantMemories];

    // turn user memories into chatbot messages
    memories.forEach((memory) => {
      memoryMessages.push({
        role: "system",
        content: `${memory.created_at}: ${memory.value}  `,
      });
    });

    const capabilityResponse = response;

    // if the response has a .image, we need to send that through the vision API to see what it actually is
    if (capabilityResponse.image) {
      // const imageUrl = message.attachments.first().url;
      // logger.info(imageUrl);
      // vision.setImageUrl(imageUrl);
      // const imageDescription = await vision.fetchImageDescription();
      // return `${prompt}\n\nDescription of user-provided image: ${imageDescription}`;

      // first we need to turn the image into a base64 string
      const base64Image = capabilityResponse.image.split(";base64,").pop();
      // then we need to send it to the vision API
      vision.setImageBase64(base64Image);
      const imageDescription = await vision.fetchImageDescription();
      // then we need to add the description to the response
      capabilityResponse.content = `${capabilityResponse.content}\n\nDescription of user-provided image: ${imageDescription}`;
    }
    const rememberCompletion = await openai.chat.completions.create({
      model: REMEMBER_MODEL,
      // temperature: 1.1,
      // top_p: 0.9,
      presence_penalty: 0.1,
      max_tokens: 256,
      messages: [
        ...memoryMessages,
        ...conversationHistory,
        {
          role: "system",
          content: "Take a deep breath and take things step by step.",
        },
        {
          role: "system",
          content: `You previously ran the capability: ${capabilityName} and got the response: ${capabilityResponse}`,
        },
        {
          role: "user",
          content: `${prompt}`,
        },
        {
          role: "assistant",
          content: `${capabilityResponse}`,
        },
        {
          role: "user",
          content: `${PROMPT_CAPABILITY_REMEMBER}`,
        },
      ],
    });


    const rememberText = rememberCompletion.choices[0].message.content;

    // if the remember text is ✨ AKA empty, we don't wanna store it
    if (rememberText === "✨") return rememberText;
    // if remember text length is 0 or less, we don't wanna store it
    if (rememberText.length <= 0) return rememberText;
    storeUserMemory({ 
      username,
      channel, 
      conversation_id: channel, 
      related_message_id  }, 
      rememberText);



    // TODO: ANALYZE EXCHANGE FOR ANY TODOS/TASKS AND THEN MODIFY THE TODOS TABLE BASED ON WHAT IS NEEDED

    const taskAnalysisMessages = [
      ...memoryMessages,
      ...conversationHistory,
      {
        role: "system",
        content: `Analyze the previous messages for any content that could be a task or todo. If found, please add or modify the todo list using a few simple capabilities: 

        - todo:createTodo(name, description)
        - todo:deleteTodo(todoId)
        - todo:updateTodo(todoId, updates)
        `
      }
    ];

    const taskAnalysisCompletion = await openai.chat.completions.create({
      model: REMEMBER_MODEL,
      presence_penalty: -0.1,
      max_tokens: 256,
      messages: taskAnalysisMessages,
    });

    const taskAnalysisText = taskAnalysisCompletion.choices[0].message.content;

    // TODO: Look for any commands in the response and execute them - note: a response could contain MANY commands
    const createTodoRegex = /todo:createTodo\((.*)\)/g;
    const deleteTodoRegex = /todo:deleteTodo\((.*)\)/g;
    const updateTodoRegex = /todo:updateTodo\((.*)\)/g;

    // look for createTodo commands
    const createTodoMatches = taskAnalysisText.match(createTodoRegex);
    const deleteTodoMatches = taskAnalysisText.match(deleteTodoRegex);
    const updateTodoMatches = taskAnalysisText.match(updateTodoRegex);

    const createTodosPromises = createTodoMatches ? createTodoMatches.map((match) => {
      const [name, description] = match.split(",");
      return createTodo(name, description);
    }) : [];

    const deleteTodosPromises = deleteTodoMatches ? deleteTodoMatches.map((match) => {
      const [todoId] = match.split(",");
      return deleteTodo(todoId);
    }) : [];

    const updateTodosPromises = updateTodoMatches ? updateTodoMatches.map((match) => {
      const [todoId, updates] = match.split(",");
      return updateTodo(todoId, updates);
    }) : [];

    const promises = await Promise.all([...createTodosPromises, ...deleteTodosPromises, ...updateTodosPromises]);
    return JSON.stringify(promises);
  }

  return {
    logInteraction,
  };
})();
