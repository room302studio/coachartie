// 📜 prompts: our guidebook of conversational cues
const prompts = require("../prompts");
const { openai } = require("./openai");
const { getHexagram, replaceRobotIdWithName } = require("../helpers.js");
const {
  getUserMemory,
  getAllMemories,
  storeUserMemory,
  getRelevantMemories,
} = require("../capabilities/remember.js");
const chance = require("chance").Chance();
const { CAPABILITY_PROMPT_INTRO } = require("../prompts.js");
const { getUserMessageHistory } = require("../capabilities/remember.js");

// 🚦 Constants Corner: prepping our prompts and error message
const { PROMPT_SYSTEM, PROMPT_REMEMBER, PROMPT_REMEMBER_INTRO } = prompts;

/**
 * Generates a remember completion and stores it in the database
 * @param {string} prompt - The prompt to generate a response for
 * @param {string} response - The robot's response to the prompt
 * @param {string} username - The username of the user to generate a remember completion for
 *
 * @returns {string} - The remember completion
 *
 */
async function generateAndStoreRememberCompletion(
  prompt,
  response,
  username = ""
) {
  console.log("🔧 Generating and storing remember completion", username);
  console.log("🔧 Prompt:", prompt);
  console.log("🔧 Response:", response);
  const userMemoryCount = chance.integer({ min: 1, max: 12 });
  const memoryMessages = [];
  // get user memories
  console.log(
    `🔧 Enhancing memory with ${userMemoryCount} memories from ${username}`
  );
  const userMemories = await getUserMemory(username, userMemoryCount);

  const generalMemories = await getAllMemories(userMemoryCount);

  // de-dupe memories
  const memories = [...userMemories, ...generalMemories];

  // turn user memories into chatbot messages
  memories.forEach((memory) => {
    memoryMessages.push({
      role: "system",
      content: `You remember from a previous interaction at ${memory.created_at}: ${memory.value}  `,
    });
  });

  const rememberCompletion = await openai.createChatCompletion({
    model: "gpt-3.5-turbo-16k",
    temperature: 1.2,

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
    ],
  });

  const rememberText = rememberCompletion.data.choices[0].message.content;
  console.log("🧠 Interaction memory", rememberText);

  // if the remember text is ✨ AKA empty, we don't wanna store it
  if (rememberText === "✨") return rememberText;
  // if remember text length is 0 or less, we don't wanna store it
  if (rememberText.length <= 0) return rememberText;
  console.log("🧠 Storing user memory", rememberText);
  await storeUserMemory(username, rememberText);

  return rememberText;
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
  // messages.push({
  //   role: "system",
  //   content: CAPABILITY_PROMPT_INTRO,
  // });

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

module.exports = {
  generateAndStoreRememberCompletion,
  assembleMessagePreamble,
};
