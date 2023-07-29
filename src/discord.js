// Our collection of ethereal tech tools and righteous scripts
const { Client, GatewayIntentBits, Events } = require("discord.js");
// const { consolelog2, consolelog3, consolelog4 } = require("./logging");

// make empty console logs for now
// const consolelog2 = (message) => {
//   console.log(message);
// };
// const consolelog3 = (message) => {
//   console.log(message);
// };
// const consolelog4 = (message) => {
//   console.log(message);
// };

const { openai } = require("./openai");
const {
  generateAndStoreRememberCompletion,
} = require("./memory.js");
const { storeUserMessage, getUserMemory, getUserMessageHistory, getAllMemories, storeUserMemory, getRelevantMemories } = require("../capabilities/remember");
const { callCapabilityMethod, capabilityRegex } = require("./capabilities.js");
const { scheduleRandomMessage } = require("./scheduling.js");
const {
  getHexagram,
  countTokens,
  countMessageTokens,
  ERROR_MSG,
  removeMentionFromMessage,
  doesMessageContainCapability,
  generateAiCompletionParams,
} = require("../helpers.js");
const chance = require("chance").Chance();
const fs = require("fs");

// 📜 prompts: our guidebook of conversational cues
const prompts = require("../prompts");
const { PROMPT_SYSTEM, PROMPT_REMEMBER, PROMPT_REMEMBER_INTRO, CAPABILITY_PROMPT_INTRO } = prompts;

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

/**
 * 📝 processMessageChain: a function for processing message chains
 * The purpose of this function is to take a message chain, and process it based on certain parameters.
 * If the token count of the message is about to exceed a set limit, a "system message" is added at the bot's position reminding it to keep within the limits.
 * If a capability method is found in the last message, the method is called, and then the response is trimmed down to meet the token limit.
 * The function also generates values for temperature and presence penalties.
 * Finally, all the processed messages are returned along with the mentioned AI Completion parameters.
 *
 * @param {Object} message - The discord message context the bot is working with
 * @param {Array} messages - An array of message objects in the chain
 * @param {String} username - The username of the receiver of the message, used to assemble the preamble
 * @return {Array} - All processed messages along with AI Completion parameters
 */
async function processMessageChain(message, messages, username) {
  // Check if the messages array is empty
  if (!messages.length) {
    console.log("🤖 Processing empty message chain...");
    return [];
  }

  // Step 1: Add preamble to messages
  // messages = await addPreambleToMessages(username, messages, message.content);

  // Get the last message in the chain
  const lastMessage = messages[messages.length - 1];

  // Step 2: Check if the last message contains a capability
  if (doesMessageContainCapability(lastMessage.content)) {
    console.log("🤖 Processing message chain...", lastMessage.content);

    // Extract the capability information from the last message
    const capabilityMatch = lastMessage.content.match(capabilityRegex);
    if (capabilityMatch) {
      const [_, capSlug, capMethod, capArgs] = capabilityMatch;

      // Calculate the current token count in the message chain
      const currentTokenCount = countMessageTokens(messages);

      // Step 2a: Check if the message chain is about to exceed the token limit
      if (currentTokenCount >= TOKEN_LIMIT - WARNING_BUFFER) {
        messages.push(createTokenLimitWarning());
      }

      // Step 2b: Process the capability and add the system response
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
  }

  // get the last message from a user in the chain
  const lastUserMessage = messages.find((m) => m.role === "user");
  const prompt = lastUserMessage.content;

  // Step 3: Generate AI response based on the messages, and generating the AI Completion parameters
  const { temperature, frequency_penalty } = generateAiCompletionParams();
  const { aiResponse } = await generateAiCompletion(
    prompt,
    username,
    messages,
    {
      temperature,
      frequency_penalty,
    }
  );

  // Step 4: Split and send the AI response back to the user through discord
  await splitAndSendMessage(aiResponse, message);

  // Step 5: Store the user message in the database
  storeUserMessage(username, prompt)

  // Step 6: Make a memory about the interaction and store THAT in the database
  await generateAndStoreRememberCompletion(prompt, aiResponse, username);

  // Return the updated message chain
  return messages;
}

async function generateAiCompletion(prompt, username, messages, config) {
  const { temperature, presence_penalty } = config;

  // add the preamble to the messages
  messages = await addPreambleToMessages(username, prompt, messages);

  let completion = null;
  try {
    completion = await openai.createChatCompletion({
      model: "gpt-4",
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
    // Step 1: Call the capability method and retrieve the response
    capabilityResponse = await callCapabilityMethod(
      capSlug,
      capMethod,
      capArgs
    );
  } catch (e) {
    console.error(e);
    // Step 2: Handle errors and provide a default error response
    capabilityResponse = "Capability error: " + e;
  }

  // Step 3: Trim the capability response if needed to fit within the token limit
  return trimResponseIfNeeded(capabilityResponse);
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

// 🌐 Displaying all guilds & channels we're connected to!
function logGuildsAndChannels() {
  console.log("\n🌐 Connected servers and channels:");
  client.guilds.cache.forEach((guild) => {
    console.log(` - ${guild.name}`);
  });
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

// 📤 splitAndSendMessage: a reliable mailman for handling lengthy messages
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
    // Check if the bot was mentioned or if the channel name includes a bot
    const botMentioned = message.mentions.has(client.user);
    const channelNameHasBot = detectBotMentionOrChannel(message);

    // Ensure that the message is not sent by a bot and that the bot was mentioned or the channel name includes a bot
    if (!message.author.bot && (botMentioned || channelNameHasBot)) {
      // Display typing indicator
      const typingInterval = displayTypingIndicator(message);

      // Remove the bot mention from the message content
      const prompt = removeMentionFromMessage(message.content, "@coachartie");

      console.log(`✉️ Message received: ${prompt}`);

      // Process the message/prompt
      await processMessageChain(
        message,
        [
          {
            role: "user",
            content: prompt,
          },
        ],
        message.author.username
      );

      // Clear the typing indicator
      clearInterval(typingInterval);
    } else if (!message.author.bot) {
      console.log("Another bot is trying to talk to me! 😡");
    }
  } catch (error) {
    console.error(error);
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
