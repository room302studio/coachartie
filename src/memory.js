const { openai } = require("./openai");
const {
  getUserMemory,
  getAllMemories,
  storeUserMemory,
  getRelevantMemories,
} = require("./remember.js");
const chance = require("chance").Chance();
const vision = require("./vision.js");
const logger = require("../src/logger.js")("memory");
// const preambleLogger = require("../src/logger.js")("preamble");

const preambleLogger = {
  info: (message) => {},
};

const { getPromptsFromSupabase, getConfigFromSupabase } = require("../helpers");

module.exports = (async () => {
  const { PROMPT_REMEMBER, PROMPT_CAPABILITY_REMEMBER, PROMPT_REMEMBER_INTRO } =
    await getPromptsFromSupabase();

  const { REMEMBER_MODEL } = await getConfigFromSupabase();

  /**
   * Generates a completion and stores it in the database
   * @param {string} prompt - The prompt to generate a response for
   * @param {string} response - The robot's response to the prompt
   * @param {string} username - The username of the user to generate a completion for
   * @param {Array} conversationHistory - The entire conversation history up to the point of the user's last message
   * @param {boolean} isCapability - Whether the completion is for a capability or not
   * @param {string} capabilityName - The name of the capability (if applicable)
   *
   * @returns {string} - The completion text
   */
  async function logInteraction(
    prompt,
    response,
    { username = "", channel = "", guild = "" },
    conversationHistory = [],
    isCapability = false,
    capabilityName = "",
  ) {
    const userMemoryCount = chance.integer({ min: 4, max: 24 });
    const memoryMessages = [];

    const userMemories = await getUserMemory(username, userMemoryCount);
    const generalMemories = await getAllMemories(userMemoryCount);
    // const relevantMemories = isCapability
    //   ? await getRelevantMemories(capabilityName)
    //   : [];
    let relevantMemories = await getRelevantMemories(prompt, userMemoryCount);

    if (!relevantMemories) {
      relevantMemories = [];
    }

    let memories = [...userMemories, ...generalMemories];

    memories.forEach((memory) => {
      memoryMessages.push({
        role: "system",
        content: `${memory.created_at}: ${memory.value}  `,
      });
    });

    if (response.image) {
      const base64Image = response.image.split(";base64,").pop();
      vision.setImageBase64(base64Image);
      const imageDescription = await vision.fetchImageDescription();
      response.content = `${response.content}\n\nDescription of user-provided image: ${imageDescription}`;
      delete response.image;
    }

    const completeMessages = [
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
        content: isCapability ? PROMPT_CAPABILITY_REMEMBER : PROMPT_REMEMBER,
      },
    ];
    // make sure none of the completeMessages have an image
    // completeMessages.forEach((message) => {
    //   if (message.image) {
    //     delete message.image;
    //   }
    // });

    // preambleLogger.info(
    //   `📜 Preamble messages ${JSON.stringify(completeMessages)}`,
    // );

    // de-dupe memories
    memories = [...userMemories, ...generalMemories, ...relevantMemories];

    // turn user memories into chatbot messages
    memories.forEach((memory) => {
      memoryMessages.push({
        role: "system",
        content: `${memory.created_at}: ${memory.value}  `,
      });
    });

    const capabilityResponse = response;

    // if the response has a .image, we need to send that through the vision API to see what it actually is
    if (capabilityResponse.image) {
      // const imageUrl = message.attachments.first().url;
      // logger.info(imageUrl);
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

    // if (conversationHistory.length > 0) {
    //   // make sure none of the messages in conversation history have an image
    //   conversationHistory.forEach((message) => {
    //     if (message.image) {
    //       delete message.image;
    //     }
    //   });
    // }

    // make sure none of the memory messages have an image
    // memoryMessages.forEach((message) => {
    //   if (message.image) {
    //     delete message.image;
    //   }
    // });

    const rememberCompletion = await openai.chat.completions.create({
      model: REMEMBER_MODEL,
      // temperature: 1.1,
      // top_p: 0.9,
      presence_penalty: 0.1,
      max_tokens: 256,
      messages: [
        ...memoryMessages,
        ...conversationHistory,
        {
          role: "system",
          content: "Take a deep breath and take things step by step.",
        },
        {
          role: "system",
          content: `You previously ran the capability: ${capabilityName} and got the response: ${capabilityResponse}`,
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

    console.log("remember completion", rememberCompletion);

    const rememberText = rememberCompletion.choices[0].message.content;

    // if the remember text is ✨ AKA empty, we don't wanna store it
    if (rememberText === "✨") return rememberText;
    // if remember text length is 0 or less, we don't wanna store it
    if (rememberText.length <= 0) return rememberText;
    await storeUserMemory({ username: "capability" }, rememberText);

    return rememberText;
  }

  return {
    logInteraction,
  };
})();
