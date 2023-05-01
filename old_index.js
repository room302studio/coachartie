// grab the discord client, and the ability to grab events
const { Client, GatewayIntentBits, Events } = require("discord.js");
// access to .env
const dotenv = require("dotenv");
// gpt token encoder/decoder to calculate tokens for a string
const { encode, decode } = require("@nem035/gpt-3-encoder");
// openai api
const { Configuration, OpenAIApi } = require("openai");
// global prompt settings
const prompts = require("./prompts");

// grab the prompts for the bot
const {
  PROMPT_SYSTEM,
  PROMPT_REMEMBER,
  PROMPT_REMEMBER_INTRO,
  PROMPT_CONVO_EVALUATE_FOR_TWEET,
  PROMPT_CONVO_EVALUATE_INSTRUCTIONS,
  PROMPT_TWEET_REQUEST,
} = prompts;

// error message sent to channel if something goes wrong
const ERROR_MSG = `I am so sorry, there was some sort of problem. Feel free to ask me again, or try again later.`;

// chance js to handle randomization
// const chance = require("chance").Chance();

dotenv.config();

const configuration = new Configuration({
  apiKey: process.env.OPENAI_API_KEY,
});
const openai = new OpenAIApi(configuration);

/*

              ___                  _       _
             / (_)                | |  o  | | o     o
            |      __,    _   __, | |     | |   _|_     _   ,
            |     /  |  |/ \_/  | |/ \_|  |/  |  |  |  |/  / \_
             \___/\_/|_/|__/ \_/|_/\_/ |_/|__/|_/|_/|_/|__/ \/
                       /|
                       \|

*/

// import memory capabilities
const {
  assembleMemory,
  getUserMessageHistory,
  getUserMemory,
  storeUserMessage,
  storeUserMemory,
} = require("./capabilities/remember.js");

// import browser capabilities
const {
  fetchAndParseURL,
  generateSummary,
} = require("./chrome_gpt_browser.js");

/*


             ____                                  , __
            (|   \ o                         |    /|/  \
             |    |    ,   __   __   ,_    __|     | __/ __ _|_
            _|    ||  / \_/    /  \_/  |  /  |     |   \/  \_|
           (/\___/ |_/ \/ \___/\__/    |_/\_/|_/   |(__/\__/ |_/


*/

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
    // make sure we have the intent to get reactions
    GatewayIntentBits.GuildMessageReactions,
  ],
});

client.login(process.env.DISCORD_BOT_TOKEN);

client.once(Events.ClientReady, (c) => {
  // Log when we are logged in
  console.log(`⭐️ Ready! Logged in as ${c.user.username}`);

  // Log any of the guilds/servers the bot is in
  client.guilds.cache.forEach((guild) => {
    console.log("Logged into: ", guild.name);
    // List all channels
    // guild.channels.cache.forEach((channel) => {
    //   console.log(` - ${channel.name} (${channel.type}) - ${channel.id}`);
    // });
  });

  scheduleRandomMessage();
});

client.on(Events.InteractionCreate, (interaction) => {
  // Log every interaction we see
  // console.log(interaction);
});

client.on("debug", (info) => {
  // console.log(`Debug info: ${info}`);
});

client.on("error", (error) => {
  console.error(`Client error: ${error}`);
});

client.on("messageCreate", async function (message) {
  try {
    const botMentioned = message.mentions.has(client.user);

    // If the bot was mentioned, and the message was not sent by a bot
    if (!message.author.bot && botMentioned) {
      // send "bot is typing" to channel every 5000ms
      let typingInterval = setInterval(() => {
        message.channel.sendTyping();
      }, 5000);

      let prompt = message.content;

      // Remove the bot mention from the prompt
      if (prompt.includes("@coachartie")) {
        prompt = prompt.replace("@coachartie", "");
      }

      // See if the prompt contains a URL
      // const promptHasURL = prompt.includes("http");

      const messageInsert = [];

      // let { response } = await generateResponse(
      //   prompt,
      //   message.author.username,
      //   messageInsert
      // );

      // instead of awaiting, lets move it into a .then
      // so we can do other things while we wait
      await generateResponse(
        prompt,
        message.author.username,
        messageInsert
      ).then(async ({ response }) => {
        // Clear typing interval and send response
        clearInterval(typingInterval);
        splitAndSendMessage(response, message);

        // generate a memory from the exchange
        const rememberCompletion = await openai.createChatCompletion({
          model: "gpt-3.5-turbo",
          temperature: 0.75,
          max_tokens: 320,
          messages: [
            {
              role: "system",
              content: PROMPT_REMEMBER_INTRO,
            },
            {
              role: "system",
              content: PROMPT_REMEMBER(message.author.username),
            },
            {
              role: "user",
              content: prompt,
            },
            {
              role: "assistant",
              content: response,
            },
          ],
        });

        const rememberMessage =
          rememberCompletion.data.choices[0].message.content;

        // Save the message to the database
        storeUserMessage(message.author.username, message.content);

        // Save the memory to the database
        storeUserMemory(message.author.username, rememberMessage);
      });
    }
  } catch (error) {
    console.log(error);
  }
});

// get the list of capabilities from the capabilities manifest
// const capabilities = require("./capabilities/_manifest.json");
// this makes an error:
// Error: Cannot find module './capabilities/_manifest.json'
// which is weird because
// it exists, and also
// it begins with module.exports = { ... data ... }
// so we should be able to require it like:
const capabilities = require("./capabilities/_manifest.js").capabilities;

// capability prompt
// to tell the robot all the capabilities it has and what they do
const capabilityPrompt = `You have a limited number of capabilities that let you do things by asking the system to do them.

If you want to use a capability's method, you can ask the system to do it by making sure you are on a newline, and saying "<SYSTEM, CAPABILITY, METHOD>". For example, if you want to use the "remember" capability's "store" method, you can say:
"\\n<SYSTEM, REMEMBER, STORE, The value of the memory>"
and the system will store the memory for you. You may only use one capability at a time.

Not all capabilities require arguments, for example:
"\\n<SYSTEM, REMEMBER, ASSEMBLEMEMORY>" will assemble your memories for you.

The responses to these capabilities will appear as system messages in your conversation.

These are all of your capabilities:
${capabilities
  .map((capability) => {
    return `* ${capability.slug}: ${
      capability.description
    }, methods: ${capability.methods
      ?.map((method) => {
        return method.name;
      })
      .join(", ")}`;
  })
  .join("\n")}
`;

async function handleMessage(inputMessage, user) {
  console.log("Received message:", inputMessage);
  console.log("User:", user);

  // This function simulates the process of calling the capability methods.
  async function callCapabilityMethod(capabilitySlug, methodName, args) {
    console.log(
      `Calling capability method: ${capabilitySlug}.${methodName} with args: ${args}`
    );

    let capabilityResponse = "";

    if (capabilitySlug === "remember") {
      if (methodName === "store") {
        // store the memory
        capabilityResponse = "Memory stored!";
      } else if (methodName === "assembleMemory") {
        // assemble the memory
        capabilityResponse = "Assembled memories!";
      } else if (methodName === "getRandomMemories") {
        // get random memories
        capabilityResponse = "Got random memories!";
      }
    }

    // You can replace this with actual capability method implementation.
    return `System response for ${capabilitySlug}.${methodName}: 
    ${capabilityResponse}`;
  }

  /*

               ___  _
              / (_)| |          o          o
             |     | |     __,      _  _       _  _    __,
             |     |/ \   /  |  |  / |/ |  |  / |/ |  /  |
              \___/|   |_/\_/|_/|_/  |  |_/|_/  |  |_/\_/|/ooo
                                                        /|
                                                        \|

*/

  async function processMessageChain(messages) {
    console.log("Processing message chain:", messages);
    console.log("Messages: ", messages.length);

    const lastMessage = messages[messages.length - 1];
    console.log("Last message: \n", lastMessage);
    const currentTokenCount = countMessageTokens(messages);
    console.log("Current token count: ", currentTokenCount);

    const apiTokenLimit = 8000;

    if (currentTokenCount >= apiTokenLimit - 900) {
      console.log(
        "Token limit reached, adding system message to the chain reminding the bot to wrap it up."
      );
      messages.push({
        role: "system",
        content:
          "You are reaching the token limit. In the next response, you may not use a capability but must use all of this information to respond to the user.",
      });
      return messages;
    }

    // const capabilityRegex = /\\n<SYSTEM, (.+?), (.+?)(?:, (.*?))?>/;
    // needs to handle `<SYSTEM, REMEMBER, STORE, EJ asked me to demonstrate the store method in the remember capability.>
    const capabilityRegex = /(?:\\n)?<SYSTEM, (.+?), (.+?)(?:, (.*?))?>/; // Remove the 'g' flag
    const capabilityMatch = capabilityRegex.exec(lastMessage.content); // Use 'exec' instead of 'match'

    console.log("Capability match: ", capabilityMatch);

    if (!capabilityMatch) {
      console.log(
        "No capability found in the last message, breaking the chain."
      );
      return messages;
    }

    const [_, capSlug, capMethod, capArgs] = capabilityMatch;
    const capabilityResponse = await callCapabilityMethod(
      capSlug,
      capMethod,
      capArgs
    );

    const systemMessage = {
      role: "system",
      content: capabilityResponse,
    };

    console.log("Adding system message to the chain:", systemMessage);
    messages.push(systemMessage);

    // Call the OpenAI API to get the AI response based on the system message
    const completion = await openai.createChatCompletion({
      model: "gpt-4",
      temperature: 0.75,
      presence_penalty: 0.4,
      max_tokens: 900,
      messages: messages,
    });

    const aiResponse = completion.data.choices[0].message;

    messages.push(aiResponse);

    console.log("Continuing the message chain.");
    return processMessageChain(messages);
  }

  // except user is not defined here

  const memory = await assembleMemory(user, 5);
  const messages = await getUserMessageHistory(user, 2);

  const systemPrompt = {
    role: "system",
    content: PROMPT_SYSTEM,
  };

  const userMessage = {
    role: "user",
    content: `<${user}>: ${inputMessage}`,
  };

  const capabilityMessage = {
    role: "system",
    content: capabilityPrompt,
  };

  const initialMessages = [
    systemPrompt,
    // memory.map((mem) => {
    //   return {
    //     role: "system",
    //     content: mem.value,
    //   };
    // }),
    capabilityMessage,
    // messages.map((mem) => {
    //   return {
    //     role: "user",
    //     content: mem.value,
    //   };
    // }),
    userMessage,
  ];

  // Call the OpenAI API to get the AI response
  const completion = await openai.createChatCompletion({
    model: "gpt-4",
    temperature: 0.75,
    presence_penalty: 0.4,
    max_tokens: 900,
    messages: initialMessages,
  });

  const aiResponse = completion.data.choices[0].message;

  initialMessages.push(aiResponse);

  const processedMessages = await processMessageChain(initialMessages);
  // console.log("Finished message chain processing, output messages:", processedMessages);

  const userMessages = processedMessages.filter((msg) => msg.role !== "system");
  const finalMessage = userMessages[userMessages.length - 1];
  console.log("Final message for the user:", finalMessage);

  return finalMessage.content;
}

// Generate a response from the assistant
async function generateResponse(prompt, user, messageInsert = []) {
  console.log("Generating response for prompt:", prompt, "and user:", user);

  let response;

  // First we generate a response
  try {
    response = await handleMessage(prompt, user);
  } catch (error) {
    console.error("Error generating response:", error);

    // tell the channel there was an error
    return "Sorry, I could not generate a response... there was an error.";
  }

  // Then we generate a memory based on the exchange

  // Then we return the response and the memory contents
  return { response };
}

function splitAndSendMessage(message, messageObject) {
  console.log("Sending message:", message);
  // refactor so that if the message is longer than 2000, it will send multiple messages
  if (!message) return messageObject.channel.send(ERROR_MSG);
  // if (!message.content) messageObject.channel.send(ERROR_MSG);

  if (message.length < 2000) {
    messageObject.channel.send(message);
  } else {
    let responseArray = message.content.split(" ");
    let responseString = "";
    for (let i = 0; i < responseArray.length; i++) {
      if (responseString.length + responseArray[i].length < 2000) {
        responseString += responseArray[i] + " ";
      } else {
        messageObject.channel.send(responseString);
        responseString = responseArray[i] + " ";
      }
    }
    messageObject.channel.send(responseString);
  }
}

async function sendRandomMessage() {
  const prompt =
    "As Coach Artie in a happy mood, propose an interesting thought based on what you remember, or an engaging and relevant topic which contributes positively to the atmosphere in Room 302 Studio. Avoid mentioning specific people or topics that are not relevant to the studio.";
  const response = await generateResponse(prompt, { username: "System" });

  const guild = client.guilds.cache.find(
    (guild) => guild.name === "hang.studio"
  );
  if (guild) {
    const channel = guild.channels.cache.get("1086329744762622023");
    if (channel) {
      channel.send(response.response.content);
    }
  }
}

async function scheduleRandomMessage() {
  const minDelay = 30 * 60 * 1000; // 30 minutes in milliseconds
  const maxDelay = 120 * 60 * 1000; // 120 minutes in milliseconds
  const delay = Math.random() * (maxDelay - minDelay) + minDelay;

  if (isWithinSendingHours()) {
    await sendRandomMessage();
  }

  setTimeout(scheduleRandomMessage, delay);
}

function getCurrentTimeEST() {
  const currentTime = new Date();
  const offsetUTC = currentTime.getTimezoneOffset() * 60 * 1000;
  const offsetEST = -5 * 60 * 60 * 1000; // Offset for EST timezone
  return new Date(currentTime.getTime() + offsetUTC + offsetEST);
}

function isWithinSendingHours() {
  const currentTimeEST = getCurrentTimeEST();
  const startHour = 11; // 11 AM
  const endHour = 15; // 3 PM
  return (
    currentTimeEST.getHours() >= startHour &&
    currentTimeEST.getHours() < endHour
  );
}

function countMessageTokens(messageArray = []) {
  let totalTokens = 0;
  messageArray.forEach((message) => {
    // encode message.content
    const encodedMessage = encode(JSON.stringify(message));
    // console.log('Encoded Message: ', encodedMessage)
    totalTokens += encodedMessage.length;
  });
  return totalTokens;
}
