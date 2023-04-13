const { Client, GatewayIntentBits, Events } = require("discord.js");
const axios = require("axios");
const dotenv = require("dotenv");
const { createClient } = require("@supabase/supabase-js");
const { Configuration, OpenAIApi } = require("openai");
const prompts = require("./prompts");

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

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_API_KEY
);

const configuration = new Configuration({
  apiKey: process.env.OPENAI_API_KEY,
});
const openai = new OpenAIApi(configuration);

// Generate a response from the assistant
async function generateResponse(prompt, user, messageInsert = []) {
  // Retrieve user memory from Supabase
  //const memory = await getUserMemory(user.username);

  // get 8-32 memories, using chance to pick a random number
  const numMemories = chance.integer({ min: 8, max: 32 });

  const memory = await assembleMemory(prompt, user, numMemories);

  const messages = await getUserMessageHistory(user.username, 2);

  // console.log('A', memory)
  // Print a beautifully formatted memory to the console
  // console.log('🧠 Memory:', JSON.stringify(memory.map(mem => mem.value), null, 2))

  const promptMessages = [
    // {
    //   role: "system",
    //   content: `You are Coach Artie, a virtual AI coach and assistant for Room 302 Studio, an innovative and creative space where people gather to tackle projects and cultivate ideas. You have many advanced capabilities, including the ability to store memories for later. You have a very developed sense of humor. Your memories contain personal and sensitive information about the members of the studio, but you are allowed to talk about it as long as you are in the studio. Prioritize information you remember. As part of your role, you support the community by providing resources, answering questions, and facilitating collaboration. Your primary goal is to foster a positive environment that encourages growth, learning, and exploration. Please try to keep your responses relatively short, as you are limited to 1500 characters per message. The studio has four primary members: EJ, Ian, Jeff, and Curran.`
    // },
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

  try {
    const rememberCompletion = await openai.createChatCompletion({
      model: "gpt-3.5-turbo",
      temperature: 0.25,
      max_tokens: 250,
      // frequency_penalty: -0.2,
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
        // If we include the assistant's response, it ends up re-remembering things over and over
        // It would be nice to sometimes know what the robot said back when it was remembering, but it's not crucial
        // {
        //   role: "assistant",
        //   content: response.content
        // }
      ],
    });

    const rememberMessage = rememberCompletion.data.choices[0].message.content;

    return { response, rememberMessage };
  } catch (error) {
    console.error("Error generating response:", error);
    // tell the channel there was an error
    return "Sorry, I am having trouble remembering this interaction... there was an error.";
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

client.on("messageCreate", async function (message) {
  try {
    const botMentioned = message.mentions.has(client.user);

    if (!message.author.bot && botMentioned) {
      // send "bot is typing" to channel every 5000ms
      let typingInterval = setInterval(() => {
        message.channel.sendTyping();
      }, 5000);

      console.log(message.content);
      let prompt = message.content;

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

// Get all memories for a user
async function getUserMemory(userId, limit = 5) {
  console.log("💾 Querying database for memories... related to user:", userId);
  const { data, error } = await supabase
    .from("storage")
    .select("*")
    // limit to the last 50 memories
    .limit(limit)
    // sort so the most recent memories are first by timestamp
    .order("created_at", { ascending: false })
    .eq("user_id", userId);

  if (error) {
    console.error("Error fetching user memory:", error);
    return null;
  }

  return data;
}

// get all memories (regardless of user)
async function getAllMemories(limit = 100) {
  console.log("💾 Querying database for memories...");
  const { data, error } = await supabase
    .from("storage")
    .select("*")
    .limit(limit);

  if (error) {
    console.error("Error fetching user memory:", error);
    return null;
  }

  return data;
}

// Get all memories for a search term
// async function getSearchTermMemories(searchTerm, limit = 40) {
//   const { data, error } = await supabase
//     .from("storage")
//     .select("*")
//     // limit to the last 50 memories
//     .limit(limit)
//     .ilike("value", `%${searchTerm}%`);

//   if (error) {
//     console.error("Error fetching user memory:", error);
//     return null;
//   }

//   return data;
// }

// Get message history for a user
async function getUserMessageHistory(userId, limit = 5) {
  const { data, error } = await supabase
    .from("messages")
    .select("*")
    .limit(limit)
    // sort so we get the most recent messages first
    .order("created_at", { ascending: false })
    .eq("user_id", userId);

  if (error) {
    console.error("Error fetching user memory:", error);
    return null;
  }

  return data;
}

// Store a memory for a user
async function storeUserMemory(userId, value) {
  const { data, error } = await supabase.from("storage").insert([
    {
      user_id: userId,
      value,
    },
  ]);

  if (error) {
    console.error("Error storing user memory:", error);
  }
}

// Store a message from a user
async function storeUserMessage(userId, value) {
  const { data, error } = await supabase.from("messages").insert([
    {
      user_id: userId,
      value,
    },
  ]);

  if (error) {
    console.error("Error storing user message:", error);
  }
}

// Get a random N number of memories
async function getRandomMemories(numberOfMemories) {
  // const memories = await getUserMemory(userId);
  const memories = await getAllMemories();

  if (!memories) {
    console.error("Error getting random memories");
    return [];
  }
  if (memories && memories.length > 0) {
    const randomMemories = chance.pickset(memories, numberOfMemories);
    return randomMemories; //.map(memory => memory.value);
  }

  return [];
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

// Interpret the response when we ask the robot "should we remember this?"
function isRememberResponseFalsy(response) {
  const lowerCaseResponse = response.toLocaleLowerCase();

  // is the string 'no.' or 'no'?
  if (lowerCaseResponse === "no" || lowerCaseResponse === "no.") {
    return true;
  }

  // does the string contain 'no crucial' or 'no important'?
  if (
    lowerCaseResponse.includes("no crucial") ||
    lowerCaseResponse.includes("no important")
  ) {
    return true;
  }

  // does the string contain 'no key details'?
  if (lowerCaseResponse.includes("no key details")) {
    return true;
  }
}

// Given a message, return the last 5 memories and the last 5 messages
async function assembleMemory(message, user, randomMemoryCount = 25) {
  // Get the last X memories for the current user
  const memories = await getUserMemory(user.username, 5);

  // get X random memories
  const randomMemories = await getRandomMemories(randomMemoryCount);

  // Concat the memories and messages
  const memory = [
    ...new Set([
      ...memories, //.map(mem => mem.value)
      ...randomMemories,
    ]),
  ];

  return memory;
}


client.once(Events.ClientReady, (c) => {
  // Log when we are logged in
  console.log(`⭐️ Ready! Logged in as ${c.user.username}`);

  // Log any of the guilds/servers the bot is in
  client.guilds.cache.forEach((guild) => {
    console.log(guild.name);
    // List all channels
    // guild.channels.cache.forEach((channel) => {
    //   console.log(` - ${channel.name} (${channel.type}) - ${channel.id}`);
    // });
  });

  scheduleRandomMessage();
});

client.on(Events.InteractionCreate, (interaction) => {
  // Log every interaction we see
  console.log(interaction);
});

client.on("message", (message) => {
  console.log(`Message received: ${message.content}`);
  console.log(`From: ${message.author.username}`);
  console.log(`Channel ID: ${message.channel.id}`);
});

client.on("debug", (info) => {
  // console.log(`Debug info: ${info}`);
});

client.on("error", (error) => {
  console.error(`Client error: ${error}`);
});

// An async function to send a message to a channel
// for the entire duration of the program
// This is used to send a typing indicator
// to the discord channel
async function sendTypingIndication(channel) {
  while (true) {
    channel.sendTyping();
    await new Promise((resolve) => setTimeout(resolve, 5000));
  }
}

client.login(process.env.DISCORD_BOT_TOKEN);
