const { openai } = require("./openai");
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
const { getPromptsFromSupabase, getConfigFromSupabase, } = require("../helpers");

module.exports = (async () => {
  const { PROMPT_REMEMBER, PROMPT_CAPABILITY_REMEMBER, PROMPT_REMEMBER_INTRO } = await getPromptsFromSupabase();

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
async function generateAndStoreCompletion(
  prompt,
  response,
  { username = "", channel = "", guild = "" },
  conversationHistory = [],
  isCapability = false,
  capabilityName = ""
) {
  const userMemoryCount = chance.integer({ min: 4, max: 24 });
  const memoryMessages = [];

  const userMemories = await getUserMemory(username, userMemoryCount);
  const generalMemories = await getAllMemories(userMemoryCount);
  const relevantMemories = isCapability ? await getRelevantMemories(capabilityName) : [];

  const memories = [...userMemories, ...generalMemories, ...relevantMemories];

  memories.forEach((memory) => {
    memoryMessages.push({
      role: "system",
      content: `You remember from a previous interaction at ${memory.created_at}: ${memory.value}`,
    });
  });

  if (response.image) {
    const base64Image = response.image.split(";base64,").pop();
    vision.setImageBase64(base64Image);
    const imageDescription = await vision.fetchImageDescription();
    response.content = `${response.content}\n\nDescription of user-provided image: ${imageDescription}`;
    delete response.image;
  }

  conversationHistory.forEach((message) => {
    if (message.image) {
      delete message.image;
    }
  });

  memoryMessages.forEach((message) => {
    if (message.image) {
      delete message.image;
    }
  });

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

  preambleLogger.info(`📜 Preamble messages ${JSON.stringify(completeMessages)}`);

  const rememberCompletion = await openai.createChatCompletion({
    model: REMEMBER_MODEL,
    presence_penalty: 0.1,
    max_tokens: 256,
    messages: completeMessages,
  });

  const rememberText = rememberCompletion.data.choices[0].message.content;
  logger.info(`🧠 Interaction memory: ${rememberText} for ${username} in ${channel} in ${guild}`);

  if (rememberText !== "✨" && rememberText.length > 0) {
    await storeUserMemory({ username: isCapability ? "capability" : username }, rememberText);
  }

  return rememberText;
}

// module.exports = {
//   generateAndStoreCompletion,
// };
  return {
    generateAndStoreCompletion,
  };
})();