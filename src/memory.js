const { openai } = require("./openai");
const { getHexagram, replaceRobotIdWithName } = require("../helpers.js");
const {
  getUserMemory,
  getAllMemories,
  storeUserMemory,
  getRelevantMemories,
} = require("./remember.js");
const chance = require("chance").Chance();
const vision = require("./vision.js");
const logger = require("../src/logger.js")("memory");

const preambleLogger = require("../src/logger.js")("preamble");

// 📜 prompts: our guidebook of conversational cues
const prompts = require("../prompts");
const { PROMPT_REMEMBER, PROMPT_CAPABILITY_REMEMBER, PROMPT_REMEMBER_INTRO } =
  prompts;
const { REMEMBER_MODEL } = require("../config");


/**
 * Retrieves user memories.
 * @param {string} username - The username of the user.
 * @param {number} userMemoryCount - The number of user memories to retrieve.
 * @returns {Array} - The user memories.
 */
async function getUserMemories(username, userMemoryCount) {
  return await getUserMemory(username, userMemoryCount);
}

/**
 * Retrieves general memories.
 * @param {number} userMemoryCount - The number of general memories to retrieve.
 * @returns {Array} - The general memories.
 */
async function getGeneralMemories(userMemoryCount) {
  return await getAllMemories(userMemoryCount);
}

/**
 * Deduplicates memories.
 * @param {Array} userMemories - The user memories.
 * @param {Array} generalMemories - The general memories.
 * @returns {Array} - The deduplicated memories.
 */
function deduplicateMemories(userMemories, generalMemories) {
  return [...userMemories, ...generalMemories];
}

/**
 * Converts user memories into chatbot messages.
 * @param {Array} memories - The memories to convert.
 * @returns {Array} - The chatbot messages.
 */
function convertMemoriesToMessages(memories) {
  const memoryMessages = [];
  memories.forEach((memory) => {
    memoryMessages.push({
      role: "system",
      content: `You remember from a previous interaction at ${memory.created_at}: ${memory.value}  `,
    });
  });
  return memoryMessages;
}

/**
 * Removes images from messages.
 * @param {Array} messages - The messages to remove images from.
 */
function removeImagesFromMessages(messages) {
  messages.forEach((message) => {
    if (message.image) {
      delete message.image;
    }
  });
}

/**
 * Generates preamble messages.
 * @param {Array} conversationHistory - The conversation history.
 * @param {Array} memoryMessages - The memory messages.
 * @returns {Array} - The preamble messages.
 */
function generatePreambleMessages(conversationHistory, memoryMessages) {
  return [
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
      content: `${PROMPT_REMEMBER}`,
    },
  ];
}

/**
 * Generates and stores a remember completion.
 * @param {string} prompt - The prompt to generate a response for.
 * @param {string} response - The robot's response to the prompt.
 * @param {string} username - The username of the user to generate a remember completion for.
 * @param {Array} conversationHistory - The entire conversation history up to the point of the user's last message.
 * @returns {string} - The remember completion.
 */
async function generateAndStoreRememberCompletion(
  prompt,
  response,
  { username = "", channel = "", guild = "" },
  conversationHistory = []
) {
  const userMemoryCount = chance.integer({ min: 4, max: 24 });

  const userMemories = await getUserMemories(username, userMemoryCount);
  const generalMemories = await getGeneralMemories(userMemoryCount);
  const memories = deduplicateMemories(userMemories, generalMemories);
  const memoryMessages = convertMemoriesToMessages(memories);

  if (response.image) {
    delete response.image;
  }

  removeImagesFromMessages(conversationHistory);
  removeImagesFromMessages(memoryMessages);

  const completeMessages = generatePreambleMessages(
    conversationHistory,
    memoryMessages
  );

  preambleLogger.info("📜 Preamble messages", completeMessages);

  const rememberCompletion = await openai.createChatCompletion({
    model: REMEMBER_MODEL,
    presence_penalty: 0.1,
    max_tokens: 256,
    messages: completeMessages,
  });

  const rememberText = rememberCompletion.data.choices[0].message.content;

  if (rememberText === "✨") return rememberText;
  if (rememberText.length <= 0) return rememberText;

  await storeUserMemory({ username }, rememberText);

  return rememberText;
}


async function generateAndStoreTaskEvaluation(
  prompt,
  response,
  { username = "", channel = "", guild = "" },
  conversationHistory = []
) {
  // logger.info("🔧 Generating and storing task evaluation");

  // We are going to keep a running list of tasks in our memory
  // So for every exchange, similar to the way we generate a memory, we will generate either: a new task, an update to a task (deleted/cancelled, completed, or updated), or nothing (if the user didn't mention a task)
  // We will then store that in the memory as a task
  // and automatically insert the current task list into the context for every completion

  // first we need to get all the memories with the memory_type `task`
  const tasks = getTaskMemories(100)

  let taskMessages = []

  taskMessages.push({
    role: 'system',
    content: `# Your Current To-Do List:
${tasks.map(task => `  - <${id}> ${task.value}`).join('\n')}
    `
  })

  // explain the to-do list management task
  taskMessages.push({
    role: 'user',
    content: `I am entrusting you with my current to-do list and a recent exchange between myself and my assistant. Your responsibility is to critically assess this exchange and its implications on my tasks. Determine if any modifications are needed on the to-do list based on this interaction; this could involve adding new tasks, marking existing ones as completed, or leaving the list unchanged if no action is warranted. Your decisions should be rooted in ensuring optimal response and support to our users, aligning with Room 302 Studio's objectives of fostering a positive environment for growth, learning, and collaboration. Keep your memo short, precise, and actionable.
    
    If any part of your response contains the text markCompleted(<id>), it will be interpreted as a request to mark the task with the given id as completed. If any part of your response contains the text markDeleted(<id>), it will be interpreted as a request to mark the task with the given id as deleted. If any part of your response contains the text addTask(<task>), it will be interpreted as a request to add the given task to the list. If any part of your response contains the text updateTask(<id>, <task>), it will be interpreted as a request to update the task with the given id to the given task.`
  })

  // add the exchange to the task evaluation

  taskMessages.push({
    role: 'user',
    content: `Evaluate this exchange for tasks:
    
## User (${username}): 
${prompt} 
## Robot (Artie): 
${response}`
  })

  logger.info(`🔧 Task Evaluation Messages: ${JSON.stringify(taskMessages)}`)

  const taskEvaluationCompletion = await openai.createChatCompletion({
    model: "gpt-3.5-turbo",
    presence_penalty: 0.1,
    max_tokens: 256,
    messages: taskMessages
  })

  const taskEvaluationText = taskEvaluationCompletion.data.choices[0].message.content
  logger.info(`🔧 Task Evaluation Text: ${taskEvaluationText}`)

  // check if the response modifies the task list
  const addTaskRegex = /addTask\((.*)\)/g;
  const markCompletedRegex = /markCompleted\((.*)\)/g;
  const markDeletedRegex = /markDeleted\((.*)\)/g;
  const updateTaskRegex = /updateTask\((.*), (.*)\)/g;

  let addTaskMatches = taskEvaluationText.matchAll(addTaskRegex);
  let markCompletedMatches = taskEvaluationText.matchAll(markCompletedRegex);
  let markDeletedMatches = taskEvaluationText.matchAll(markDeletedRegex);
  let updateTaskMatches = taskEvaluationText.matchAll(updateTaskRegex);

  for (const match of addTaskMatches) {
    logger.info(`🔧 Adding task: ${match[1]}`);
    const task = match[1];
    const taskId = await addTaskMemory(task);
    logger.info(`🔧 Added task with id: ${taskId}`);
  }

  for (const match of markCompletedMatches) {
    const taskId = match[1];
    await markTaskCompleted(taskId);
    logger.info(`🔧 Marked task with id ${taskId} as completed`);
  }

  for (const match of markDeletedMatches) {
    const taskId = match[1];
    await markTaskDeleted(taskId);
    logger.info(`🔧 Marked task with id ${taskId} as deleted`);
  }

  for (const match of updateTaskMatches) {
    const taskId = match[1];
    const task = match[2];
    await updateTask(taskId, task);
    logger.info(`🔧 Updated task with id ${taskId} to ${task}`);
  }

  // make a memory of the task evaluation
  await generateAndStoreRememberCompletion(
    prompt,
    taskEvaluationText,
    { username, channel, guild },
    conversationHistory
  )

  return taskEvaluationText
  
}

/**
 * Generates and stores capability completion.
 * @param {string} prompt - The prompt for the capability completion.
 * @param {string} capabilityResponse - The response generated by the capability.
 * @param {string} capabilityName - The name of the capability.
 * @param {Object} options - Additional options for generating and storing capability completion.
 * @param {string} options.username - The username associated with the capability completion.
 * @param {Array} conversationHistory - The conversation history.
 * @returns {Promise<string>} - The generated capability completion text.
 */
async function generateAndStoreCapabilityCompletion(
  prompt,
  capabilityResponse,
  capabilityName,
  { username = "", channel = "", guild = "" },
  conversationHistory = []
) {
  // logger.info("🔧 Generating and storing capability usage");
  // logger.info("🔧 Prompt:", prompt);
  // logger.info("🔧 Response:", capabilityResponse);
  const userMemoryCount = chance.integer({ min: 1, max: 6 });
  const memoryMessages = [];

  // get user memories
  logger.info(
    `🔧 Enhancing memory with ${userMemoryCount} memories from ${username}`
  );
  const userMemories = await getUserMemory(username, userMemoryCount);

  const generalMemories = await getAllMemories(userMemoryCount);

  const relevantMemories = await getRelevantMemories(capabilityName);

  // de-dupe memories
  const memories = [...userMemories, ...generalMemories];

  // turn user memories into chatbot messages
  memories.forEach((memory) => {
    memoryMessages.push({
      role: "system",
      content: `You remember from a previous interaction at ${memory.created_at}: ${memory.value}  `,
    });
  });

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
  }

  // make sure none of the messages in conversation history have an image
  conversationHistory.forEach((message) => {
    if (message.image) {
      delete message.image;
    }
  });

  // make sure none of the memory messages have an image
  memoryMessages.forEach((message) => {
    if (message.image) {
      delete message.image;
    }
  });

  const rememberCompletion = await openai.createChatCompletion({
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
        content: "---",
      },
      {
        role: "system",
        content: `You remember from a previous interaction: ${capabilityName} ${capabilityResponse}`,
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

  const rememberText = rememberCompletion.data.choices[0].message.content;

  // if the remember text is ✨ AKA empty, we don't wanna store it
  if (rememberText === "✨") return rememberText;
  // if remember text length is 0 or less, we don't wanna store it
  if (rememberText.length <= 0) return rememberText;
  await storeUserMemory({ username: "capability" }, rememberText);

  return rememberText;
}

module.exports = {
  generateAndStoreRememberCompletion,
  generateAndStoreCapabilityCompletion,
  generateAndStoreTaskEvaluation,
};
