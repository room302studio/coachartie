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
const TOKEN_LIMIT = 8000;
const RESPONSE_LIMIT = 5120;
const WARNING_BUFFER = 900;

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

// trimMessageChain: trim the message chain until it's under 8000 tokens
function trimMessageChain(messages, maxTokens = 8000) {
  // trim the messages until the total tokens is under 8000
  while (countMessageTokens(messages) > maxTokens) {
    // pick a random message to consider trimming
    const messageToRemove = chance.pickone(messages);

    // trim down the message.content to 1/2 of the original length
    const trimmedMessageContent = messageToRemove.content.slice(
      0,
      messageToRemove.content.length / 2
    );

    // replace the message with the trimmed version
    messageToRemove.content = trimmedMessageContent;

    // if the message is now empty, remove it from the messages array
    if (messageToRemove.content.length === 0) {
      messages = messages.filter((message) => {
        return message !== messageToRemove;
      });
    }

    // if the messages array is now empty, break out of the loop
    if (messages.length === 0) {
      break;
    }
  }
  console.log("Message chain trimmed.");
  return messages;
}

// trimResponseByLineCount: trim the response by a certain percentage
function trimResponseByLineCount(response, lineCount, trimAmount = 0.1) {
  const lines = response.split("\n");
  // we are going to remove 10% of the lines
  const linesToRemove = Math.floor(lineCount * trimAmount);
  // pick some random lines to remove
  const randomLines = chance.pickset(lines, linesToRemove);
  // filter out the random lines
  const trimmedLines = lines.filter((line) => {
    return !randomLines.includes(line);
  });
  // join the lines back together
  return trimmedLines.join("\n");
}

function displayTypingIndicator(message) {
  // Start typing indicator
  message.channel.sendTyping();
  const typingInterval = setInterval(() => message.channel.sendTyping(), 5000);
  return typingInterval; // To allow for clearing the interval outside of this function
}

async function generateAiCompletion(prompt, username, messages, config) {
  const { temperature, presence_penalty } = config;

  // add the preamble to the messages
  messages = await addPreambleToMessages(username, prompt, messages);

  let completion = null;
  try {
    completion = await openai.createChatCompletion({
      model: "gpt-4-1106-preview",
      // model: "gpt-4",
      // model: "gpt-3.5-turbo-16k",
      temperature,
      presence_penalty,
      max_tokens: 820,
      messages: messages,
    });
  } catch (err) {
    console.log(err);
  }

  const aiResponse = completion.data.choices[0].message.content;
  console.log("🤖 AI Response:", aiResponse);

  messages.push(aiResponse);

  return { messages, aiResponse };
}

async function addPreambleToMessages(username, prompt, messages) {
  const preamble = await assembleMessagePreamble(username, prompt);
  // messages.unshift(preamble);
  // we need to make sure we return a flat array
  // console.log('preamble', preamble)
  // console.log('flattened', messages.flat())
  // console.log('combined', [preamble, ...messages.flat()])
  return [...preamble, ...messages.flat()];
}

async function assembleMessagePreamble(username, prompt) {
  console.log(`🔧 Assembling message preamble for <${username}> ${prompt}`);

  const messages = [];

  // add the current date and time as a system message
  messages.push({
    role: "system",
    content: `Today is ${new Date().toLocaleDateString()} at ${new Date().toLocaleTimeString()}`,
  });

  // randomly add a hexagram prompt
  if (chance.bool({ likelihood: 50 })) {
    // pick a random hexagram from the i ching to guide this interaction
    const hexagramPrompt = `Let this hexagram from the I Ching guide this interaction: ${getHexagram()}`;

    console.log(`🔧 Adding hexagram prompt to message ${hexagramPrompt}`);
    messages.push({
      role: "system",
      content: hexagramPrompt,
    });
  }

  // add the system prompt
  messages.push({
    role: "user",
    content: PROMPT_SYSTEM,
  });

  // Add the capability prompt intro
  messages.push({
    role: "system",
    content: CAPABILITY_PROMPT_INTRO,
  });

  // Decide how many user messages to retrieve
  const userMessageCount = chance.integer({ min: 4, max: 16 });

  console.log(
    `🔧 Retrieving ${userMessageCount} previous messages for ${username}`
  );

  // wrap in try/catch
  try {
    // get user messages
    const userMessages = await getUserMessageHistory(
      username,
      userMessageCount
    );

    // reverse the order of the messages so the most recent ones are last
    userMessages.reverse();

    // turn previous user messages into chatbot-formatted messages
    userMessages.forEach((message) => {
      messages.push({
        role: "user",
        // content: `${replaceRobotIdWithName(message.value, client)}`,
        content: `${message.value}`,
      });

      // if this is the last message, return
      if (message === userMessages[userMessages.length - 1]) return;

      // otherwise add a new message placeholder for the assistant response
      // messages.push({
      //   role: "assistant",
      //   content: "[RESPONSE]",
      // });
    });
  } catch (error) {
    console.error("Error getting previous user messages:", error);
  }

  const userMemoryCount = chance.integer({ min: 1, max: 12 });
  try {
    // // get user memories
    const userMemories = await getUserMemory(username, userMemoryCount);

    console.log(`🔧 Retrieving ${userMemoryCount} memories for ${username}`);

    // turn user memories into chatbot messages
    userMemories.forEach((memory) => {
      messages.push({
        role: "system",
        content: `You remember from a previous interaction on ${memory.created_at}: ${memory.value}`,
      });

      // console.log(`🔧 Adding memory to message ${memory.value}`);
    });
  } catch (err) {
    console.log(err);
  }

  // TODO: Get relevant memories working using embedding query
  // get relevant user memories
  // const relevantUserMemories = await getRelevantMemories(prompt, userMemoryCount);
  // if (relevantUserMemories) {
  //   // add all of those memories to the messages
  //   relevantUserMemories.forEach((memory) => {
  //     messages.push({
  //       role: "system",
  //       content: `You remember from a previous interaction on ${memory.created_at}: ${memory.value}`,
  //     });
  //   });
  // }

  return messages;
}

function splitMessageIntoChunks(messageString) {
  // make sure the string is a string
  if (typeof messageString !== "string") {
    console.error("splitMessageIntoChunks: messageString is not a string");
    return;
  }
  const messageArray = messageString.split(" ");
  const messageChunks = [];
  let currentChunk = "";
  for (let i = 0; i < messageArray.length; i++) {
    const word = messageArray[i];
    if (currentChunk.length + word.length < 2000) {
      currentChunk += word + " ";
    } else {
      messageChunks.push(currentChunk);
      currentChunk = word + " ";
    }
  }
  messageChunks.push(currentChunk);
  return messageChunks;
}

function splitAndSendMessage(message, messageObject) {
  // messageObject is the discord message object
  // message is the string we want to send
  // make sure the messageObject is not null or undefined
  if (!messageObject) {
    console.error("splitAndSendMessage: messageObject is null or undefined");
    return;
  }
  // make sure the message is a string
  if (typeof message !== "string") {
    console.error("splitAndSendMessage: message is not a string");
    return;
  }

  if (message.length < 2000) {
    try {
      messageObject.channel.send(message);
    } catch (e) {
      console.error(e);
    }
  } else {
    const messageChunks = splitMessageIntoChunks(message);
    for (let i = 0; i < messageChunks.length; i++) {
      try {
        messageObject.channel.send(messageChunks[i]);
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
