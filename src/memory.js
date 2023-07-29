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

// 📜 prompts: our guidebook of conversational cues
const prompts = require("../prompts");
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

module.exports = {
  generateAndStoreRememberCompletion,
};
