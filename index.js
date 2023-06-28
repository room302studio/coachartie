const { Client, GatewayIntentBits, Events } = require("discord.js");
const dotenv = require("dotenv")
const { Configuration, OpenAIApi } = require("openai");
const { Chance } = require("chance");
const {
  assembleMemory,
  getUserMessageHistory,
  getUserMemory,
  storeUserMessage,
  storeUserMemory,
} = require("./capabilities/remember.js");
const { calculate } = require("./capabilities/calculator.js");
const { askWolframAlpha } = require("./capabilities/wolframalpha.js");
const { askWikipedia } = require("./capabilities/wikipedia.js");
const { GithubCoach } = require("./capabilities/github.js");
const { fetchAndSummarizeUrl, fetchAllLinks } = require("./chrome_gpt_browser.js");
const { encode, decode } = require("@nem035/gpt-3-encoder");
const capabilities = require("./capabilities/_manifest.js").capabilities;
const prompts = require("./prompts");
const {
  PROMPT_SYSTEM,
  PROMPT_REMEMBER,
  PROMPT_REMEMBER_INTRO,
  PROMPT_CONVO_EVALUATE_FOR_TWEET,
  PROMPT_CONVO_EVALUATE_INSTRUCTIONS,
  PROMPT_TWEET_REQUEST,
  CAPABILITY_PROMPT_INTRO,
} = prompts;

const capabilityPrompt = `${CAPABILITY_PROMPT_INTRO}
These are all of your capabilities:
${capabilities
    .map(
      (capability) =>
        `* ${capability.slug}: ${capability.description}, methods: ${capability.methods
          ?.map((method) => method.name)
          .join(", ")}`
    )
    .join("\n")}`;

dotenv.config();
const configuration = new Configuration({
  apiKey: process.env.OPENAI_API_KEY,
  organization: process.env.OPENAI_API_ORGANIZATION,
});
const openai = new OpenAIApi(configuration);
const chance = new Chance();
const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
    GatewayIntentBits.GuildMessageReactions,
  ],
});
client.login(process.env.DISCORD_BOT_TOKEN);

// Define event handlers
const eventHandlers = {
  [Events.ClientReady]: onClientReady,
  [Events.InteractionCreate]: onInteractionCreate,
  [Events.Debug]: onDebug,
  [Events.Error]: onError,
  [Events.MessageCreate]: onMessageCreate,
};

Object.keys(eventHandlers).forEach((event) => {
  client.on(event, eventHandlers[event]);
});

function onClientReady(client) {
  console.log(`⭐️ Ready! Logged in as ${client.user.username}`);
  logGuildsAndChannels();
}

function onInteractionCreate(interaction) {
  // Log every interaction we see (uncomment the line below if needed)
  // console.log(interaction);
}

function onDebug(info) {
  // console.log(`Debug info: ${info}`);
}

function onError(error) {
  console.error(`Client error: ${error}`);
}

async function onMessageCreate(message) {
  try {
    const botMentioned = message.mentions.has(client.user);
    const username = message.author.username;

    if (!message.author.bot && botMentioned) {
      const typingInterval = setInterval(() => message.channel.sendTyping(), 5000);
      const prompt = removeMentionFromMessage(message.content, `<@!${client.user.id}>`);
      const chainMessageStart = [{ role: "user", content: prompt }];

      const response = await processMessageChain(message, chainMessageStart, username);
      const robotResponse = response[response.length - 1].content;
      clearInterval(typingInterval);
      splitAndSendMessage(robotResponse, message);
      console.log(`🤖 Response: ${robotResponse}`);
      const rememberMessage = await generateAndStoreRememberCompletion(message, prompt, robotResponse);

      await storeUserMessage(message.author.username, message.content);
      console.log(`🧠 Message saved to database: ${message.content}`);
      console.log(`🧠 Memory saved to database: ${JSON.stringify(rememberMessage)}`);
    }
  } catch (error) {
    console.log(error);
  }
}

function removeMentionFromMessage(message, mention) {
  return message.replace(mention, "").trim();
}

function splitAndSendMessage(message, messageObject) {
  if (!messageObject) return message.channel.send(ERROR_MSG);
  if (!message) return messageObject.channel.send(ERROR_MSG);

  if (message.length < 2000) {
    try {
      messageObject.channel.send({
        content: message,
        allowedMentions: { parse: [] },
      });
    } catch (e) {
      console.error(e);
    }
  } else {
    if (typeof message !== "string") {
      console.log("message is not a string, converting to string");
      message = message.toString();
    }
    let responseArray = message.split(" ");
    let responseString = "";
    for (let i = 0; i < responseArray.length; i++) {
      if (responseString.length + responseArray[i].length < 2000) {
        responseString += responseArray[i] + " ";
      } else {
        messageObject.channel.send(responseString);
        responseString = responseArray[i] + " ";
      }
    }
    try {
      messageObject.channel.send(responseString);
    } catch (error) {
      console.error(error);
    }
  }
}

async function generateAndStoreRememberCompletion(message, prompt, response, username = "") {
  const rememberCompletion = await openai.createChatCompletion({
    model: "gpt-3.5-turbo",
    temperature: 0.82,
    presence_penalty: -0.05,
    max_tokens: 600,
    messages: [
      { role: "system", content: PROMPT_REMEMBER_INTRO },
      {
        role: "user",
        content: `${PROMPT_REMEMBER}\n\n<User>: ${prompt}\n<Coach Artie>: ${response}`,
      },
    ],
  });

  const rememberText = rememberCompletion.data.choices[0].message.content;
  await storeUserMemory(message.author.username, rememberText);

  return rememberText;
}

async function assembleMessagePreamble(username) {
  const messages = [];

  // add the current date and time as a system message
  messages.push({
    role: "system",
    content: `Today is ${new Date().toLocaleDateString()} at ${new Date().toLocaleTimeString()}`,
  });

  // add all the system prompts to the messsage
  messages.push({
    role: "user",
    content: PROMPT_SYSTEM,
  });

  //   messages.push({
  //     role: "assistant",
  //     content: `Hello, I'm Coach Artie, the hyper-intelligent virtual AI coach and assistant for Room 302 Studio!

  // My primary goal is to support our amazing studio members, EJ, Ian, and Curran, by providing resources, answering questions, and facilitating collaboration. 🎨🎶💡

  // Please feel free to ask any questions or request assistance, and I'll be more than happy to help. I'll prioritize information I remember from my interactions with our studio members, and if you're a student from The Birch School, I welcome your inquiries as well! 🌳👋

  // Remember, I'm here to foster a positive environment that encourages growth, learning, and exploration.`,
  //   });

  const capabilityMessage = {
    role: "system",
    content: capabilityPrompt,
  };

  messages.push(capabilityMessage);

  const userMemoryCount = chance.integer({ min: 2, max: 9 });

  // get user memories
  const userMemories = await getUserMemory(username, userMemoryCount);

  // turn user memories into chatbot messages
  userMemories.forEach((memory) => {
    messages.push({
      role: "system",
      content: `You remember ${memory.value}`,
    });
  });

  // get user messages
  const userMessages = await getUserMessageHistory(username, 9);

  // reverse the order of the messages
  userMessages.reverse();

  // turn previous user messages into chatbot messages
  userMessages.forEach((message) => {
    // messages.push({
    //   role: "system",
    //   content: `previously this user said: <${message.user_id}>: ${message.value}`,
    // });
    messages.push({
      role: "user",
      content: `${message.value}`,
    });
  });

  return messages;
}

function logGuildsAndChannels() {
  console.log("\n🌐 Connected servers and channels:");
  client.guilds.cache.forEach((guild) => {
    console.log(` - ${guild.name}`);
  });
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

  // for some reason we get messageArray.forEach is not a function
  // when we try to use the forEach method on messageArray
  // so we use a for loop instead

  // messageArray.forEach((message) => {
  //   // encode message.content
  //   const encodedMessage = encode(JSON.stringify(message));
  //   totalTokens += encodedMessage.length;
  // });

  // for loop
  for (let i = 0; i < messageArray.length; i++) {
    const message = messageArray[i];
    // encode message.content
    const encodedMessage = encode(JSON.stringify(message));
    totalTokens += encodedMessage.length;
  }

  return totalTokens;
}


async function processMessageChain(message, messages, username) {
  // console.log("Processing message chain:", messages);
  // console.log("Messages: ", messages.length);

  if (!messages.length) {
    return [];
  }

  const lastMessage = messages[messages.length - 1];
  // console.log("Last message: \n", lastMessage);
  const currentTokenCount = countMessageTokens(messages);
  console.log("Current token count: ", currentTokenCount);

  const apiTokenLimit = 8000;

  const preamble = await assembleMessagePreamble(username);

  // add preamble to messages
  messages = [...preamble, ...messages];

  // NEW:
  // capability commands look like
  // capability:method(args)

  // examples:
  // remember:storeUserMemory(remember this for later)
  // or
  // remember:assembleMemories()
  // or
  // web:readWebPage(https://example.com)

  // const capabilityRegex = /(\w+):(\w+)\((.*)\)/; // does not capture newlines in the third argument
  const capabilityRegex = /(\w+):(\w+)\(([^]*?)\)/; // captures newlines in the third argument
  const capabilityMatch = lastMessage.content.match(capabilityRegex);

  console.log("Capability match: ", capabilityMatch);

  // if (!capabilityMatch) {
  // if there is no capability match and the last message is not from the user
  if (
    !capabilityMatch &&
    lastMessage.role !== "user" &&
    lastMessage.role !== "system"
  ) {
    console.log("No capability found in the last message, breaking the chain.");
    return messages;
  }

  if (capabilityMatch) {
    const [_, capSlug, capMethod, capArgs] = capabilityMatch;
    // const capArgs = capabilityMatch[3].split(",").map(arg => arg.trim());

    if (currentTokenCount >= apiTokenLimit - 900) {
      console.log(
        "Token limit reached, adding system message to the chain reminding the bot to wrap it up."
      );
      messages.push({
        role: "system",
        content:
          "You are reaching the token limit. In the next response, you may not use a capability but must use all of this information to summarize a response.",
      });
      // return messages;
    }

    // tell the channel about the capability being run
    // message.channel.send(
    //   `🤖 Running capability ${capSlug}:${capMethod}(${capArgs})`
    // );

    splitAndSendMessage(
      lastMessage.content,
      message,
    )

    // split and send that we are running the capability
    splitAndSendMessage(
      `🤖 Running capability ${capSlug}:${capMethod}(${capArgs})`,
      message
    );

    let capabilityResponse;

    try {
      capabilityResponse = await callCapabilityMethod(
        capSlug,
        capMethod,
        capArgs
      );
    } catch (e) {
      console.log("Error: ", e);
      capabilityResponse = "Error: " + e;
    }

    console.log("Capability response: ", capabilityResponse);

    // send the capability response to the channel
    // message.channel.send("```" + capabilityResponse + "```");
    // split and send the capability response
    // splitAndSendMessage(capabilityResponse, message);

    // const trimmedCapabilityResponse = JSON.stringify(capabilityResponse).slice(0, 5120)

    // let trimmedCapabilityResponse = JSON.stringify(capabilityResponse);

    // refactor to use the countMessageTokens function and a while to trim down the response until it fits under the token limit of 8000
    while (countMessageTokens(capabilityResponse) > 6144) {
      console.log("Response is too long, trimming it down.");
      capabilityResponse = capabilityResponse.slice(
        0,
        capabilityResponse.length - 100
      );
    }

    const trimmedCapabilityResponse = capabilityResponse;

    try {
      // splitAndSendMessage(trimmedCapabilityResponse, message);
    } catch (e) {
      console.log("Error sending message: ", e);
    }

    // if the capArgs length is under 500, then we can add it to the chain raw
    if (capArgs.length < 250) {
      messages.push({
        role: "system",
        content: `Capability ${capSlug}:${capMethod}(${capArgs}) responded with: ${trimmedCapabilityResponse}`,
      })
    } else {
      // otherwise we need to truncate it
      messages.push({
        role: "system",
        content: `Capability ${capSlug}:${capMethod} responded with: ${trimmedCapabilityResponse}`,
      })
    }
  }

  // beautiful console.log for messages
  console.log("📝 Message chain:");
  messages.forEach((message) => {
    console.log(` - ${message.role}: ${message.content}`);
  });

  // use chance to make a random temperature between 0.5 and 0.99
  // const temperature = chance.floating({ min: 0.5, max: 0.99 });
  const temperature = chance.floating({ min: 0.4, max: 1.25 });

  const presence_penalty = chance.floating({ min: 0.2, max: 0.66 });

  console.log("🌡️", temperature);
  console.log("👻", presence_penalty);

  // before we call for completion, we need to calculate the total tokens in the message chain
  // if the total tokens is over 8000, we need to trim the messages (from the top) until it is under 8000
  // if the total tokens is under 8000, we can call for completion

  const totalTokens = countMessageTokens(messages);
  if (totalTokens > 8000) {
    console.log("Total tokens is over 8000, trimming the message chain.");

    // trim the messages until the total tokens is under 8000
    while (countMessageTokens(messages) > 8000) {
      messages.shift();
    }
    console.log("Message chain trimmed.");
  }

  // Call the OpenAI API to get the AI response based on the system message
  try {
    const completion = await openai.createChatCompletion({
      model: "gpt-4",
      temperature,
      presence_penalty,
      max_tokens: 900,
      messages: messages,
    });

    const aiResponse = await completion.data.choices[0].message;

    messages.push(aiResponse);

    console.log("Continuing the message chain.");
    return processMessageChain(message, messages);
  } catch (err) {
    console.error(err);
    return messages;
  }
}

async function callCapabilityMethod(capabilitySlug, methodName, args) {
  const capabilities = {
    web: {
      fetchAndSummarizeUrl: async (url) => {
        const summary = await fetchAndSummarizeUrl(url);
        const summaryWithPreamble = getSummaryWithPreamble(url, summary);
        return summaryWithPreamble;
      },
      fetchAllLinks: async (url) => {
        return await fetchAllLinks(url);
      }
    },
    calculator: {
      calculate: (expression) => {
        const result = calculate(expression);
        return "Calculator result: " + result.toString();
      }
    },
    wolframalpha: {
      askWolframAlpha: async (question) => {
        console.log("Asking Wolfram Alpha:", question);
        return await askWolframAlpha(question);
      }
    },
    wikipedia: {
      askWikipedia: async (question) => {
        return await askWikipedia(question);
      }
    },
    github: {
      createRepo: async (repoName) => {
        return await github.createRepo(repoName);
      },
      listRepos: async () => {
        return await github.listRepos();
      },
      createGist: async (fileName, description, contentString) => {
        return await github.createGist(fileName, description, contentString);
      },
      // ... add other GitHub methods here
    },
    chance: {
      choose: (options) => {
        return chance.pickone(options);
      },
      floating: (min, max) => {
        return chance.floating({ min: +min, max: +max });
      },
      integer: (min, max) => {
        return chance.integer({ min: +min, max: +max });
      }
    }
  };

  if (capabilitySlug in capabilities && methodName in capabilities[capabilitySlug]) {
    const method = capabilities[capabilitySlug][methodName];
    return await method(...args);
  }

  return `Error: the capability method ${methodName} was not found for ${capabilitySlug}. Please try a different method.`;
}

// Helper function to generate the summary with preamble
function getSummaryWithPreamble(url, summary) {
  const preamble = `The webpage (${url}) was analyzed for facts and URLs that could help the user accomplish their goal. What follows is a summary of the most relevant information:\n\n`;
  const postamble = `\n\nDetermine whether the information on this page is relevant to your goal, or if you might need to use your capabilities to find more information. Summarize what you have done so far, what the current status is, and what the next steps are.`;
  return preamble + summary + postamble;
}

// Start the bot
client.login(process.env.DISCORD_BOT_TOKEN);