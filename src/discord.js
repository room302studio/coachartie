// Our collection of ethereal tech tools and righteous scripts
const { Client, GatewayIntentBits, Events } = require("discord.js");
// const {
//   consolelog2,
//   consolelog3,
//   consolelog4,
// } = require("./logging");

// make empty console logs for now
const consolelog2 = (message) => {
  console.log(message);
};
const consolelog3 = (message) => {
  console.log(message);
};
const consolelog4 = (message) => {
  console.log(message);
};

const { openai } = require("./openai");
const {
  assembleMessagePreamble,
  generateAndStoreRememberCompletion,
} = require("./memory.js");
const { storeUserMessage } = require("../capabilities/remember");
const { callCapabilityMethod, capabilityRegex } = require("./capabilities.js");
const { scheduleRandomMessage } = require("./scheduling.js");
const {
  countTokens,
  countMessageTokens,
  ERROR_MSG,
  removeMentionFromMessage,
} = require("../helpers.js");
const chance = require("chance").Chance();
const fs = require("fs");

// 🌿 dotenv: As graceful as a morning dew drop, simplifying process.env access since 2012!
const dotenv = require("dotenv");
dotenv.config();

// A whole heap of essential variables & functions ahead...
let client;

// 💫 Ready, set... wait! We let Discord know that we're ready to perform!
function onClientReady(c) {
  console.log(`⭐️ Ready! Logged in as ${c.user.username}`);
  console.log("\n🌐 Connected servers and channels:");
  client.guilds.cache.forEach((guild) => {
    console.log(` - ${guild.name}`);
  });
}

async function generateAiCompletion(messages, config) {
  const { temperature, presence_penalty } = config;
  const completion = await openai.createChatCompletion({
    model: "gpt-4",
    // model: "gpt-3.5-turbo-16k",
    temperature,
    presence_penalty,
    max_tokens: 820,
    messages: messages,
  });

  const aiResponse = await completion.data.choices[0].message;
  consolelog4("🤖 AI Response:", aiResponse);

  messages.push(aiResponse);

  return await processMessageChain(aiResponse, messages);
}

const TOKEN_LIMIT = 8000;
const RESPONSE_LIMIT = 5120;
const WARNING_BUFFER = 900;

/**
 * 📝 processMessageChain: a function for processing message chains
 * The purpose of this function is to take a message chain, and process it based on certain parameters.
 * If the token count of the message is about to exceed a set limit, a "system message" is added at the bot's position reminding it to keep within the limits.
 * If a capability method is found in the last message, the method is called, and then the response is trimmed down to meet the token limit.
 * The function also generates values for temperature and presence penalties.
 * Finally, all the processed messages are returned along with the mentioned AI Completion parameters.
 *
 * @param {Object} message - The message context the bot is working with
 * @param {Array} messages - An array of message objects in the chain
 * @param {String} username - The username of the receiver of the message, used to assemble the preamble
 * @return {Array} - All processed messages along with AI Completion parameters
 */
async function processMessageChain(message, messages, username) {
  if (!messages.length) return [];

  consolelog2("📝 Processing message chain...");

  // Add preamble to messages
  messages = await addPreambleToMessages(username, messages, message.content);

  // If the last message contains a capability, process it
  if (doesMessageContainCapability(messages[messages.length - 1])) {
    messages = await processCapabilityInLastMessage(messages);
  }

  return await generateAiCompletion(messages, generateAiParameters());
}

async function processCapabilityInLastMessage(messages) {
  const lastMessage = messages[messages.length - 1];
  const capabilityMatch = lastMessage.content.match(capabilityRegex);

  if (isBreakingMessageChain(capabilityMatch, lastMessage)) return messages;

  if (capabilityMatch) {
    const [_, capSlug, capMethod, capArgs] = capabilityMatch;
    const currentTokenCount = countMessageTokens(messages);

    if (currentTokenCount >= TOKEN_LIMIT - WARNING_BUFFER) {
      messages.push(createTokenLimitWarning());
    }

    const capabilityResponse = await getCapabilityResponse(
      capSlug,
      capMethod,
      capArgs
    );

    messages.push({
      role: "system",
      content: `Capability ${capSlug}:${capMethod} responded with: ${capabilityResponse}`,
    });
  }

  return isExceedingTokenLimit(messages)
    ? trimMessageChain(messages)
    : messages;
}

async function processMessageAndSendResponse(
  message,
  chainMessageStart,
  username
) {
  try {
    // Initialize the response with the chainMessageStart
    let response = chainMessageStart;

    // Initialize the messages array with the chainMessageStart
    let messages = [chainMessageStart];

    // If the message content is not empty, add it to the messages array
    if (message.content.length > 0) {
      messages.push({
        role: "user",
        content: removeMentionFromMessage(message.content),
      });
    }

    // Process the messages in the messages array
    const processedMessages = await processMessageChain(
      message,
      messages,
      username
    );

    // For each message in the processedMessages array
    for (let i = 0; i < processedMessages.length; i++) {
      const message = processedMessages[i];
      const { role, content } = message;

      // If the role is user, add the content to the response
      if (role === "user") {
        response += `\n${content}`;

        // If the role is system, add the content to the response
      } else if (role === "system") {
        response += `\n\n${content}`;

        // If the role is bot, add the content to the response
      } else {
        response += `\n\n${content}`;
      }
    }

    // Send the response to the channel where the initial message was sent
    await splitAndSendMessage(message, response);
  } catch (error) {
    console.error(error);
  }
}

async function addPreambleToMessages(username, messages, message) {
  const preamble = await assembleMessagePreamble(username, client, message);
  messages.unshift(preamble);
  return messages;
}

function isBreakingMessageChain(capabilityMatch, lastMessage) {
  return (
    !capabilityMatch &&
    lastMessage.role !== "user" &&
    lastMessage.role !== "system"
  );
}

function doesMessageContainCapability(message) {
  return message.content.match(capabilityRegex);
}

function createTokenLimitWarning() {
  return {
    role: "user",
    content:
      "It looks like you are reaching the token limit. In the next response, please do not use a capability. Use all of this information to summarize a response.",
  };
}

async function getCapabilityResponse(capSlug, capMethod, capArgs) {
  let capabilityResponse;
  try {
    capabilityResponse = await callCapabilityMethod(
      capSlug,
      capMethod,
      capArgs
    );
  } catch (e) {
    console.error(e);
    capabilityResponse = "Capability error: " + e;
  }

  return trimResponseIfNeeded(capabilityResponse);
}

function trimResponseIfNeeded(capabilityResponse) {
  while (countTokens(capabilityResponse) > RESPONSE_LIMIT) {
    capabilityResponse = trimResponseByLineCount(
      capabilityResponse,
      countTokens(capabilityResponse)
    );
  }
  return capabilityResponse;
}

function isExceedingTokenLimit(messages) {
  return countMessageTokens(messages) > TOKEN_LIMIT;
}

function generateAiParameters() {
  return {
    temperature: chance.floating({ min: 0.4, max: 1.25 }),
    presence_penalty: chance.floating({ min: 0.2, max: 0.66 }),
  };
}

function logMessageAndResponse(log) {
  // Log the JSON object to the console with pretty formatting
  // console.log(JSON.stringify(log, null, 2));
  // console.log(log.remember);

  // Append the log to the artie.log file as a single line
  fs.appendFile(
    "artie.log",
    `\n${JSON.stringify(log)}`,
    { flag: "a+" },
    (err) => {
      if (err) throw err;
      console.log("📝 Log saved to artie.log");
    }
  );
}

async function storeMessageAndRemember(username, message, robotResponse) {
  // Save the message to the database
  try {
    await storeUserMessage(username, message);
  } catch (err) {
    console.log("Error storing user message: " + err);
  }

  let rememberMessage

  try {
    rememberMessage = await generateAndStoreRememberCompletion(
      username,
      message.content,
      robotResponse
    );
  } catch (err) {
    console.error(err);
  }

  // Log and return
  console.log(`🧠 Message saved to database: ${message.content}`);
  console.log(
    `🧠 Memory saved to database: ${JSON.stringify(rememberMessage)}`
  );

  return rememberMessage;
}

// 🌐 Displaying all guilds & channels we're connected to!
function logGuildsAndChannels() {
  console.log("\n🌐 Connected servers and channels:");
  client.guilds.cache.forEach((guild) => {
    console.log(` - ${guild.name}`);
  });
}

function splitMessageIntoChunks(messageString) {
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

// 📤 splitAndSendMessage: a reliable mailman for handling lengthy messages
function splitAndSendMessage(message, messageObject) {
  // messageObject is the discord message object
  // message is the string we want to send
  // make sure the messageObject is not null or undefined
  if (!messageObject) return message.channel.send(ERROR_MSG);
  if (!message) return messageObject.channel.send(ERROR_MSG);

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

// 🤖 detectBotMentionOrChannel: Detecting if the bot was mentioned or if the channel name includes a bot
function detectBotMentionOrChannel(message) {
  const botMentioned = message.mentions.has(client.user);
  const channelName = message.channel.name;
  const channelNameHasBot = channelName.includes("🤖");

  return !message.author.bot && (botMentioned || channelNameHasBot);
}

// displayTypingIndicator: Start typing indicator
function displayTypingIndicator(message) {
  // Start typing indicator
  message.channel.sendTyping();
  const typingInterval = setInterval(() => message.channel.sendTyping(), 5000);
  return typingInterval; // To allow for clearing the interval outside of this function
}

// 💌 onMessageCreate: Crucial, as life itself- translating gibberish to meaningful chats!
async function onMessageCreate(message) {
  try {
    const botMentioned = message.mentions.has(client.user);
    const username = message.author.username;

    // Detecting if the bot was mentioned or if the channel name includes a bot
    // second argument is channel name
    const channelNameHasBot = detectBotMentionOrChannel(message);

    if (!message.author.bot && (botMentioned || channelNameHasBot)) {
      const typing = displayTypingIndicator(message);

      const prompt = removeMentionFromMessage(message.content, "@coachartie");
      const chainMessageStart = [
        {
          role: "user",
          content: prompt,
        },
      ];
      try {
        const robotResponse = await processMessageAndSendResponse(
          message,
          chainMessageStart,
          username
        );

        splitAndSendMessage(robotResponse, message);

        const rememberMessage = await storeMessageAndRemember(
          message.author.username,
          message.content,
          robotResponse
        );

        const log = {
          user: message.author.username,
          message: message.content,
          response: robotResponse,
          remember: rememberMessage,
        };

        logMessageAndResponse(log);
      } catch (error) {
        console.error(error);
        await message.react("❌");
      }

      // end typing indicator
      clearInterval(typing);
    }
  } catch (error) {
    consolelog2(error);
  }
}

// 🤖 Assembling the Discord bot client!
class DiscordBot {
  constructor() {
    this.bot = new Client({
      intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent,
        GatewayIntentBits.GuildMessageReactions,
      ],
    });
    this.bot.login(process.env.DISCORD_BOT_TOKEN);
    this.bot.on("ready", onClientReady);
    this.bot.on("messageCreate", onMessageCreate);

    // The sentient moment 🙌
    client = this.bot;
  }

  async sendMessage(message, channel) {
    try {
      await channel.send(message);
    } catch (error) {
      console.log(error);
    }
  }

  async sendEmbedMessage(message, channel) {
    try {
      await channel.send({ embeds: [message] });
    } catch (error) {
      console.log(error);
    }
  }
}

module.exports = DiscordBot;
