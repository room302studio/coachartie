const { openai } = require("./openai");
const { getHexagram, replaceRobotIdWithName } = require("../helpers.js");
const {
  getUserMemory,
  getAllMemories,
  storeUserMemory,
  getRelevantMemories,
} = require("./remember.js");
const chance = require("chance").Chance();
const vision = require("./vision.js");

// 📜 prompts: our guidebook of conversational cues
const prompts = require("../prompts");
const { PROMPT_REMEMBER, PROMPT_CAPABILITY_REMEMBER, PROMPT_REMEMBER_INTRO } = prompts;

const REMEMBER_MODEL = "gpt-4-1106-preview"

/**
 * Generates a remember completion and stores it in the database
 * @param {string} prompt - The prompt to generate a response for
 * @param {string} response - The robot's response to the prompt
 * @param {string} username - The username of the user to generate a remember completion for
 * @param {Array} conversationHistory - The entire conversation history up to the point of the user's last message
 *
 * @returns {string} - The remember completion
 *
 */
async function generateAndStoreRememberCompletion(
  prompt,
  response,
  username = "",
  conversationHistory = [],
) {
  console.log("🔧 Generating and storing remember completion", username);
  console.log("🔧 Prompt:", prompt);
  console.log("🔧 Response:", response);
  const userMemoryCount = chance.integer({ min: 4, max: 24 });
  const memoryMessages = [];

  // get user memories
  console.log(
    `🔧 Enhancing memory with ${userMemoryCount} memories from ${username}`,
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

  // if the response has a .image, delete that
  if (response.image) {
    delete response.image;
  }

  // make sure none of the messages in conversation history have an image
  conversationHistory.forEach((message) => {
    if (message.image) {
      delete message.image;
    }
  });

  // make sure none of the memory messages have an image
  memoryMessages.forEach((message) => {
    if (message.image) {
      delete message.image;
    }
  });

  const rememberCompletion = await openai.createChatCompletion({
    model: REMEMBER_MODEL,
    // temperature: 1.1,
    // top_p: 0.9,
    presence_penalty: 0.1,
    max_tokens: 256,
    messages: [
      ...conversationHistory,
      ...memoryMessages,
      {
        role: "system",
        content: "---",
      },
      {
        role: "system",
        content: PROMPT_REMEMBER_INTRO,
      },
      {
        role: "user",
        content: `# User (${username}): ${prompt} \n # Robot (Artie): ${response}`,
      },
      {
        role: "user",
        content: `${PROMPT_REMEMBER}`,
      },
    ],
  });

  const rememberText = rememberCompletion.data.choices[0].message.content;
  // console.log("🧠 Interaction memory", rememberText);

  // if the remember text is ✨ AKA empty, we don't wanna store it
  if (rememberText === "✨") return rememberText;
  // if remember text length is 0 or less, we don't wanna store it
  if (rememberText.length <= 0) return rememberText;
  await storeUserMemory(username, rememberText);

  return rememberText;
}

/**
 * 
 * @param {string} prompt - The prompt to generate a response for
 * @param {string} capabilityResponse - The robot's response to the prompt
 * @param {string} capabilityName - The name of the capability
 * @param {string} username - The username of the user to generate a remember completion for
 * @param {Array} conversationHistory - The entire conversation history up to the point of the user's last message
 */
async function generateAndStoreCapabilityCompletion(
  prompt,
  capabilityResponse,
  capabilityName,
  username = "",
  conversationHistory = [],
) {
  console.log("🔧 Generating and storing capability usage");
  console.log("🔧 Prompt:", prompt);
  console.log("🔧 Response:", capabilityResponse);
  const userMemoryCount = chance.integer({ min: 1, max: 6 });
  const memoryMessages = [];

  // get user memories
  console.log(
    `🔧 Enhancing memory with ${userMemoryCount} memories from ${username}`,
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

  // if the response has a .image, we need to send that through the vision API to see what it actually is
  if (capabilityResponse.image) {
    // const imageUrl = message.attachments.first().url;
    // console.log(imageUrl);
    // vision.setImageUrl(imageUrl);
    // const imageDescription = await vision.fetchImageDescription();
    // return `${prompt}\n\nDescription of user-provided image: ${imageDescription}`;

    // first we need to turn the image into a base64 string
    const base64Image = capabilityResponse.image.split(";base64,").pop();
    // then we need to send it to the vision API
    vision.setImageBase64(base64Image);
    const imageDescription = await vision.fetchImageDescription();
    // then we need to add the description to the response
    
  }

  // make sure none of the messages in conversation history have an image
  conversationHistory.forEach((message) => {
    if (message.image) {
      delete message.image;
    }
  });

  // make sure none of the memory messages have an image
  memoryMessages.forEach((message) => {
    if (message.image) {
      delete message.image;
    }
  });

  const rememberCompletion = await openai.createChatCompletion({
    model: REMEMBER_MODEL,
    // temperature: 1.1,
    // top_p: 0.9,
    presence_penalty: 0.1,
    max_tokens: 256,
    messages: [
      ...conversationHistory,
      ...memoryMessages,
      {
        role: "system",
        content: "---",
      },
      {
        role: "system",
        content: `You remember from a previous interaction: ${capabilityName} ${capabilityResponse}`,
      },
      {
        role: "user",
        content: `${prompt}`,
      },
      {
        role: "assistant",
        content: `${capabilityResponse}`,
      },
      {
        role: "user",
        content: `${PROMPT_CAPABILITY_REMEMBER}`,
      },
    ],
  });

  const rememberText = rememberCompletion.data.choices[0].message.content

  // if the remember text is ✨ AKA empty, we don't wanna store it
  if (rememberText === "✨") return rememberText;
  // if remember text length is 0 or less, we don't wanna store it
  if (rememberText.length <= 0) return rememberText;
  await storeUserMemory(username, rememberText);

  return rememberText;
}


module.exports = {
  generateAndStoreRememberCompletion,
  generateAndStoreCapabilityCompletion,
};
