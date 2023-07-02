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
  getAllMemories,
  getUserMemory,
  storeUserMessage,
  storeUserMemory,
} = require("./capabilities/remember.js");

const { calculate } = require("./capabilities/calculator.js");

const { askWolframAlpha } = require("./capabilities/wolframalpha.js");

const { askWikipedia } = require("./capabilities/wikipedia.js");

const { listFiles, readFile, appendString } = require("./capabilities/google-drive.js");

const { GithubCoach } = require("./capabilities/github.js");
const github = new GithubCoach();

/*
🌐 Our trusty browsing companion! The 'chrome_gpt_browser' module,
giving us fetching and parsing superpowers for URLs.
*/
const {
  fetchAndSummarizeUrl,
  fetchAllLinks,
} = require("./chrome_gpt_browser.js");

// 💪 Flexin' on 'em with our list of cool capabilities!
const capabilities = require("./capabilities/_manifest.js").capabilities;

// capability prompt
// to tell the robot all the capabilities it has and what they do
// Prepare information in capabilities array
const prepareCapabilities = capabilities.map((capability) => {

  // Map each method inside a capability
  const methods = capability.methods?.map((method) => {
    return `\n ${method.name}: ${method.description} call like: ${capability.slug}:${method.name}(${method.parameters.map(d => d.name).join(',')})`;
  });

  // Return the capability information with its methods
  return `\n## ${capability.slug}: ${capability.description} 
${methods}`;
});

// Combine everything to build the prompt message
const capabilityPrompt = `
${CAPABILITY_PROMPT_INTRO}

These are all of your capabilities:
${prepareCapabilities.join("\n")}
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

    // we can also detect if the channel we are receiving the message from has a 🤖 - and if so, we will respond to it
    const channelNameHasBot = message.channel.name.includes("🤖");

    if (!message.author.bot && (botMentioned || channelNameHasBot)) {
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

      const response = await processMessageChain(
        message,
        chainMessageStart,
        username
      );
      const robotResponse = response[response.length - 1].content;
      // stop typing
      clearInterval(typingInterval);
      // split and send the response
      splitAndSendMessage(robotResponse, message);
      console.log(`🤖 Response: ${robotResponse}`);

      const rememberMessage = await generateAndStoreRememberCompletion(
        message,
        prompt,
        robotResponse
      );

      // Save the message to the database
      await storeUserMessage(message.author.username, message.content);

      console.log(`🧠 Message saved to database: ${message.content}`);
      console.log(
        `🧠 Memory saved to database: ${JSON.stringify(rememberMessage)}`
      );
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
    // sometimes message.split is not a function
    // so we check if it is a string first
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

// 🧠 generateAndStoreRememberCompletion: the architect of our bot's memory palace
async function generateAndStoreRememberCompletion(
  message,
  prompt,
  response,
  username = ""
) {
  const rememberCompletion = await openai.createChatCompletion({
    model: "gpt-3.5-turbo",
    temperature: 0.75,
    max_tokens: 600,
    messages: [
      {
        role: "user",
        content: PROMPT_REMEMBER_INTRO,
      },
      {
        role: "user",
        content: `${PROMPT_REMEMBER}

<User>: ${prompt}
<Coach Artie>: ${response}`,
      },
    ],
  });

  const rememberText = rememberCompletion.data.choices[0].message.content;

  // count the message tokens in the remember text
  // const rememberTextTokens = countMessageTokens(rememberText);
  // console.log(`🧠 Remember text tokens: ${rememberTextTokens}`);

  // if the remember text is ✨ AKA empty, we don't wanna store it
  if (rememberText === "✨") return;
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

  // pick a random hexagram from the i ching to guide this interaction
  const hexagramPrompt = `Let this hexagram from the I Ching guide this interaction: ${getHexagram()}`;

  if (chance.bool({ likelihood: 50 })) {
    messages.push({
      role: "system",
      content: hexagramPrompt,
    });
  }

  // add all the system prompts to the messsage
  messages.push({
    role: "user",
    content: PROMPT_SYSTEM,
  });

  messages.push({
    role: "system",
    content: capabilityPrompt,
  });

  const userMemoryCount = chance.integer({ min: 2, max: 12 });

  // get user memories
  const userMemories = await getUserMemory(username, userMemoryCount);

  const memories = userMemories

  // turn user memories into chatbot messages
  memories.forEach((memory) => {
    messages.push({
      role: "system",
      content: `You remember: ${memory.value} // ${memory.created_at}`,
    });
  });

  const userMessageCount = chance.integer({ min: 4, max: 16 });

  // get user messages
  const userMessages = await getUserMessageHistory(username, userMessageCount);

  // reverse the order of the messages
  userMessages.reverse();

  // turn previous user messages into chatbot messages
  userMessages.forEach((message) => {
    messages.push({
      role: "user",
      content: `${replaceRobotIdWithName(message.value)}`,
    });
  });

  return messages;
}

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
  console.log(
    `Calling capability method: ${capabilitySlug}.${methodName} with args: ${args}`
  );

  // but if they DO exist, we are in business!
  // let's call the method assuming it has been imported already
  if (capabilitySlug === "web") {
    if (methodName === "fetchAndSummarizeUrl") {
      const url = args;
      const summary = await fetchAndSummarizeUrl(url);

      const summaryWithPreamble = `The webpage (${url}) was analyzed for facts and URLs that could help the user accomplish their goal. What follows is a summary of the most relevant information: \n\n${summary}\n\nDetermine whether the information on this page is relevant to your goal, or if you might need to use your capabilities to find more information. Summarize what you have done so far, what the current status is, and what the next steps are.`;

      return summaryWithPreamble;
    } else if (methodName === "fetchAllLinks") {
      const url = args;
      const links = await fetchAllLinks(url);
      return links;
    }
  } else if (capabilitySlug === "calculator") {
    if (methodName === "calculate") {
      const result = calculate(args);
      return "Calculator result: " + result.toString();
    }
  } else if (capabilitySlug === "googledrive") {
    if (methodName === "listFiles") {
      return await listFiles();
    } else if (methodName === 'readFile') {
      const fileId = args;
      return await readFile(fileId);
    } else if (methodName === 'appendString') {
      const fileId = args.split(",")[0];
      const string = args.split(",")[1];
      return await appendString(fileId, string);
    }
  } else if (capabilitySlug === "wolframalpha") {
    if (methodName === "askWolframAlpha") {
      const question = args;
      console.log("Asking wolfram alpha", question);
      const result = await askWolframAlpha(question);
      return result;
    }
  } else if (capabilitySlug === "wikipedia") {
    if (methodName === "askWikipedia") {
      const question = args;
      const result = await askWikipedia(question);
      return result;
    }
  }  else if (capabilitySlug === "chance") {
    if (methodName === "choose") {
      const arguments = args.split(",");
      const result = chance.pickone(arguments);
      return result;
    } else if (methodName === "floating") {
      const arguments = args.split(",");
      const result = chance.floating({ min: +arguments[0], max: +arguments[1] });
      return result;
    } else if (methodName === "integer") {
      const arguments = args.split(",");
      const result = chance.integer({ min: +arguments[0], max: +arguments[1] });
      return result;
    } 
  } else if (capabilitySlug === "github") {
    if (methodName === "createRepo") {
      const repoName = args;
      const result = await github.createRepo(repoName);
      return result;
    } else if (methodName === "listRepos") {
      const result = await github.listRepos();
      return result;
    } else if (methodName === "createGist") {
      const firstCommaIndex = args.indexOf(",");
      const secondCommaIndex = args.indexOf(",", firstCommaIndex + 1);
      const fileName = args.substring(0, firstCommaIndex);
      const description = args.substring(
        firstCommaIndex + 1,
        secondCommaIndex
      );
      const contentString = args.substring(secondCommaIndex + 1);

      const result = await github.createGist(
        fileName,
        description,
        contentString
      );
      return result;
    } else if (methodName === "addDraftIssueToProject") {
      const arguments = args.split(",");
      const projectId = arguments[0];
      const issueTitle = arguments[1];
      const issueBody = arguments[2];
      const result = await github.addDraftIssueToProject(
        projectId,
        issueTitle,
        issueBody
      );
      return result;
    } else if (methodName === "getProjectIdFromUrl") {
      const url = args;
      const result = await github.getProjectIdFromUrl(url);
      return result;
    } else if (methodName === "listUserProjects") {
      const userName = args;
      const result = await github.listUserProjects(userName);
      return result;
    } else if (methodName === "listProjectColumnsAndCards") {
      const projectId = args;
      const result = await github.listProjectColumnsAndCards(projectId);
      return result;
    } else if (methodName === "listUserRepos") {
      const userName = args;
      const result = await github.listUserRepos(userName);
      return result;
    } else if (methodName === "listBranches") {
      const repoName = args;
      const result = await github.listBranches(repoName);
      return result;
    } else if (methodName === "createFile") {
      // const repoName = args;
      // async createFile(repositoryName, filePath, content, commitMessage) {
      const arguments = args.split(",");
      const repoName = arguments[0];
      const filePath = arguments[1];
      const content = arguments[2];
      const commitMessage = arguments[3];
      const result = await github.createFile(
        repoName,
        filePath,
        content,
        commitMessage
      );
      return result;
    } else if (methodName === "editFile") {
      const arguments = args.split(",");
      const repoName = arguments[0];
      const filePath = arguments[1];
      const content = arguments[2];
      const commitMessage = arguments[3];
      const result = await github.editFile(
        repoName,
        filePath,
        content,
        commitMessage
      );
      return result;
    } else if (methodName === "deleteFile") {
      const arguments = args.split(",");
      const repoName = arguments[0];
      const filePath = arguments[1];
      const commitMessage = arguments[2];
      const result = await github.deleteFile(repoName, filePath, commitMessage);
      return result;
    } else if (methodName === "createBranch") {
      const arguments = args.split(",");
      const repoName = arguments[0];
      const branchName = arguments[1];
      const result = await github.createBranch(repoName, branchName);
      return result;
    } else if (methodName === "createPullReuqest") {
      const arguments = args.split(",");
      const repoName = arguments[0];
      const title = arguments[1];
      const headBranch = arguments[2];
      const baseBranch = arguments[3];
      const prDescription = arguments[4];
      const result = await github.createPullReuqest(
        repoName,
        title,
        headBranch,
        baseBranch,
        prDescription
      );
      return result;
    } else if (methodName === "readFileContents") {
      const arguments = args.split(",");
      const repoName = arguments[0];
      const filePath = arguments[1];
      const result = await github.readFileContents(repoName, filePath);
      return result;
    }
  }

  return `Error: the capability method ${methodName} was not found for ${capabilitySlug} - maybe try a different method?`;
}

// 📝 processMessageChain: a function for processing message chains
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

    if (currentTokenCount >= apiTokenLimit - 900) {
      console.log(
        "Token limit reached, adding system message to the chain reminding the bot to wrap it up."
      );
      messages.push({
        role: "user",
        content:
          "It looks like you are reaching the token limit. In the next response, please do not use a capability. Use all of this information to summarize a response.",
      });
      // return messages;
    }

    splitAndSendMessage(
      lastMessage.content,
      message,
    )

    // split and send that we are running the capability
    // splitAndSendMessage(
    //   `🤖 Running capability ${capSlug}:${capMethod}(${capArgs})`,
    //   message
    // );

    let capabilityResponse;

    try {
      capabilityResponse = await callCapabilityMethod(
        capSlug,
        capMethod,
        capArgs
      );
    } catch (e) {
      console.log("Error: ", e);
      capabilityResponse = "Capability error: " + e;
    }

    console.log("Capability response: ", capabilityResponse);

    // refactor to use the countMessageTokens function and a while to trim down the response until it fits under the token limit of 8000
    function countTokens(str) {
      const encodedMessage = encode(str.toString());
      const tokenCount = encodedMessage.length;
      return tokenCount;
    }

    while (countTokens(capabilityResponse) > 5120) {
      console.log(`Response is too long ${countTokens(capabilityResponse)}, trimming it down.`);

      // choose a random 10% of lines to remove
      const lines = capabilityResponse.split("\n");
      const lineCount = lines.length;
      const linesToRemove = Math.floor(lineCount * 0.1);
      console.log(`Removing ${linesToRemove} lines from the response.`);
      const randomLines = chance.pickset(lines, linesToRemove);
      const trimmedLines = lines.filter((line) => {
        return !randomLines.includes(line);
      }
      );
      capabilityResponse = trimmedLines.join("\n");

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
    })
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
      // model: "gpt-3.5-turbo-16k",
      temperature,
      presence_penalty,
      max_tokens: 820,
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

function isWithinSendingHours() {
  const currentTimeEST = getCurrentTimeEST();
  const startHour = 11; // 11 AM
  const endHour = 15; // 3 PM
  return (
    currentTimeEST.getHours() >= startHour &&
    currentTimeEST.getHours() < endHour
  );
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