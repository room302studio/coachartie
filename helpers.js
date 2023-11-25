const { Chance } = require("chance");
const chance = new Chance();
const dotenv = require("dotenv");
const { openai } = require("./src/openai");
const { capabilityRegex } = require("./src/capabilities.js");
const {
  getUserMemory,
  getUserMessageHistory,
} = require("./capabilities/remember");
dotenv.config();

// const { generateAndStoreRememberCompletion } = require("./memory.js");

const { PROMPT_SYSTEM, CAPABILITY_PROMPT_INTRO } = require("./prompts");

// 📚 GPT-3 token-encoder: our linguistic enigma machine
const { encode, decode } = require("@nem035/gpt-3-encoder");

const ERROR_MSG = `I am so sorry, there was some sort of problem. Feel free to ask me again, or try again later.`;
const TOKEN_LIMIT = 12000;
const RESPONSE_LIMIT = 5120;
const WARNING_BUFFER = 900;

/**
 * Replaces the robot id with the robot name in a given string.
 * @param {string} string - The string to replace the robot id in.
 * @param {object} client - The client object.
 * @returns {string} - The string with the robot id replaced by the robot name.
 */
function replaceRobotIdWithName(string, client) {
  const coachArtieId = getCoachArtieId(client);
  const coachArtieName = getCoachArtieName(client);
  return replaceStringWithId(string, coachArtieId, coachArtieName);
}

/**
 * Gets the id of Coach Artie.
 * @param {object} client - The client object.
 * @returns {string} - The id of Coach Artie.
 */
function getCoachArtieId(client) {
  return client.user.id;
}

/**
 * Gets the name of Coach Artie.
 * @param {object} client - The client object.
 * @returns {string} - The name of Coach Artie.
 */
function getCoachArtieName(client) {
  return client.user.username;
}

/**
 * Replaces an id with a name in a given string.
 * @param {string} string - The string to replace the id in.
 * @param {string} id - The id to replace.
 * @param {string} name - The name to replace the id with.
 * @returns {string} - The string with the id replaced by the name.
 */
function replaceStringWithId(string, id, name) {
  return string.replace(`<@!${id}>`, name);
}

/**
 * Splits a string into an array of arguments.
 * @param {string} args - The string to split into arguments.
 * @returns {Array} - The array of arguments.
 */
function splitArgs(args) {
  return args.split(",").map((arg) => arg.trim());
}

/**
 * Counts the number of tokens in a string.
 * @param {string} str - The string to count the tokens in.
 * @returns {number} - The number of tokens in the string.
 */
function countTokens(str) {
  const encodedMessage = encode(str.toString());
  return encodedMessage.length;
}

/**
 * Counts the number of tokens in an array of messages.
 * @param {Array} messageArray - The array of messages to count the tokens in.
 * @returns {number} - The number of tokens in the array of messages.
 */
function countTokensInMessageArray(messageArray = []) {
  let totalTokens = 0;
  if (!messageArray || messageArray.length === 0) {
    return totalTokens;
  }
  return countTokensInArray(messageArray);
}

/**
 * Counts the number of tokens in an array of messages.
 * @param {Array} messageArray - The array of messages to count the tokens in.
 * @returns {number} - The number of tokens in the array of messages.
 */
function countTokensInArray(messageArray) {
  let totalTokens = 0;
  for (let i = 0; i < messageArray.length; i++) {
    totalTokens += countTokensInMessage(messageArray[i]);
  }
  return totalTokens;
}

/**
 * Counts the number of tokens in a message.
 * @param {object} message - The message to count the tokens in.
 * @returns {number} - The number of tokens in the message.
 */
function countTokensInMessage(message) {
  const encodedMessage = encode(JSON.stringify(message));
  return encodedMessage.length;
}

/**
 * Removes a mention from a message.
 * @param {string} message - The message to remove the mention from.
 * @param {string} mention - The mention to remove.
 * @returns {string} - The message with the mention removed.
 */
function removeMentionFromMessage(message, mention) {
  return message.replace(mention, "").trim();
}

/**
 * Generates a hexagram.
 * @returns {string} - The generated hexagram.
 */
function generateHexagram() {
  const hexagramNumber = chance.integer({ min: 1, max: 64 });
  return `${hexagramNumber}. ${getHexName(hexagramNumber)}`;
}

/**
 * Gets the name of a hexagram.
 * @param {number} hexagramNumber - The number of the hexagram.
 * @returns {string} - The name of the hexagram.
 */
function getHexName(hexagramNumber) {
  const hexNameMap = getHexNameMap();
  return hexNameMap[hexagramNumber];
}

/**
 * Gets a map of hexagram numbers to names.
 * @returns {object} - The map of hexagram numbers to names.
 */
function getHexNameMap() {
  return {
    1: "The Creative",
    2: "The Receptive",
    3: "Difficulty at the Beginning",
    4: "Youthful Folly",
    5: "Waiting",
    6: "Conflict",
    7: "The Army",
    8: "Holding Together",
    9: "The Taming Power of the Small",
    10: "Treading",
    11: "Peace",
    12: "Standstill",
    13: "Fellowship with Men",
    14: "Possession in Great Measure",
    15: "Modesty",
    16: "Enthusiasm",
    17: "Following",
    18: "Work on What Has Been Spoiled",
    19: "Approach",
    20: "Contemplation",
    21: "Biting Through",
    22: "Grace",
    23: "Splitting Apart",
    24: "Return",
    25: "Innocence",
    26: "The Taming Power of the Great",
    27: "The Corners of the Mouth",
    28: "Preponderance of the Great",
    29: "The Abysmal",
    30: "The Clinging",
    31: "Influence",
    32: "Duration",
    33: "Retreat",
    34: "The Power of the Great",
    35: "Progress",
    36: "Darkening of the Light",
    37: "The Family",
    38: "Opposition",
    39: "Obstruction",
    40: "Deliverance",
    41: "Decrease",
    42: "Increase",
    43: "Breakthrough",
    44: "Coming to Meet",
    45: "Gathering Together",
    46: "Pushing Upward",
    47: "Oppression",
    48: "The Well",
    49: "Revolution",
    50: "The Cauldron",
    51: "The Arousing (Shock, Thunder)",
    52: "Keeping Still (Mountain)",
    53: "Development (Gradual Progress)",
    54: "The Marrying Maiden",
    55: "Abundance (Fullness)",
    56: "The Wanderer",
    57: "The Gentle (Wind)",
    58: "The Joyous (Lake)",
    59: "Dispersion (Dissolution)",
    60: "Limitation",
    61: "Inner Truth",
    62: "Preponderance of the Small",
    63: "After Completion",
    64: "Before Completion",
  };
}

/**
 * Checks if a message contains a capability.
 * @param {string} message - The message to check.
 * @returns {boolean} - True if the message contains a capability, false otherwise.
 */
function doesMessageContainCapability(message) {
  return message.match(capabilityRegex);
}

/**
 * Checks if a message is breaking the message chain.
 * @param {string} capabilityMatch - The capability match.
 * @param {object} lastMessage - The last message.
 * @returns {boolean} - True if the message is breaking the chain, false otherwise.
 */
function isBreakingMessageChain(capabilityMatch, lastMessage) {
  return (
    !capabilityMatch &&
    lastMessage.role !== "user" &&
    lastMessage.role !== "system"
  );
}

/**
 * Trims a response if it exceeds the limit.
 * @param {string} capabilityResponse - The response to trim.
 * @returns {string} - The trimmed response.
 */
function trimResponseIfNeeded(capabilityResponse) {
  while (isResponseExceedingLimit(capabilityResponse)) {
    capabilityResponse = trimResponseByLineCount(
      capabilityResponse,
      countTokens(capabilityResponse)
    );
  }
  return capabilityResponse;
}

/**
 * Checks if a response exceeds the limit.
 * @param {string} response - The response to check.
 * @returns {boolean} - True if the response exceeds the limit, false otherwise.
 */
function isResponseExceedingLimit(response) {
  return countTokens(response) > RESPONSE_LIMIT;
}

/**
 * Generates parameters for AI completion.
 * @returns {object} - The generated parameters.
 */
function generateAiCompletionParams() {
  return {
    temperature: generateTemperature(),
    presence_penalty: generatePresencePenalty(),
    frequency_penalty: generateFrequencyPenalty(),
  };
}

/**
 * Generates a temperature value.
 * @returns {number} - The generated temperature value.
 */
function generateTemperature() {
  return chance.floating({ min: 0.88, max: 1.2 });
}

/**
 * Generates a presence penalty value.
 * @returns {number} - The generated presence penalty value.
 */
function generatePresencePenalty() {
  return chance.floating({ min: -0.05, max: 0.05 });
}

/**
 * Generates a frequency penalty value.
 * @returns {number} - The generated frequency penalty value.
 */
function generateFrequencyPenalty() {
  return chance.floating({ min: 0.0, max: 0.05 });
}

/**
 * Trims a message chain until it's under 8000 tokens.
 * @param {Array} messages - The message chain to trim.
 * @param {number} maxTokens - The maximum number of tokens.
 * @returns {Array} - The trimmed message chain.
 */
function trimMessageChain(messages, maxTokens = 8000) {
  while (isMessageChainExceedingLimit(messages, maxTokens)) {
    messages = trimMessages(messages);
  }
  console.log("Message chain trimmed.");
  return messages;
}

/**
 * Checks if a message chain exceeds the limit.
 * @param {Array} messages - The message chain to check.
 * @param {number} maxTokens - The maximum number of tokens.
 * @returns {boolean} - True if the message chain exceeds the limit, false otherwise.
 */
function isMessageChainExceedingLimit(messages, maxTokens) {
  return countTokensInMessageArray(messages) > maxTokens;
}

/**
 * Trims messages.
 * @param {Array} messages - The messages to trim.
 * @returns {Array} - The trimmed messages.
 */
function trimMessages(messages) {
  const messageToRemove = selectRandomMessage(messages);
  const trimmedMessageContent = trimMessageContent(messageToRemove);
  messageToRemove.content = trimmedMessageContent;
  if (isMessageEmpty(messageToRemove)) {
    messages = removeEmptyMessage(messages, messageToRemove);
  }
  if (isMessagesEmpty(messages)) {
    return console.error("All messages are empty.");
  }
  return messages;
}

/**
 * Selects a random message.
 * @param {Array} messages - The messages to select from.
 * @returns {object} - The selected message.
 */
function selectRandomMessage(messages) {
  return chance.pickone(messages);
}

/**
 * Trims the content of a message.
 * @param {object} message - The message to trim the content of.
 * @returns {string} - The trimmed content.
 */
function trimMessageContent(message) {
  return message.content.slice(0, message.content.length / 2);
}

/**
 * Checks if a message is empty.
 * @param {object} message - The message to check.
 * @returns {boolean} - True if the message is empty, false otherwise.
 */
function isMessageEmpty(message) {
  return message.content.length === 0;
}

/**
 * Removes an empty message.
 * @param {Array} messages - The messages to remove the empty message from.
 * @param {object} messageToRemove - The empty message to remove.
 * @returns {Array} - The messages with the empty message removed.
 */
function removeEmptyMessage(messages, messageToRemove) {
  return messages.filter((message) => {
    return message !== messageToRemove;
  });
}

/**
 * Checks if messages are empty.
 * @param {Array} messages - The messages to check.
 * @returns {boolean} - True if the messages are empty, false otherwise.
 */
function isMessagesEmpty(messages) {
  return messages.length === 0;
}

/**
 * Trims a response by a certain percentage.
 * @param {string} response - The response to trim.
 * @param {number} lineCount - The number of lines in the response.
 * @param {number} trimAmount - The percentage to trim by.
 * @returns {string} - The trimmed response.
 */
function trimResponseByLineCount(response, lineCount, trimAmount = 0.1) {
  const lines = splitResponseIntoLines(response);
  const linesToRemove = calculateLinesToRemove(lineCount, trimAmount);
  const randomLines = selectRandomLines(lines, linesToRemove);
  const trimmedLines = removeRandomLines(lines, randomLines);
  return joinLinesIntoResponse(trimmedLines);
}

/**
 * Splits a response into lines.
 * @param {string} response - The response to split.
 * @returns {Array} - The lines of the response.
 */
function splitResponseIntoLines(response) {
  return response.split("\n");
}

/**
 * Calculates the number of lines to remove.
 * @param {number} lineCount - The number of lines in the response.
 * @param {number} trimAmount - The percentage to trim by.
 * @returns {number} - The number of lines to remove.
 */
function calculateLinesToRemove(lineCount, trimAmount) {
  return Math.floor(lineCount * trimAmount);
}

/**
 * Selects random lines from a response.
 * @param {Array} lines - The lines of the response.
 * @param {number} linesToRemove - The number of lines to remove.
 * @returns {Array} - The selected lines.
 */
function selectRandomLines(lines, linesToRemove) {
  return chance.pickset(lines, linesToRemove);
}


//  * Removes random lines from a response.
function removeRandomLines(lines, randomLines) {
  return lines.filter((line) => {
    return !randomLines.includes(line);
  });
}

function joinLinesIntoResponse(trimmedLines) {
  return trimmedLines.join("\n");
}

function displayTypingIndicator(message) {
  startTypingIndicator(message);
  const typingInterval = setTypingInterval(message);
  return typingInterval; // To allow for clearing the interval outside of this function
}

function startTypingIndicator(message) {
  message.channel.sendTyping();
}

function setTypingInterval(message) {
  return setInterval(() => message.channel.sendTyping(), 5000);
}

async function generateAiCompletion(prompt, username, messages, config) {
  const { temperature, presence_penalty } = config;

  // if the last message has .image, delete it that property off it
  if (messages[messages.length - 1].image) {
    delete messages[messages.length - 1].image;
  }

  messages = await addPreambleToMessages(username, prompt, messages);
  let completion = null;
  try {
    completion = await createChatCompletion(messages, temperature, presence_penalty);
  } catch (err) {
    console.log(err);
  }
  const aiResponse = getAiResponse(completion);
  console.log("🤖 AI Response:", aiResponse);
  messages.push(aiResponse);
  return { messages, aiResponse };
}

async function createChatCompletion(messages, temperature, presence_penalty) {
  return await openai.createChatCompletion({
    model: "gpt-4-1106-preview",
    temperature,
    presence_penalty,
    max_tokens: 820,
    messages: messages,
  });
}

function getAiResponse(completion) {
  return completion.data.choices[0].message.content;
}

async function addPreambleToMessages(username, prompt, messages) {
  console.log(`🔧 Adding preamble to messages for <${username}> ${prompt}`);
  const preamble = await assembleMessagePreamble(username, prompt);
  return [...preamble, ...messages.flat()];
}

async function assembleMessagePreamble(username, prompt) {
  console.log(`🔧 Assembling message preamble for <${username}> ${prompt}`);
  const messages = [];
  addCurrentDateTime(messages);
  await addHexagramPrompt(messages);
  addSystemPrompt(messages);
  addCapabilityPromptIntro(messages);
  await addUserMessages(username, messages);
  await addUserMemories(username, messages);
  return messages;
}

function addCurrentDateTime(messages) {
  messages.push({
    role: "system",
    content: `Today is ${new Date().toLocaleDateString()} at ${new Date().toLocaleTimeString()}`,
  });
}

async function addHexagramPrompt(messages) {
  if (chance.bool({ likelihood: 50 })) {
    const hexagramPrompt = `Let this hexagram from the I Ching guide this interaction: ${generateHexagram()}`;
    console.log(`🔧 Adding hexagram prompt to message ${hexagramPrompt}`);
    messages.push({
      role: "system",
      content: hexagramPrompt,
    });
  }
}

function addSystemPrompt(messages) {
  messages.push({
    role: "user",
    content: PROMPT_SYSTEM,
  });
}

function addCapabilityPromptIntro(messages) {
  messages.push({
    role: "system",
    content: CAPABILITY_PROMPT_INTRO,
  });
}

async function addUserMessages(username, messages) {
  const userMessageCount = chance.integer({ min: 4, max: 16 });
  console.log(`🔧 Retrieving ${userMessageCount} previous messages for ${username}`);
  try {
    const userMessages = await getUserMessageHistory(username, userMessageCount);
    userMessages.reverse();
    userMessages.forEach((message) => {
      messages.push({
        role: "user",
        content: `${message.value}`,
      });
    });
  } catch (error) {
    console.error("Error getting previous user messages:", error);
  }
}

async function addUserMemories(username, messages) {
  const userMemoryCount = chance.integer({ min: 1, max: 12 });
  try {
    const userMemories = await getUserMemory(username, userMemoryCount);
    console.log(`🔧 Retrieving ${userMemoryCount} memories for ${username}`);
    userMemories.forEach((memory) => {
      messages.push({
        role: "system",
        content: `You remember from a previous interaction on ${memory.created_at}: ${memory.value}`,
      });
    });
  } catch (err) {
    console.log(err);
  }
}

function splitMessageIntoChunks(messageString) {
  if (typeof messageString !== "string") {
    console.error("splitMessageIntoChunks: messageString is not a string");
    return;
  }
  const messageArray = splitMessageIntoArray(messageString);
  return splitArrayIntoChunks(messageArray);
}

function splitMessageIntoArray(messageString) {
  return messageString.split(" ");
}

function splitArrayIntoChunks(messageArray) {
  const messageChunks = [];
  let currentChunk = "";
  for (let i = 0; i < messageArray.length; i++) {
    const word = messageArray[i];
    if (isChunkSizeAcceptable(currentChunk, word)) {
      currentChunk += word + " ";
    } else {
      messageChunks.push(currentChunk);
      currentChunk = word + " ";
    }
  }
  messageChunks.push(currentChunk);
  return messageChunks;
}

function isChunkSizeAcceptable(currentChunk, word) {
  return currentChunk.length + word.length < 2000;
}

/**
 * Splits a message into chunks and sends them as separate messages.
 *
 * @param {string} message - The message to be split and sent.
 * @param {object} channel - The channel to send the message to.
 * @returns {void}
 */
function splitAndSendMessage(message, channel) {
  if (!channel) {
    console.error("splitAndSendMessage: messageObject is null or undefined");
    return;
  }
  if (typeof message !== "string") {
    console.error("splitAndSendMessage: message is not a string");
    return;
  }
  if (message.length < 2000) {
    try {
      channel.send(message);
    } catch (e) {
      console.error(e);
    }
  } else {
    const messageChunks = splitMessageIntoChunks(message);
    for (let i = 0; i < messageChunks.length; i++) {
      try {
        channel.send(messageChunks[i]);
      } catch (error) {
        console.error(error);
      }
    }
  }
}


function createTokenLimitWarning() {
  return {
    role: "user",
    content:
      "It looks like you are reaching the token limit. In the next response, please do not use a capability. Use all of this information to summarize a response.",
  };
}

function isExceedingTokenLimit(messages) {
  return countMessageTokens(messages) > TOKEN_LIMIT;
}

function destructureArgs(args) {
  return args.split(",").map((arg) => arg.trim());
}

function getHexagram() {
  const hexagramNumber = chance.integer({ min: 1, max: 64 });
  const hexNameMap = {
    1: "The Creative",
    2: "The Receptive",
    3: "Difficulty at the Beginning",
    4: "Youthful Folly",
    5: "Waiting",
    6: "Conflict",
    7: "The Army",
    8: "Holding Together",
    9: "The Taming Power of the Small",
    10: "Treading",
    11: "Peace",
    12: "Standstill",
    13: "Fellowship with Men",
    14: "Possession in Great Measure",
    15: "Modesty",
    16: "Enthusiasm",
    17: "Following",
    18: "Work on What Has Been Spoiled",
    19: "Approach",
    20: "Contemplation",
    21: "Biting Through",
    22: "Grace",
    23: "Splitting Apart",
    24: "Return",
    25: "Innocence",
    26: "The Taming Power of the Great",
    27: "The Corners of the Mouth",
    28: "Preponderance of the Great",
    29: "The Abysmal",
    30: "The Clinging",
    31: "Influence",
    32: "Duration",
    33: "Retreat",
    34: "The Power of the Great",
    35: "Progress",
    36: "Darkening of the Light",
    37: "The Family",
    38: "Opposition",
    39: "Obstruction",
    40: "Deliverance",
    41: "Decrease",
    42: "Increase",
    43: "Breakthrough",
    44: "Coming to Meet",
    45: "Gathering Together",
    46: "Pushing Upward",
    47: "Oppression",
    48: "The Well",
    49: "Revolution",
    50: "The Cauldron",
    51: "The Arousing (Shock, Thunder)",
    52: "Keeping Still (Mountain)",
    53: "Development (Gradual Progress)",
    54: "The Marrying Maiden",
    55: "Abundance (Fullness)",
    56: "The Wanderer",
    57: "The Gentle (Wind)",
    58: "The Joyous (Lake)",
    59: "Dispersion (Dissolution)",
    60: "Limitation",
    61: "Inner Truth",
    62: "Preponderance of the Small",
    63: "After Completion",
    64: "Before Completion",
  };

  return `${hexagramNumber}. ${hexNameMap[hexagramNumber]}`;
}

function countTokens(str) {
  const encodedMessage = encode(str.toString());
  const tokenCount = encodedMessage.length;
  return tokenCount;
}

function countMessageTokens(messageArray = []) {
  let totalTokens = 0;
  // console.log("Message Array: ", messageArray);
  if (!messageArray) {
    return totalTokens;
  }
  if (messageArray.length === 0) {
    return totalTokens;
  }

  // for loop
  for (let i = 0; i < messageArray.length; i++) {
    const message = messageArray[i];
    // encode message.content
    const encodedMessage = encode(JSON.stringify(message));
    totalTokens += encodedMessage.length;
  }

  return totalTokens;
}

module.exports = {
  ERROR_MSG,
  TOKEN_LIMIT,
  RESPONSE_LIMIT,
  WARNING_BUFFER,
  destructureArgs,
  getHexagram,
  countTokens,
  countMessageTokens,
  removeMentionFromMessage,
  replaceRobotIdWithName,
  doesMessageContainCapability,
  isBreakingMessageChain,
  trimResponseIfNeeded,
  generateAiCompletionParams,
  displayTypingIndicator,
  generateAiCompletion,
  assembleMessagePreamble,
  splitMessageIntoChunks,
  splitAndSendMessage,
  createTokenLimitWarning,
  isExceedingTokenLimit,
};
