const { Chance } = require("chance");
const chance = new Chance();
const dotenv = require("dotenv");
const { capabilityRegex } = require("./src/capabilities.js");
dotenv.config();

// const { generateAndStoreRememberCompletion } = require("./memory.js");

// 📚 GPT-3 token-encoder: our linguistic enigma machine
const { encode, decode } = require("@nem035/gpt-3-encoder");

// 🤖 replaceRobotIdWithName: given a string, replace the robot id with the robot name
function replaceRobotIdWithName(string, client) {
  // TODO: We need to get the client from discord somehow

  // console.log("Replacing robot id with name");
  const coachArtieId = client.user.id;
  // console.log("coachArtieId", coachArtieId);
  const coachArtieName = client.user.username;
  // console.log("coachArtieName", coachArtieName);

  // console.log("Before replace", string);
  const replaced = string.replace(`<@!${coachArtieId}>`, coachArtieName);
  // console.log("After replace", replaced);
  return replaced;
}

function destructureArgs(args) {
  return args.split(",").map((arg) => arg.trim());
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

// 🔪 removeMentionFromMessage: slice out the mention from the message
function removeMentionFromMessage(message, mention) {
  return message.replace(mention, "").trim();
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

function doesMessageContainCapability(message) {
  console.log('does message exist in the helper?', message)
  return message.match(capabilityRegex);
}

function isBreakingMessageChain(capabilityMatch, lastMessage) {
  return (
    !capabilityMatch &&
    lastMessage.role !== "user" &&
    lastMessage.role !== "system"
  );
}

function trimResponseIfNeeded(capabilityResponse) {
  // Step 4: Check if the capability response exceeds the token limit
  while (countTokens(capabilityResponse) > RESPONSE_LIMIT) {
    // Step 5: Trim the response by line count to reduce the token count
    capabilityResponse = trimResponseByLineCount(
      capabilityResponse,
      countTokens(capabilityResponse)
    );
  }
  return capabilityResponse;
}

function generateAiCompletionParams() {
  // temp
  const temperature = chance.floating({ min: 0.88, max: 1.2 });
  // presence
  const presence_penalty = chance.floating({ min: -0.05, max: 0.05 });
  // frequency
  const frequency_penalty = chance.floating({ min: 0.0, max: 0.05 });

  return { temperature, presence_penalty, frequency_penalty };
}

const ERROR_MSG = `I am so sorry, there was some sort of problem. Feel free to ask me again, or try again later.`;

const TOKEN_LIMIT = 8000;
const RESPONSE_LIMIT = 5120;
const WARNING_BUFFER = 900;

module.exports = {
  destructureArgs,
  getHexagram,
  countTokens,
  countMessageTokens,
  removeMentionFromMessage,
  ERROR_MSG,
  replaceRobotIdWithName,
  doesMessageContainCapability,
  isBreakingMessageChain,
  trimResponseIfNeeded,
  TOKEN_LIMIT,
  RESPONSE_LIMIT,
  WARNING_BUFFER,
  generateAiCompletionParams,
};
