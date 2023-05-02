/*
🚀 Welcome to the Cyberpunk Future of Discord Bots! 🤖
In this realm, we import the necessary modules, packages, 
and wire up our bot's brain to bring it to life. Let's go!
*/

// 📜 prompts: our guidebook of conversational cues
const prompts = require("./prompts");

// 🚦 Constants Corner: prepping our prompts and error message
const {
  PROMPT_SYSTEM,
  PROMPT_REMEMBER,
  PROMPT_REMEMBER_INTRO,
  PROMPT_CONVO_EVALUATE_FOR_TWEET,
  PROMPT_CONVO_EVALUATE_INSTRUCTIONS,
  PROMPT_TWEET_REQUEST,
  CAPABILITY_PROMPT_INTRO,
} = prompts;
const ERROR_MSG = `I am so sorry, there was some sort of problem. Feel free to ask me again, or try again later.`;

// 🧩 Importing essential building blocks from the Discord package
const { Client, GatewayIntentBits, Events } = require("discord.js");

// 🌿 dotenv: a lifeline for using environment variables
const dotenv = require("dotenv");

// 📚 GPT-3 token-encoder: our linguistic enigma machine
const { encode, decode } = require("@nem035/gpt-3-encoder");

// ⚡ OpenAI API: connecting to the almighty AI powerhouse
const { Configuration, OpenAIApi } = require("openai");

// ❓ Chance: a randomizer to keep our bot from being boring
const { Chance } = require("chance");
const chance = new Chance();

/*
💾 Memory Lane: the 'remember' capability for our bot.
The ability to store and retrieve memories and message history.
*/
const {
  assembleMemory,
  getUserMessageHistory,
  getUserMemory,
  storeUserMessage,
  storeUserMemory,
} = require("./capabilities/remember.js");

const {
  calculate
} = require("./capabilities/calculator.js");

const {
  askWolframAlpha
} = require("./capabilities/wolframalpha.js");

const {
  searchWikipedia
} = require("./capabilities/wikipedia.js");

const { GithubCoach } = require("./capabilities/github.js");
const github = new GithubCoach();



/*
🌐 Our trusty browsing companion! The 'chrome_gpt_browser' module,
giving us fetching and parsing superpowers for URLs.
*/
const {
  fetchAndSummarizeUrl,
  fetchAllLinks
} = require("./chrome_gpt_browser.js");

// 💪 Flexin' on 'em with our list of cool capabilities!
const capabilities = require("./capabilities/_manifest.js").capabilities;

// capability prompt
// to tell the robot all the capabilities it has and what they do
const capabilityPrompt = `${CAPABILITY_PROMPT_INTRO}

These are all of your capabilities:
${capabilities
  .map((capability) => {
    return `* ${capability.slug}: ${
      capability.description
    }, methods: ${capability.methods
      ?.map((method) => {
        return method.name //+ ' Parameters: ' + JSON.stringify(method.parameters)
      })
      .join(", ")}`;
  })
  .join("\n")}
`;

// 🍃 Breathe some life into our dotenv configuration
dotenv.config();
const configuration = new Configuration({
  apiKey: process.env.OPENAI_API_KEY,
  organization: process.env.OPENAI_API_ORGANIZATION,
});
const openai = new OpenAIApi(configuration);

/*
🤖 Assemble! The Discord client creation begins here.
We plug in our intents for listening to the digital whispers of the servers.
*/
const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
    GatewayIntentBits.GuildMessageReactions,
  ],
});
client.login(process.env.DISCORD_BOT_TOKEN);

// 🎉 Event handlers: a lineup of our bot's finest functions
client.once(Events.ClientReady, onClientReady);
client.on(Events.InteractionCreate, onInteractionCreate);
client.on("debug", onDebug);
client.on("error", onError);
client.on("messageCreate", onMessageCreate);

// 🌈 onClientReady: our bot's grand entrance to the stage
function onClientReady(c) {
  console.log(`⭐️ Ready! Logged in as ${c.user.username}`);
  logGuildsAndChannels();
  // scheduleRandomMessage();
}

// 🎭 onInteractionCreate: a silent observer of interactions
function onInteractionCreate(interaction) {
  // Log every interaction we see (uncomment the line below if needed)
  // console.log(interaction);
}

// 🔍 onDebug: our bot's little magnifying glass for problem-solving
function onDebug(info) {
  // console.log(`Debug info: ${info}`);
}

// ⚠️ onError: a sentinel standing guard against pesky errors
function onError(error) {
  console.error(`Client error: ${error}`);
}

// 💌 onMessageCreate: where the magic of conversation begins
async function onMessageCreate(message) {
  try {
    const botMentioned = message.mentions.has(client.user);

    const username = message.author.username;

    if (!message.author.bot && botMentioned) {
      const typingInterval = setInterval(
        () => message.channel.sendTyping(),
        5000
      );
      const prompt = removeMentionFromMessage(message.content, "@coachartie");

      const chainMessageStart = [
        {
          role: "user",
          content: prompt,
        },
      ];

      const response = await processMessageChain(message, chainMessageStart, username);
      const robotResponse = response[response.length - 1].content;
      // stop typing
      clearInterval(typingInterval);
      // split and send the response
      splitAndSendMessage(robotResponse, message);
      console.log(`🤖 Response: ${robotResponse}`);

      const rememberMessage = await generateAndStoreRememberCompletion(message, prompt, robotResponse);

      // Save the message to the database
      await storeUserMessage(message.author.username, message.content);

      console.log(`🧠 Message saved to database: ${message.content}`);
      console.log(`🧠 Memory saved to database: ${JSON.stringify(rememberMessage)}`);


    }
  } catch (error) {
    console.log(error);
  }
}

// 🎬 Utility functions: the unsung heroes of our code

// 🔪 removeMentionFromMessage: slice out the mention from the message
function removeMentionFromMessage(message, mention) {
  return message.replace(mention, "").trim();
}

// 💬 generateResponse: a masterful weaver of AI-generated replies
// async function generateResponse(prompt, username) {
//   try {
//     const response = await handleMessage(prompt, username);
//     return { response };
//   } catch (error) {
//     console.error("Error generating response:", error);
//     // return "Sorry, I could not generate a response... there was an error.";
//     return { response: ERROR_MSG };
//   }
// }

// 📤 splitAndSendMessage: a reliable mailman for handling lengthy messages
function splitAndSendMessage(message, messageObject) {
  if (!message) return messageObject.channel.send(ERROR_MSG);

  if (message.length < 2000) {
    messageObject.channel.send(message);
  } else {
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
    messageObject.channel.send(responseString);
  }
}

// 🧠 generateAndStoreRememberCompletion: the architect of our bot's memory palace
async function generateAndStoreRememberCompletion(message, prompt, response, username = '') {
  const rememberCompletion = await openai.createChatCompletion({
    model: "gpt-3.5-turbo",
    temperature: 0.82,
    max_tokens: 600,
    messages: [
      {
        role: "system",
        content: PROMPT_REMEMBER_INTRO,
      },
      // {
      //   role: "system",
      //   content: PROMPT_REMEMBER,
      // },
      {
        role: "user",
        content: '<User>: '+prompt,
      },
      {
        role: "assistant",
        content: '<Coach Artie>: '+response,
      },
      {
        role: "user",
        content: PROMPT_REMEMBER,
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

  messages.push({
    role: "assistant",
    content: `Hello, I'm Coach Artie, the hyper-intelligent virtual AI coach and assistant for Room 302 Studio!

My primary goal is to support our amazing studio members, EJ, Ian, and Curran, by providing resources, answering questions, and facilitating collaboration. 🎨🎶💡

Please feel free to ask any questions or request assistance, and I'll be more than happy to help. I'll prioritize information I remember from my interactions with our studio members, and if you're a student from The Birch School, I welcome your inquiries as well! 🌳👋

Remember, I'm here to foster a positive environment that encourages growth, learning, and exploration.`,
  });

  const capabilityMessage = {
    role: "system",
    content: capabilityPrompt,
  };

  messages.push(capabilityMessage);

  // get user memories
  const userMemories = await getUserMemory(username);

  // turn user memories into chatbot messages
  userMemories.forEach((memory) => {
    messages.push({
      role: "system",
      content: `You remember ${memory.value}`,
    });
  });
  
  // get user messages
  const userMessages = await getUserMessageHistory(username)

  // turn previous user messages into chatbot messages
  userMessages.forEach((message) => {
    messages.push({
      role: "system",
      content: `previously this user said: <${message.user_id}>: ${message.value}`,
    });
  });

  return messages

}

// 📨 handleMessage: the brain center for processing user messages
// async function handleMessage(userMessage, username) {
//   let messages = [];

//   const msg = replaceRobotIdWithName(userMessage);

//   // add premable to messages
//   messages = await assembleMessagePreamble(username);

//   const memories = await assembleMemory(username, getRandomInt(3, 20));

//   const messageHistory = await getUserMessageHistory(username);

//   // add the messagehistory to the memories
//   messageHistory.forEach((message) => {
//     memories.push(
//       `previously this user said: <${message.user_id}>: ${message.value}`
//     );
//   });

//   // turn memories into chatbot messages for completion
//   memories.forEach((memory) => {
//     console.log("memory -->", memory);
//     messages.push({
//       role: "system",
//       content: `You remember ${memory}`,
//     });
//   });

//   messages.push({
//     role: "user",
//     content: msg,
//   });

//   // use chance to make a temperature between 0.7 and 0.99
//   const temperature = chance.floating({ min: 0.7, max: 0.99 });

//   // use chance to pick max_tokens between 500 and 1200
//   const maxTokens = chance.integer({ min: 500, max: 1200 });

//   // console.log the messages for debugging
//   messages.forEach((message) => {
//     const roleEmoji = (message) => {
//       if (message.role === "system") {
//         return "🔦";
//       } else if (message.role === "user") {
//         return "👤";
//       } else if (message.role === "assistant") {
//         return "🤖";
//       }
//     };

//     console.log(`${roleEmoji(message)} <${message.role}>: ${message.content}`);
//   });

//   const chatCompletion = await openai.createChatCompletion({
//     model: "gpt-4",
//     temperature,
//     max_tokens: maxTokens,
//     messages: messages,
//   });

//   // do a beautiful log of the chatbot's response
//   console.log(
//     `🤖 <Coach Artie>: ${chatCompletion.data.choices[0].message.content}`
//   );

//   // return chatCompletion.data.choices[0].message.content;
//   return [
//     {
//       role: "assistant",
//       content: chatCompletion.data.choices[0].message.content,
//     },
//   ];
// }

// 📦 logGuildsAndChannels: a handy helper for listing servers and channels
function logGuildsAndChannels() {
  console.log("\n🌐 Connected servers and channels:");
  client.guilds.cache.forEach((guild) => {
    console.log(` - ${guild.name}`);
    // guild.channels.cache.forEach((channel) => {
    //   console.log(`\t#${channel.name} (${channel.id}, type: ${channel.type})`);
    // });
  });
}

// ⏰ scheduleRandomMessage: a ticking time bomb of random messages
function scheduleRandomMessage() {
  const interval = getRandomInt(60000 * 20, 60000 * 60);
  setTimeout(() => {
    sendRandomMessageInRandomChannel();
    scheduleRandomMessage();
  }, interval);
}

// 🗃️ getRandomInt: a random number generator powered by chance.js
function getRandomInt(min, max) {
  return chance.integer({ min, max });
}

// 🤖 replaceRobotIdWithName: given a string, replace the robot id with the robot name
function replaceRobotIdWithName(string) {
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

// 📝 callCapabilityMethod: a function for calling capability methods
async function callCapabilityMethod(capabilitySlug, methodName, args) {
  console.log("✨✨✨✨✨✨✨✨✨");
  console.log(
    `Calling capability method: ${capabilitySlug}.${methodName} with args: ${args}`
  );

  // now we need to figure out what the capability is
  // const capability = capabilities.find(
  //   (capability) => capability.slug === capabilitySlug
  // );
  // // if those don't exist, we should throw an error
  // if (!capability) {
  //   const error = `Capability not found for ${capabilitySlug}`;
  //   console.error(error);
  //   return `Error: ${error}`;
  // }

  // but if they DO exist, we are in business!
  // let's call the method assuming it has been imported already
  if(capabilitySlug === 'web') {
    if (methodName === 'fetchAndSummarizeUrl') {
      const url = args
      const summary = await fetchAndSummarizeUrl(url);
      return summary;
    } else if (methodName === 'fetchAllLinks') {
      const url = args
      const links = await fetchAllLinks(url);
      return links;
    }
  } else if (capabilitySlug === 'calculator') {
    if (methodName === 'calculate') {
      // const expression = args;
      // split the expression into an array on commas
      // const expressionArray = expression.split(",");
      // const result = calculate(expressionArray[0], expressionArray[1], expressionArray[2]);
      const result = calculate(args);
      return 'Calculator result: ' + result.toString();
    }
  } else if (capabilitySlug === 'wolframalpha') {
    if (methodName === 'askWolframAlpha') {
      const question = args;
      console.log('Asking wolfram alpha', question);
      const result = await askWolframAlpha(question);
      return result;
    }
  } else if (capabilitySlug === 'wikipedia') {
    if (methodName === 'searchWikipedia') {
      const question = args;
      const result = await searchWikipedia(question);
      return result;
    }
  } else if (capabilitySlug === 'github') {
    if (methodName === 'createRepo') {
      const repoName = args;
      const result = await github.createRepo(repoName);
      return result;
    } else if (methodName === 'listRepos') {
      const result = await github.listRepos();
      return result;
    } else if (methodName === 'listBranches') {
      const repoName = args;
      const result = await github.listBranches(repoName);
      return result;
    } else if (methodName === 'createFile') {
      const repoName = args;
      const result = await github.createFile(repoName);
      return result;
    } else if (methodName === 'editFile') {
      const arguments = args.split(',');
      const repoName = arguments[0];
      const filePath = arguments[1];
      const content = arguments[2];
      const commitMessage = arguments[3];
      const result = await github.editFile(repoName, filePath, content, commitMessage);
      return result;
    } else if (methodName === 'deleteFile') {
      const arguments = args.split(',');
      const repoName = arguments[0];
      const filePath = arguments[1];
      const commitMessage = arguments[2];
      const result = await github.deleteFile(repoName, filePath, commitMessage);
      return result;
    } else if (methodName === 'createBranch') {
      const arguments = args.split(',');
      const repoName = arguments[0];
      const branchName = arguments[1];
      const result = await github.createBranch(repoName, branchName);
      return result;
    } else if (methodName === 'createPullReuqest') {
      const arguments = args.split(',');
      const repoName = arguments[0];
      const title = arguments[1];
      const headBranch = arguments[2];
      const baseBranch = arguments[3];
      const prDescription = arguments[4];
      const result = await github.createPullReuqest(repoName, title, headBranch, baseBranch, prDescription);
      return result;
    } else if (methodName === 'readFileContents') {
      const arguments = args.split(',');
      const repoName = arguments[0];
      const filePath = arguments[1];
      const result = await github.readFileContents(repoName, filePath);
      return result;
    }
  } else if (capabilitySlug === 'chance') {
    if (methodName === 'choose') {
      const arguments = args.split(',');
      const result = chance.pickone(arguments);
      return result;
    } else if (methodName === 'floating') {
      const arguments = args.split(',');
      const result = chance.floating({ min: arguments[0], max: arguments[1] });
      return result;
    } else if (methodName === 'integer') {
      const arguments = args.split(',');
      const result = chance.integer({ min: arguments[0], max: arguments[1] });
      return result;
    } 
  }

  return `Error: the capability method ${methodName} was not found for ${capabilitySlug} - maybe try a different method?`;
}

// 📝 processMessageChain: a function for processing message chains
async function processMessageChain(message, messages, username) {
  // console.log("Processing message chain:", messages);
  // console.log("Messages: ", messages.length);

  if(!messages.length) {
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

  // NEW:
  // capability commands look like
  // capability:method(args)

  // examples:
  // remember:storeUserMemory(remember this for later)
  // or
  // remember:assembleMemories()
  // or
  // web:readWebPage(https://example.com)

  const capabilityRegex = /(\w+):(\w+)\((.*)\)/;
  const capabilityMatch = lastMessage.content.match(capabilityRegex);

  console.log("Capability match: ", capabilityMatch);

  // if (!capabilityMatch) {
  // if there is no capability match and the last message is not from the user
  if (!capabilityMatch && lastMessage.role !== "user" && lastMessage.role !== "system") {
    console.log("No capability found in the last message, breaking the chain.");
    return messages;
  }

  if (capabilityMatch) {
    const [_, capSlug, capMethod, capArgs] = capabilityMatch;

    // tell the channel about the capability being run
    message.channel.send(
      `🤖 Running capability ${capSlug}:${capMethod}(${capArgs})`
    );

    let capabilityResponse;

    try {
    capabilityResponse = await callCapabilityMethod(
      capSlug,
      capMethod,
      capArgs
    );
    } catch (e) {
      console.log("Error calling capability method: ", e);
      capabilityResponse = "Error calling capability method: " + e;
    }

    try{
    message.channel.send(
      `🔭 Capability ${capSlug}:${capMethod}(${capArgs}) responded with: 

\`\`\`
${capabilityResponse.slice(0, 500)}...
\`\`\``
    );
    } catch (e) {
      console.log("Error sending message: ", e);
    }

    const trimmedCapabilityResponse = capabilityResponse.slice(0, 4096)

    const systemMessage = {
      role: "system",
      content: `Capability ${capSlug}:${capMethod}(${capArgs}) responded with: ${trimmedCapabilityResponse}`
    };

    

    console.log("Adding system message to the chain:", systemMessage);
    messages.push(systemMessage);
  }

  // beautiful console.log for messages
  console.log("📝 Message chain:");
  messages.forEach((message) => {
    console.log(` - ${message.role}: ${message.content}`);
  });

  // use chance to make a random temperature between 0.5 and 0.99
  const temperature = chance.floating({ min: 0.5, max: 0.99 });

  const presence_penalty = chance.floating({ min: 0.2, max: 0.66 });

  // Call the OpenAI API to get the AI response based on the system message
  const completion = await openai.createChatCompletion({
    model: "gpt-4",
    temperature,
    presence_penalty,
    max_tokens: 1000,
    messages: messages,
  });
  

  const aiResponse = completion.data.choices[0].message;

  messages.push(aiResponse);

  console.log("Continuing the message chain.");
  return processMessageChain(message, messages);
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
  messageArray.forEach((message) => {
    // encode message.content
    const encodedMessage = encode(JSON.stringify(message));
    // console.log('Encoded Message: ', encodedMessage)
    totalTokens += encodedMessage.length;
  });
  return totalTokens;
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
