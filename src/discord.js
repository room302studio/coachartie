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

  messages.push(aiResponse);

  return processMessageChain(aiResponse, messages);
}

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
  // if there are no messages, return an empty array
  if (!messages.length) {
    return [];
  }

  // get the last message in the chain
  const lastMessage = messages[messages.length - 1];
  // get the current token count
  const currentTokenCount = countMessageTokens(messages);
  console.log("Current token count: ", currentTokenCount);

  // set the token limit
  const apiTokenLimit = 8000;

  // grab the system intro, memories, and user memories to enhance our response
  const preamble = await assembleMessagePreamble(username, client);

  // combine the preamble with the messages
  messages = [...preamble, ...messages];

  // check if the last message contains a capability method
  // which looks like this: `capability:method(args)`
  const capabilityMatch = lastMessage.content.match(capabilityRegex);

  // if there is no capability method, and the last message is not a user message, break the chain
  if (
    !capabilityMatch &&
    lastMessage.role !== "user" &&
    lastMessage.role !== "system"
  ) {
    console.log("No capability found in the last message, breaking the chain.");
    return messages;
  }

  // if there is a capability method, call it
  if (capabilityMatch) {
    // we need to destruct the capabilityMatch array to get the slug, method, and args
    const [_, capSlug, capMethod, capArgs] = capabilityMatch;

    // if the token count is about to exceed the limit, add a system message to the chain
    if (currentTokenCount >= apiTokenLimit - 900) {
      console.log(
        "Token limit reached, adding system message to the chain reminding the bot to wrap it up."
      );
      messages.push({
        role: "user",
        content:
          "It looks like you are reaching the token limit. In the next response, please do not use a capability. Use all of this information to summarize a response.",
      });
    }

    // call the capability method
    let capabilityResponse;
    try {
      capabilityResponse = await callCapabilityMethod(
        capSlug,
        capMethod,
        capArgs
      );
    } catch (e) {
      consolelog2(e);
      capabilityResponse = "Capability error: " + e;
    }

    consolelog3("Capability response: ", capabilityResponse);

    // check the token size of the response, and trim it down if it's too long
    while (countTokens(capabilityResponse) > 5120) {
      console.log(
        `Response is too long ${countTokens(
          capabilityResponse
        )}, trimming it down.`
      );
      capabilityResponse = trimResponseByLineCount(
        capabilityResponse,
        countTokens(capabilityResponse)
      );
    }

    messages.push({
      role: "system",
      content: `Capability ${capSlug}:${capMethod} responded with: ${capabilityResponse}`,
    });
  }

  console.log("📝 Message chain:");
  messages.forEach((msg) => {
    console.log(`- ${msg.role}: ${msg.content}`);
  });

  const temperature = chance.floating({ min: 0.4, max: 1.25 });
  const presence_penalty = chance.floating({ min: 0.2, max: 0.66 });

  console.log("🌡️ Temp: ", temperature);
  console.log("👻 Presence: ", presence_penalty);

  if (countMessageTokens(messages) > 8000) {
    console.log("Total tokens is over 8000, trimming the message chain.");
    messages = trimMessageChain(messages);
    console.log("Message chain trimmed.");
  }

  return generateAiCompletion(messages, {
    temperature,
    presence_penalty,
  });
}

async function processMessageAndSendResponse(
  message,
  chainMessageStart,
  username
) {
  const response = await processMessageChain(
    message,
    chainMessageStart,
    username
  );
  const robotResponse = response[response.length - 1].content;

  // Split and send the response
  splitAndSendMessage(robotResponse, message);

  return robotResponse;
}
function logMessageAndResponse(log) {
  // Log the JSON object to the console with pretty formatting
  console.log(JSON.stringify(log, null, 2));
  console.log(log.remember);

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
  await storeUserMessage(username, message);

  const rememberMessage = await generateAndStoreRememberCompletion(
    username,
    message.content,
    robotResponse
  );

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
      const robotResponse = await processMessageAndSendResponse(
        message,
        chainMessageStart,
        username
      );

      // end typing indicator
      clearInterval(typing);

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
