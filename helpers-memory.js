const logger = require("./src/logger")("helpers-memory");
const { getRelevantMemories } = require("./src/remember");
const { supabase } = require("./src/supabaseclient");
const { Chance } = require("chance");

const chance = new Chance();

async function getUserMemory(username, limit = 10) {
  const { data, error } = await supabase
    .from("memories")
    .select("*")
    .eq("user_id", username)
    .order("created_at", { ascending: false })
    .limit(limit);

  if (error) {
    logger.error(
      `Error retrieving user memory for ${username}: ${JSON.stringify(error)}`
    );
    return [];
  }

  return data;
}

async function getUserMessageHistory(username, limit = 10) {
  const { data, error } = await supabase
    .from("messages")
    .select("*")
    .eq("user_id", username)
    .order("created_at", { ascending: false })
    .limit(limit);

  if (error) {
    logger.error(
      `Error retrieving message history for ${username}: ${JSON.stringify(
        error
      )}`
    );
    return [];
  }

  return data;
}

async function getAllMemories(limit = 10) {
  const { data, error } = await supabase
    .from("memories")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(limit);

  if (error) {
    logger.error(`Error retrieving general memories: ${JSON.stringify(error)}`);
    return [];
  }

  return data;
}

/**
 * Retrieves previous messages for a user and adds them to the messages array.
 * @param {string} username - The username of the user.
 * @param {Array} messages - The array to which the user messages will be added.
 * @param {Object} options - The options for generating user messages.
 * @param {number} [options.minCount=1] - The minimum number of user messages to retrieve.
 * @param {number} [options.maxCount=10] - The maximum number of user messages to retrieve.
 * @returns {Promise<void>} - A promise that resolves when the user messages have been added to the array.
 */
async function addUserMessages(username, messages, options = {}) {
  const { minCount = 4, maxCount = 24 } = options;
  const userMessageCount = chance.integer({ min: minCount, max: maxCount });
  // Retrieve user messages and add them to the messages array
  logger.info(
    `🔧 Retrieving ${userMessageCount} previous messages for ${username}`
  );
  try {
    const userMessages = await getUserMessageHistory(
      username,
      userMessageCount
    );
    if (!userMessages) {
      logger.info(`No previous messages found for ${username}`);
      return;
    }
    userMessages.reverse();
    userMessages.forEach((message) => {
      messages.push({
        role: "user",
        content: `${message.value}`,
      });
    });
  } catch (error) {
    logger.error("Error getting previous user messages:", error);
  }
}

/**
 * Adds user memories to the messages array.
 * @param {string} username - The username of the user.
 * @param {Array} messages - The array of messages to add user memories to.
 * @param {Object} options - The options for retrieving user memories.
 * @param {number} [options.minCount=8] - The minimum number of user memories to retrieve.
 * @param {number} [options.maxCount=32] - The maximum number of user memories to retrieve.
 * @returns {Promise<void>} - A promise that resolves when the user memories are added to the messages array.
 */
async function addUserMemories(username, messages, options = {}) {
  const { minCount = 4, maxCount = 24 } = options;
  const userMemoryCount = chance.integer({ min: minCount, max: maxCount });
  try {
    const userMemories = await getUserMemory(username, userMemoryCount);
    logger.info(`🔧 Retrieving ${userMemoryCount} memories for ${username}`);
    userMemories.forEach((memory) => {
      messages.push({
        role: "system",
        content: `You remember from a previous interaction on ${memory.created_at}: ${memory.value}`,
      });
    });
  } catch (err) {
    logger.error(err);
  }
}

/**
 * Adds relevant memories to the messages array.
 * @param {string} username - The username of the user.
 * @param {Array} messages - The array of messages to add relevant memories to.
 * @param {Object} options - The options for retrieving relevant memories.
 * @param {number} [options.minCount=6] - The minimum number of relevant memories to retrieve.
 * @param {number} [options.maxCount=32] - The maximum number of relevant memories to retrieve.
 * @returns {Promise<void>} - A promise that resolves when the relevant memories are added to the messages array.
 */
async function addRelevantMemories(username, messages, options = {}) {
  const { minCount = 1, maxCount = 16 } = options;

  const relevantMemoryCount = chance.integer({ min: minCount, max: maxCount });

  // get the last user message to use as the query for relevant memories
  const lastUserMessage = messages
    .slice()
    .reverse()
    .find((message) => message.role === "user");

  if (!lastUserMessage) {
    logger.info(`No last user message found for ${username}`);
    return;
  }

  const queryString = lastUserMessage.content;
  logger.info(
    `🔧 Querying for relevant memories for ${username}: ${queryString}`
  );

  try {
    const relevantMemories = await getRelevantMemories(
      queryString,
      relevantMemoryCount
    );
    logger.info(
      `🔧 Retrieving ${relevantMemoryCount} relevant memories for ${queryString}`
    );

    if (relevantMemories.length === 0) {
      relevantMemories.forEach((memory) => {
        // log out the memories
        logger.info("relevant memory " + JSON.stringify(memory));
        messages.push({
          role: "system",
          content: `${memory.created_at}: ${memory.value}`,
        });
      });
    }
  } catch (err) {
    logger.error(err);
  }
}

/**
 * Adds general memories to the messages array.
 * @param {Array} messages - The array of messages to add general memories to.
 * @param {Object} options - The options for retrieving general memories.
 * @param {number} [options.minCount=2] - The minimum number of general memories to retrieve.
 * @param {number} [options.maxCount=8] - The maximum number of general memories to retrieve.
 * @returns {Promise<void>} - A promise that resolves when the general memories are added to the messages array.
 */
async function addGeneralMemories(messages, options = {}) {
  const { minCount = 3, maxCount = 20 } = options;
  const generalMemoryCount = chance.integer({ min: minCount, max: maxCount });
  try {
    const generalMemories = await getAllMemories(generalMemoryCount);
    logger.info(`🔧 Retrieving ${generalMemoryCount} general memories`);
    generalMemories.forEach((memory) => {
      messages.push({
        role: "system",
        content: `${memory.created_at}: ${memory.value}`,
      });
    });
  } catch (err) {
    logger.error(err);
  }
}

module.exports = {
  getUserMemory,
  getUserMessageHistory,
  getAllMemories,
  getRelevantMemories,
  addUserMessages,
  addUserMemories,
  addRelevantMemories,
  addGeneralMemories,
};
