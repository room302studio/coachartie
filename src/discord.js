// Our collection of ethereal tech tools and righteous scripts
const {
  Client,
  GatewayIntentBits,
  Events,
} = require("discord.js");
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
const {
  callCapabilityMethod,
  capabilityRegex,
} = require("./capabilities.js"); 
const { scheduleRandomMessage } = require("./scheduling.js"); 
const {
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
  logGuildsAndChannels();
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

function trimResponseByLineCount(response, lineCount) {
  const lines = response.split("\n");
  const linesToRemove = Math.floor(lineCount * 0.1);
  const randomLines = chance.pickset(lines, linesToRemove);
  const trimmedLines = lines.filter((line) => {
    return !randomLines.includes(line);
  });
  return trimmedLines.join("\n");
}

function detectBotMentionOrChannel(message) {
  const botMentioned = message.mentions.has(client.user);
  const channelName = message.channel.name;
  const channelNameHasBot = channelName.includes("🤖");

  return (!message.author.bot && (botMentioned || channelNameHasBot));
}

function displayTypingIndicator(message) {
  // Start typing indicator
  const typingInterval = setInterval(
      () => message.channel.sendTyping(),
      5000
  );
  return typingInterval; // To allow for clearing the interval outside of this function
}

// 🌈 onClientReady: our bot's grand entrance to the stage
function onClientReady(c) {
  console.log(`⭐️ Ready! Logged in as ${c.user.username}`);
  logGuildsAndChannels();
  // scheduleRandomMessage();
}

// 📦 logGuildsAndChannels: a handy helper for listing servers and channels
function logGuildsAndChannels() {
  console.log("\n🌐 Connected servers and channels:");
  client.guilds.cache.forEach((guild) => {
    console.log(` - ${guild.name}`);
  });
}

function trimMessageChain(messages) {
  // trim the messages until the total tokens is under 8000
  while (countMessageTokens(messages) > 8000) {
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

async function generateAiCompletion (messages, config) {
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

// 📝 processMessageChain: a function for processing message chains
async function processMessageChain(message, messages, username) {
  if (!messages.length) {
    return [];
  }

  const lastMessage = messages[messages.length - 1];
  const currentTokenCount = countMessageTokens(messages);
  console.log("Current token count: ", currentTokenCount);

  const apiTokenLimit = 8000;

  const preamble = await assembleMessagePreamble(username, client);
  messages = [...preamble, ...messages];

  const capabilityMatch = lastMessage.content.match(capabilityRegex);

  if (!capabilityMatch && lastMessage.role !== "user" && lastMessage.role !== "system") {
    console.log("No capability found in the last message, breaking the chain.");
    return messages;
  }

  if (capabilityMatch) {
    const [_, capSlug, capMethod, capArgs] = capabilityMatch;

    if (currentTokenCount >= apiTokenLimit - 900) {
      console.log("Token limit reached, adding system message to the chain reminding the bot to wrap it up.");
      messages.push({
        role: "user",
        content:
          "It looks like you are reaching the token limit. In the next response, please do not use a capability. Use all of this information to summarize a response.",
      });
    }

    splitAndSendMessage(lastMessage.content, message);

    let capabilityResponse;

    try {
      capabilityResponse = await callCapabilityMethod(capSlug, capMethod, capArgs);
    } catch (e) {
      consolelog2(e);
      capabilityResponse = "Capability error: " + e;
    }

    consolelog3("Capability response: ", capabilityResponse);
    while (countTokens(capabilityResponse) > 5120) {
      console.log(`Response is too long ${countTokens(capabilityResponse)}, trimming it down.`);
      capabilityResponse = trimResponseByLineCount(capabilityResponse, countTokens(capabilityResponse));
    }

    const trimmedCapabilityResponse = capabilityResponse;

    try {
      // splitAndSendMessage(trimmedCapabilityResponse, message);
    } catch (e) {
      console.log("Error sending message: ", e);
    }

    messages.push({
      role: "system",
      content: `Capability ${capSlug}:${capMethod} responded with: ${trimmedCapabilityResponse}`,
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

  console.log('messages')
  console.log(messages)

  return generateAiCompletion(messages, {
    temperature,
    presence_penalty
  });
}

async function processMessageAndSendResponse(message, chainMessageStart, username) {
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
  console.log(`🧠 Memory saved to database: ${JSON.stringify(rememberMessage)}`);

  return rememberMessage;
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

      // deliver the response to the user!
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