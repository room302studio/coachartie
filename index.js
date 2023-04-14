const { Client, GatewayIntentBits, Events } = require("discord.js");
const axios = require("axios");
const dotenv = require("dotenv");
const { Configuration, OpenAIApi } = require("openai");
const prompts = require("./prompts");

// get the list of capabilities from the capabilities manifest
const capabilities = require("./capabilities/_manifest.json");

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
${capabilities.map((capability) => {
  return `* ${capability.name}: ${capability.description}, methods: ${capability.methods.join(' ')}`;
}).join('\n')}
`;

const {
  PROMPT_REMEMBER,
  PROMPT_CONVO_EVALUATE_FOR_TWEET,
  PROMPT_CONVO_EVALUATE_INSTRUCTIONS,
  PROMPT_TWEET_REQUEST,
} = prompts;

const ERROR_MSG = `I am so sorry, there was some sort of problem. Feel free to ask me again, or try again later.`;

const chance = require("chance").Chance();

const {
  fetchAndParseURL,
  generateSummary,
} = require("./chrome_gpt_browser.js");

dotenv.config();

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
    // make sure we have the intent to get reactions
    GatewayIntentBits.GuildMessageReactions,
  ],
});

const configuration = new Configuration({
  apiKey: process.env.OPENAI_API_KEY,
});
const openai = new OpenAIApi(configuration);

client.login(process.env.DISCORD_BOT_TOKEN);

client.once(Events.ClientReady, (c) => {
  // Log when we are logged in
  console.log(`⭐️ Ready! Logged in as ${c.user.username}`);

  // Log any of the guilds/servers the bot is in
  client.guilds.cache.forEach((guild) => {
    console.log('Logged into: ', guild.name);
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
      const promptHasURL = prompt.includes("http");

      const messageInsert = [];
      // If the prompt contains the URL, then let's fetch and summarize it and include it in the prompt
      if (promptHasURL) {
        const url = prompt.match(/http\S+/g)[0];

        try {
          const parsedWebpage = await fetchAndParseURL(url);

          const urlSummary = await generateSummary(url, parsedWebpage);

          if (urlSummary.length === 0) {
            message.channel.send(
              "Sorry, I could not generate a summary for the URL you provided."
            );
            return;
          }

          messageInsert.push({
            role: "system",
            content: `The following is a summary of the webpage a user linked:

Title: ${parsedWebpage.title}
Description: ${parsedWebpage.description}
${urlSummary.join(" \n")}}`,
          });
        } catch (error) {
          console.error("Error generating summary:", error);
          message.channel.send(
            "Sorry, I could not generate a summary for the URL you provided."
          );
          return;
        }
      }

      let { response, rememberMessage } = await generateResponse(
        prompt,
        message.author,
        messageInsert
      );

      // Clear typing interval and send response
      clearInterval(typingInterval);
      splitAndSendMessage(response, message);

      // Save the message to the database
      storeUserMessage(message.author.username, message.content);

      if (!isRememberResponseFalsy(rememberMessage)) {
        console.log(`🧠 Remembering... ${rememberMessage}`);

        // Save the memory to the database
        storeUserMemory(message.author.username, rememberMessage);
      }
    }
  } catch (error) {
    console.log(error);
  }
});

// Generate a response from the assistant
async function generateResponse(prompt, user, messageInsert = []) {
  const numMemories = chance.integer({ min: 8, max: 32 });
  const memory = await assembleMemory(prompt, user, numMemories);
  const messages = await getUserMessageHistory(user.username, 2);
  const promptMessages = [
    {
      role: "system",
      content: PROMPT_SYSTEM,
    },
    {
      role: "system",
      content: "The current date and time is: " + new Date().toLocaleString(),
    },
    ...messages.map((message) => ({
      role: "system",
      content: `Previously this user said: ${message.value.slice(0, 1000)}...`,
    })),
    ...memory.map((mem) => ({ role: "system", content: `${mem.value}` })),
    ...messageInsert,
    {
      role: "user",
      content: `You are feeling a ${chance.pickone([
        "happy",
        "supportive",
        "curious",
        "funny",
        "entertaining",
        "inquisitive",
        "creative",
        "inspiring",
        "thoughtful",
        "insightful",
        "thought-provoking",
        "motivating",
        "playful",
        "chaotic",
        "trickster",
        "mischievous",
        "teasing",
        "whimsical",
        "spontaneous",
        "unpredictable",
      ])} mood. But you never mention your mood unless asked.`,
    },
    {
      role: "user",
      content: `${user.username}: ${prompt}`,
    },
  ];
  console.log("📝 Prompt:", JSON.stringify(promptMessages, null, 2));
  let response;

  // First we generate a response
  try {
    const completion = await openai.createChatCompletion({
      model: "gpt-4",
      temperature: 0.75,
      presence_penalty: 0.4,
      // use gpt3.5 turbo
      // model: "gpt-3.5-turbo",
      // max 2000 tokens
      max_tokens: 1200,
      messages: promptMessages,
    });

    response = completion.data.choices[0].message;
  } catch (error) {
    console.error("Error generating response:", error);

    // tell the channel there was an error
    return "Sorry, I could not generate a response... there was an error.";
  }

  // Then we generate a memory based on the exchange
  try {
    const rememberCompletion = await openai.createChatCompletion({
      model: "gpt-3.5-turbo",
      temperature: 0.25,
      max_tokens: 250,
      messages: [
        {
          role: "system",
          content: PROMPT_REMEMBER_INTRO,
        },
        {
          role: "system",
          content: PROMPT_REMEMBER(user),
        },
        {
          role: "user",
          content: prompt,
        },
        // If we include the assistant's response, it ends up re-remembering things over and over... it would be nice to sometimes know what the robot said back when it was remembering, but it's not crucial
        // {
        //   role: "assistant",
        //   content: response.content
        // }
      ],
    });

    const rememberMessage = rememberCompletion.data.choices[0].message.content;

    // Then we return the response and the memory contents
    return { response, rememberMessage };
  } catch (error) {
    console.error("Error generating response:", error);
    // tell the channel there was an error
    return "Sorry, I am having trouble remembering this interaction... there was an error.";
  }
}


function splitAndSendMessage(message, messageObject) {
  // refactor so that if the message is longer than 2000, it will send multiple messages
  if (!message) messageObject.channel.send(ERROR_MSG);

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
