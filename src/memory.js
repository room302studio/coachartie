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
 * Generates a remember completion and stores it in the database
 * @param {string} prompt - The prompt to generate a response for
 * @param {string} response - The robot's response to the prompt
 * @param {string} username - The username of the user to generate a remember completion for
 * @param {Array} conversationHistory - The entire conversation history up to the point of the user's last message
 *
 * @returns {string} - The remember completion
 *
 */
async function generateAndStoreRememberCompletion(
  prompt,
  response,
  { username = "", channel = "", guild = "" },
  conversationHistory = []
) {
  logger.info("🔧 Generating and storing remember completion", username);
  logger.info("🔧 Prompt:", prompt);
  logger.info("🔧 Response:", response);

  const memoryMin = 4;
  const memoryMax = 24;
  const memoryMessages = [];

  const userMemories = await getUserMemory(
    username,
    chance.integer({ min: memoryMin, max: memoryMax })
  );
  const generalMemories = await getAllMemories(
    chance.integer({ min: memoryMin, max: memoryMax })
  );
  const relatedMemories = await getRelevantMemories(
    prompt,
    chance.integer({ min: memoryMin, max: memoryMax })
  );

  logger.info(`🔧 Found ${userMemories.length} user memories`);
  logger.info(`🔧 Found ${generalMemories.length} general memories`);
  logger.info(`🔧 Found ${relatedMemories.length} related memories`);

  // de-dupe memories
  const memories = [
    ...(userMemories || []),
    ...(generalMemories || []),
    ...(relatedMemories || []),
  ];

  // get user memories
  logger.info(
    `🔧 Enhancing memory with ${memories.length} memories from ${username}`
  );

  // turn user memories into chatbot messages
  memories.forEach((memory) => {
    memoryMessages.push({
      role: "system",
      content: `You remember from a previous interaction at ${memory.created_at}: ${memory.value}  `,
    });
  });

  // if the response has a .image, delete that
  if (response.image) {
    delete response.image;
  }

  // check the integrity of conversation history
  if (!conversationHistory) {
    conversationHistory = [];
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

  const completeMessages = [
    // ...conversationHistory,
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

  // preambleLogger.info("📜 Preamble messages", completeMessages);

  const rememberCompletion = await openai.createChatCompletion({
    model: REMEMBER_MODEL,
    // temperature: 1.1,
    // top_p: 0.9,
    presence_penalty: 0.1,
    max_tokens: 256,
    messages: completeMessages,
  });

  const rememberText = rememberCompletion.data.choices[0].message.content;
  // logger.info("🧠 Interaction memory", rememberText);

  // if the remember text is ✨ AKA empty, we don't wanna store it
  if (rememberText === "✨") return rememberText;
  // if remember text length is 0 or less, we don't wanna store it
  if (rememberText.length <= 0) return rememberText;
  await storeUserMemory({ username }, rememberText);

  return rememberText;
}

module.exports = {
  generateAndStoreRememberCompletion,
};
