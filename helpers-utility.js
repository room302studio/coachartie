const { encode } = require("@nem035/gpt-3-encoder");
const logger = require("./src/logger.js")("helpers-utility");
const { supabase } = require("./src/supabaseclient");

const capabilityRegex = /(\w+):(\w+)\(([^]*?)\)/; // captures newlines in the  third argument

/**
 * Counts the number of tokens in a string.
 * @param {string} text - The string to count the tokens in.
 * @returns {number} - The number of tokens in the string.
 */
function countTokens(text) {
  const encodedText = encode(text.toString());
  return encodedText.length;
}

/**
 * Counts the number of tokens in an array of messages.
 * @param {Array} messages - The array of messages to count the tokens in.
 * @returns {number} - The number of tokens in the array of messages.
 */
function countTokensInMessageArray(messages = []) {
  if (!messages || messages.length === 0) {
    return 0;
  }
  return messages.reduce((totalTokens, message) => {
    const messageText = JSON.stringify(message);
    const messageTokens = countTokens(messageText);
    return totalTokens + messageTokens;
  }, 0);
}

/**
 * Removes a mention from a message.
 * @param {string} message - The message to remove the mention from.
 * @param {string} mention - The mention to remove.
 * @returns {string} - The message with the mention removed.
 */
function removeMentionFromMessage(message, mention) {
  const mentionRegex = new RegExp(`<@${mention}>`, "g");
  return message.replace(mentionRegex, "").trim();
}

/**
 * Displays a typing indicator for the given message.
 * @param {string} message - The message to display the typing indicator for.
 * @returns {number} - The interval ID for the typing indicator.
 */
function displayTypingIndicator(message) {
  startTypingIndicator(message);
  const typingInterval = setTypingInterval(message);
  return typingInterval; // To allow for clearing the interval outside of this function
}

/**
 * Starts the typing indicator in the specified message's channel.
 * @param {Message} message - The message object.
 */
function startTypingIndicator(message) {
  message.channel.sendTyping();
}

/**
 * Sets an interval to send typing indicator in a channel.
 * @param {Message} message - The message object.
 * @returns {number} - The ID of the interval.
 */
function setTypingInterval(message) {
  return setInterval(() => message.channel.sendTyping(), 5000);
}
/**
 * Splits a message into chunks and sends them as separate messages.
 * @param {string} messageText - The message text to be split and sent.
 * @param {object} channel - The channel to send the message to.
 * @returns {void}
 */
function splitAndSendMessage(messageText, channel) {
  if (!channel) {
    logger.info("splitAndSendMessage: channel is null or undefined");
    return;
  }
  if (typeof messageText !== "string") {
    logger.info("splitAndSendMessage: messageText is not a string");
    return;
  }

  logger.info(`splitAndSendMessage: message length: ${messageText.length}`);

  if (messageText.length < 2000) {
    try {
      channel.send(messageText);
    } catch (error) {
      logger.info(`Error sending message: ${error}`);
    }
  } else {
    const messageChunks = splitMessageIntoChunks(messageText);
    messageChunks.forEach((chunk, index) => {
      try {
        channel.send(chunk);
      } catch (error) {
        logger.info(`Error sending message chunk ${index}: ${error}`);
      }
    });
  }
}

/**
 * Splits a message string into chunks.
 * @param {string} messageText - The message text to be split.
 * @returns {Array<string>} - An array containing the chunks of the message.
 */
function splitMessageIntoChunks(messageText) {
  if (typeof messageText !== "string") {
    logger.info("splitMessageIntoChunks: messageText is not a string");
    return [];
  }
  const words = messageText.split(" ");
  const messageChunks = [];
  let currentChunk = "";

  words.forEach((word) => {
    if (currentChunk.length + word.length + 1 <= 2000) {
      currentChunk += `${word} `;
    } else {
      messageChunks.push(currentChunk.trim());
      currentChunk = `${word} `;
    }
  });

  if (currentChunk.length > 0) {
    messageChunks.push(currentChunk.trim());
  }

  return messageChunks;
}

/**
 * Destructures a string of arguments into an array of trimmed arguments.
 * @param {string} argsString - The string of arguments to destructure.
 * @returns {Array<string>} - An array of trimmed arguments.
 */
function destructureArgs(argsString) {
  return argsString.split(",").map((arg) => arg.trim());
}

/**
 * Parses a JSON string into a JavaScript object.
 * @param {string} jsonString - The JSON string to be parsed.
 * @returns {Object} - The JavaScript object parsed from the input JSON string.
 * @throws {SyntaxError} If the input string is not a valid JSON.
 */
function parseJSONArg(jsonString) {
  return JSON.parse(jsonString.replace(/'/g, '"'));
}

/**
 * Cleans a URL for use with Puppeteer by removing leading and trailing quotes.
 * @param {string} url - The URL to clean.
 * @returns {string} - The cleaned URL.
 */
function cleanUrlForPuppeteer(url) {
  return url.replace(/^['"]|['"]$/g, "");
}

/**
 * Delays execution for a specified number of milliseconds.
 * @param {number} ms - The number of milliseconds to delay.
 * @returns {Promise} - A promise that resolves after the specified delay.
 */
async function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Processes chunks of data asynchronously with a provided processing function.
 * @param {Array} chunks - The data chunks to process.
 * @param {Function} processFunction - The function to process each chunk. Must return a Promise.
 * @param {number} [concurrencyLimit=2] - The number of chunks to process concurrently.
 * @param {Object} [options={}] - Additional options for the processing function.
 * @returns {Promise<Array>} - A promise that resolves to an array of processed chunk results.
 */
async function processChunks(
  chunks,
  processFunction,
  concurrencyLimit = 2,
  options = {}
) {
  const results = [];
  const filteredChunks = chunks.filter((chunk) => chunk.length > 0);

  for (let i = 0; i < filteredChunks.length; i += concurrencyLimit) {
    const chunkBatch = filteredChunks.slice(i, i + concurrencyLimit);
    const batchResults = await Promise.all(
      chunkBatch.map(async (chunk, index) => {
        await sleep(500);
        return processFunction(chunk, options);
      })
    );
    results.push(...batchResults);
  }

  return results;
}

/**
 * Retrieves configuration data from Supabase.
 * @returns {Promise<Object>} An object containing the configuration keys and values.
 */
async function getConfigFromSupabase() {
  const { data, error } = await supabase.from("config").select("*");

  // turn the array of objects into a big object that can be destructured
  const configArray = data;
  // get all the keys and values
  const configKeys = configArray.map((config) => config.config_key);
  const configValues = configArray.map((config) => config.config_value);
  // return an object with all the keys and values
  const config = Object.fromEntries(
    configKeys.map((_, i) => [configKeys[i], configValues[i]])
  );
  return config;
}

// Example array of animal emojis
const emojis = [
  "🐶",
  "🐱",
  "🐭",
  "🐹",
  "🐰",
  "🦊",
  "🐻",
  "🐼",
  "🐻‍❄️",
  "🐨",
  "🐯",
  "🦁",
  "🐮",
  "🐷",
  "🐸",
  "🐵",
  "🙈",
  "🙉",
  "🙊",
  "🐒",
  "🐔",
  "🐧",
  "🐦",
  "🐤",
  "🐣",
  "🐥",
  "🦆",
  "🦅",
  "🦉",
  "🦇",
  "🐺",
  "🐗",
  "🐴",
  "🦄",
  "🐝",
  "🪱",
  "🐛",
  "🦋",
  "🐌",
  "🐞",
  "🐜",
  "🦟",
  "🦗",
  "🕷",
  "🕸",
  "🦂",
  "🐢",
  "🐍",
  "🦎",
  "🦖",
  "🦕",
  "🐙",
  "🦑",
  "🦐",
  "🦞",
  "🦀",
  "🐡",
  "🐠",
  "🐟",
  "🐬",
  "🐳",
  "🐋",
  "🦈",
  "🐊",
  "🐅",
  "🐆",
  "🦓",
  "🦍",
  "🦧",
  "🐘",
  "🦛",
  "🦏",
  "🐪",
  "🐫",
  "🦒",
  "🦘",
  "🦬",
  "🐃",
  "🐂",
  "🐄",
  "🐎",
  "🐖",
  "🐏",
  "🐑",
  "🦙",
  "🐐",
  "🦌",
  "🐕",
  "🐩",
  "🦮",
  "🐕‍🦺",
  "🐈",
  "🐈‍⬛",
  "🪶",
  "🐓",
  "🦃",
  "🦤",
  "🦚",
  "🦜",
  "🦢",
  "🦩",
  "🕊",
  "🐇",
  "🦝",
  "🦨",
  "🦡",
  "🦫",
  "🦦",
  "🦥",
  "🐁",
  "🐀",
  "🐿",
  "🦔",
];

// Set to store used emojis
const usedEmojis = new Set();

// Function to get a unique emoji
function getUniqueEmoji() {
  let emoji;
  do {
    emoji = emojis[Math.floor(Math.random() * emojis.length)];
  } while (usedEmojis.has(emoji));

  usedEmojis.add(emoji);

  if (usedEmojis.size === emojis.length) {
    usedEmojis.clear();
  }

  return emoji;
}

/**
 * Checks if a message contains a capability.
 * @param {string} message - The message to check.
 * @returns {boolean} - True if the message contains a capability, false otherwise.
 */
function doesMessageContainCapability(message) {
  return !!message.match(capabilityRegex);
}

module.exports = {
  countTokens,
  countTokensInMessageArray,
  removeMentionFromMessage,
  splitAndSendMessage,
  splitMessageIntoChunks,
  destructureArgs,
  parseJSONArg,
  cleanUrlForPuppeteer,
  sleep,
  processChunks,
  getConfigFromSupabase,
  displayTypingIndicator,
  getUniqueEmoji,
  doesMessageContainCapability,
};
