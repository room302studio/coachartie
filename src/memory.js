const { openai } = require("./openai");
const {
  supabase,
  getHexagram,
  replaceRobotIdWithName,
  getPromptsFromSupabase,
} = require("../helpers.js");
const {
  getUserMemory,
  getAllMemories,
  storeUserMemory,
  getRelevantMemories,
} = require("./remember.js");
const Chance = require("chance");
const chance = new Chance();
const vision = require("./vision.js");
const createLogger = require("../src/logger.js");
const logger = createLogger("memory");
const dotenv = require("dotenv");
dotenv.config();

const preambleLogger = createLogger("preamble");
const { REMEMBER_MODEL } = require("../config");

module.exports = (async () => {
  const { PROMPT_REMEMBER, PROMPT_CAPABILITY_REMEMBER, PROMPT_REMEMBER_INTRO } =
    await getPromptsFromSupabase();

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
    conversationHistory = [],
  ) {
    const userMemoryCount = chance.integer({ min: 4, max: 24 });
    const memoryMessages = [];

    const userMemories = await getUserMemory(username, userMemoryCount);

    logger.info(
      `🔧 Enhancing memory with ${userMemoryCount} memories from ${username}`,
    );

    const generalMemories = await getAllMemories(userMemoryCount);

    logger.info(
      `🔧 Enhancing memory with ${generalMemories.length} memories from all users`,
    );

    const memories = [...userMemories, ...generalMemories];

    memories.forEach((memory) => {
      memoryMessages.push({
        role: "system",
        content: `You remember from a previous interaction at ${memory.created_at}: ${memory.value}  `,
      });
    });

    if (response.image) {
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

    let completeMessages = [
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

    completeMessages = completeMessages.filter((message) => message.content);

    preambleLogger.info(
      `📜 Preamble messages ${JSON.stringify(completeMessages)}`,
    );

    const rememberCompletion = await openai.createChatCompletion({
      model: REMEMBER_MODEL,
      presence_penalty: 0.1,
      max_tokens: 256,
      messages: completeMessages,
    });

    const rememberText = rememberCompletion.data.choices[0].message.content;
    logger.info(
      `🧠 Interaction memory: ${rememberText} for ${username} in ${channel} in ${guild} `,
    );

    if (rememberText === "✨" || rememberText.length <= 0) return rememberText;
    await storeUserMemory({ username }, rememberText);

    return rememberText;
  }

  return {
    generateAndStoreRememberCompletion,
  };
})();
