// 📜 prompts: our guidebook of conversational cues
const prompts = require("../prompts");
const { openai } = require("./openai");
const{ replaceRobotIdWithName } = require("../helpers.js");

// 🚦 Constants Corner: prepping our prompts and error message
const {
  PROMPT_SYSTEM,
  PROMPT_REMEMBER,
  PROMPT_REMEMBER_INTRO,
} = prompts;

// 🧠 generateAndStoreRememberCompletion: the architect of our bot's memory palace
async function generateAndStoreRememberCompletion(
  message,
  prompt,
  response,
  username = ""
) {
  const userMemoryCount = chance.integer({ min: 2, max: 48 });
  console.log(`🧠 Generating ${userMemoryCount} memories for ${username}`);

  const memoryMessages = [];
  // get user memories
  const userMemories = await getUserMemory(username, userMemoryCount);

  // turn user memories into chatbot messages
  userMemories.forEach((memory) => {
    memoryMessages.push({
      role: "system",
      content: `You remember from a previous interaction at ${memory.created_at}: ${memory.value}  `,
    });
  });

  const rememberCompletion = await openai.createChatCompletion({
    model: "gpt-3.5-turbo-16k",
    temperature: 0.75,
    max_tokens: 600,
    messages: [
      ...memoryMessages,
      {
        role: "system",
        content: PROMPT_REMEMBER_INTRO,
      },
      {
        role: "user",
        content: `${prompt}`,
      },
      {
        role: "assistant",
        content: `${response}`,
      },
      {
        role: "user",
        content: `${PROMPT_REMEMBER}`,
      },
      //       {
      //         role: "user",
      //         content: `${PROMPT_REMEMBER}

      // <User>: ${prompt}
      // <Coach Artie>: ${response}`,
      //       },
    ],
  });

  const rememberText = rememberCompletion.data.choices[0].message.content;

  // count the message tokens in the remember text
  // const rememberTextTokens = countMessageTokens(rememberText);
  // console.log(`🧠 Remember text tokens: ${rememberTextTokens}`);

  // if the remember text is ✨ AKA empty, we don't wanna store it
  if (rememberText === "✨") return rememberText;
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
    console.log(`🔮 Adding hexagram prompt to message ${hexagramPrompt}`);
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

  const userMessageCount = chance.integer({ min: 4, max: 16 });

  console.log(`🧠 Retrieving ${userMessageCount} previous messages for ${username}`);

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

  const userMemoryCount = chance.integer({ min: 2, max: 12 });

  // get user memories
  const userMemories = await getUserMemory(username, userMemoryCount);

  const memories = userMemories;

  // turn user memories into chatbot messages
  memories.forEach((memory) => {
    messages.push({
      role: "system",
      content: `You remember from a previous interaction on ${memory.created_at}: ${memory.value}`,
    });
  });

  

  return messages;
}

module.exports = {
  generateAndStoreRememberCompletion,
  assembleMessagePreamble,
};