const winston = require("winston");
const {
  countMessageTokens,
  doesMessageContainCapability,
  generateAiCompletionParams,
  generateAiCompletion,
  trimResponseIfNeeded,
  TOKEN_LIMIT,
  WARNING_BUFFER,
  isExceedingTokenLimit,
} = require("../helpers.js");
const { generateAndStoreRememberCompletion, generateAndStoreCapabilityCompletion } = require("./memory.js");
const { capabilityRegex, callCapabilityMethod } = require("./capabilities.js");
const { storeUserMessage } = require("../capabilities/remember");

const MAX_RETRY_COUNT = 3;
const MAX_CAPABILITY_CALLS = 6;

// Create a new logger instance
const logger = winston.createLogger({
  level: "info",
  format: winston.format.json(),
  defaultMeta: { service: "user-service" },
  transports: [
    new winston.transports.File({ filename: "capability-chain.log" }),
  ],
});

async function getCapabilityResponse(capSlug, capMethod, capArgs, messages) {
  let capabilityResponse;
  try {
    logger.info("Calling Capability: " + capSlug + ":" + capMethod);
    capabilityResponse = await callCapabilityMethod(
      capSlug,
      capMethod,
      capArgs,
      messages,
    );
    logger.info("Capability Responded: " + capSlug + ":" + capMethod);
  } catch (e) {
    logger.error(e);
    capabilityResponse = "Capability error: " + e;
    logger.error("Error: " + e);
  }

  logger.info("Capability Response: " + capabilityResponse);
  if (capabilityResponse.image) {
    logger.info("📍 Capability Response is an Image");
    return capabilityResponse;
  }

  return trimResponseIfNeeded(capabilityResponse);
}

async function processCapability(messages, capabilityMatch) {
  const [_, capSlug, capMethod, capArgs] = capabilityMatch;
  const currentTokenCount = countMessageTokens(messages);

  if (currentTokenCount >= TOKEN_LIMIT - WARNING_BUFFER) {
    logger.warn("Token Limit Warning: Current Tokens - " + currentTokenCount);
    messages.push(createTokenLimitWarning());
  }

  logger.info("Processing Capability: " + capSlug + ":" + capMethod);
  const capabilityResponse = await getCapabilityResponse(
    capSlug,
    capMethod,
    capArgs,
    messages,
  );

  // if the response has .image property, delete it
  // if (capabilityResponse.image) {
  //   delete capabilityResponse.image;
  // }

  const message = {
    role: "system",
    content:
      "Capability " +
      capSlug +
      ":" +
      capMethod +
      " responded with: " +
      capabilityResponse,
  };

  if (capabilityResponse.image) {
    message.image = capabilityResponse.image;
  }

  messages.push(message);

  return messages;
}

/**
 * Processes a message chain.
 *
 * @param {Array} messages - The array of messages in the chain.
 * @param {string} username - The username associated with the messages.
 * @param {string} message - The discord message
 * @param {number} [retryCount=0] - The number of times the processing should be retried in case of error.
 * @param {number} [capabilityCallCount=0] - The number of capability calls made during the processing.
 * @returns {Promise<Array>} - A promise that resolves to the processed message chain.
 * @throws {Error} - If an error occurs during the processing and the maximum retry count is exceeded.
 */
async function processMessageChain(
  messages,
  username,
  message,
  retryCount = 0,
  capabilityCallCount = 0,
) {
  if (!messages.length) {
    logger.warn("Empty Message Chain");
    return [];
  }

  let lastMessage = messages[messages.length - 1];

  if (lastMessage.image) {
    logger.info("Last Message is an Image");
    return messages;
  }

  try {
    do {
      logger.info(
        "Processing Message Chain: " + lastMessage.content.slice(0, 80) + "...",
      );
      messages = await processMessage(messages, lastMessage.content, username);
      lastMessage = messages[messages.length - 1];
      if (doesMessageContainCapability(lastMessage.content)) {
        capabilityCallCount++;
        message.channel.send(lastMessage.content);
      }
    } while (
      doesMessageContainCapability(lastMessage.content) &&
      !isExceedingTokenLimit(messages) &&
      capabilityCallCount <= MAX_CAPABILITY_CALLS
    );
  } catch (error) {
    if (retryCount < MAX_RETRY_COUNT) {
      logger.warn(
        `Error processing message chain, retrying (${
          retryCount + 1
        }/${MAX_RETRY_COUNT})`,
      );
      return processMessageChain(
        messages,
        username,
        retryCount + 1,
        capabilityCallCount,
      );
    } else {
      logger.error("Error processing message chain, maximum retries exceeded");
      throw error;
    }
  }

  return messages;
}

async function processMessage(messages, lastMessage, username) {
  if (doesMessageContainCapability(lastMessage)) {
    const capabilityMatch = lastMessage.match(capabilityRegex);

    try {
      messages = await processCapability(messages, capabilityMatch);
      // store a memory of the capability call
      await generateAndStoreCapabilityCompletion(
        lastMessage,
        messages[messages.length - 1].content,
        capabilityMatch[1],
        username,
        messages,
      );      

    } catch (error) {
      messages.push({
        role: "system",
        content: "Error processing capability: " + error,
      });
    }
  }

  if (messages[messages.length - 1].image) {
    logger.info("Last Message is an Image");
    return messages;
  }

  const lastUserMessage = messages.find((m) => m.role === "user");
  const prompt = lastUserMessage.content;

  storeUserMessage(username, prompt);

  const { temperature, frequency_penalty } = generateAiCompletionParams();

  const { aiResponse } = await generateAiCompletion(
    prompt,
    username,
    messages,
    {
      temperature,
      frequency_penalty,
    },
  );

  messages.push({
    role: "assistant",
    content: aiResponse,
  });

  generateAndStoreRememberCompletion(prompt, aiResponse, username, messages);

  return messages;
}

module.exports = {
  processMessageChain,
  processMessage,
  processCapability,
};
