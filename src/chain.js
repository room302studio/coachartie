const {
  countMessageTokens,
  doesMessageContainCapability,
  generateAiCompletionParams,
  generateAiCompletion,
  trimResponseIfNeeded,
  isExceedingTokenLimit,
  getUniqueEmoji,
} = require("../helpers");
const {
  generateAndStoreRememberCompletion,
  generateAndStoreCapabilityCompletion,
} = require("./memory");
const { capabilityRegex, callCapabilityMethod } = require("./capabilities");
const { storeUserMessage } = require("./remember");
const { CAPABILITY_ERROR_PROMPT } = require("../prompts");
const logger = require("../src/logger.js")("chain");

const {
  TOKEN_LIMIT,
  WARNING_BUFFER,
  MAX_CAPABILITY_CALLS,
  MAX_RETRY_COUNT,
} = require("../config");

/**
 * Processes a message chain.
 *
 * @param {Array} messages - The array of messages to process.
 * @param {Object} options - The options object containing username, channel, and guild.
 * @param {Object} message - The message object.
 * @param {number} [retryCount=0] - The number of retry attempts.
 * @param {number} [capabilityCallCount=0] - The number of capability calls.
 * @returns {Array} - The processed message chain.
 */

// TODO: Right now, I think, we accept too many arguments. And also, we depend on there being a `message` object, which we use to send our response. But it's not always there, sometimes, like if we are being run proactively, we need to actually look up the channel and send the message that way, instead of using message.send ... so we should probably refactor this to be more flexible and accept a channel object instead of a message object, and then we can send the message using the channel object instead of the message object. But that means we need to find every place that calls processMessageChain currently and update it to pass in the channel object instead of the message object. And then we can remove the message object from the processMessageChain function signature.

async function processMessageChain(
  messages,
  { username, channel, guild },
  retryCount = 0,
  capabilityCallCount = 0
) {
  const chainId = getUniqueEmoji();

  // if the message chain is empty, return
  if (!messages.length) {
    logger.warn(`Empty Message Chain`);
    return [];
  }

  // get the last message in the chain
  let lastMessage = messages[messages.length - 1];

  // if the last message is an image, return
  if (lastMessage.image) {
    logger.info(`Last Message is an Image`);
    return messages;
  }

  // try to process the message chain
  try {
    logger.info(`${chainId} - Message Chain started`);

    let capabilityCallIndex = 0;
    let chainReport = "";

    do {
      capabilityCallIndex++;
      logger.info(
        `${chainId} - Capability Call ${capabilityCallIndex} started: ${lastMessage.content.slice(
          0,
          2400
        )}...`
      );

      // process the last message in the chain
      try {
        const updatedMessages = await processMessage(
          messages,
          lastMessage.content,
          { username, channel, guild }
        );
        messages = updatedMessages;
        lastMessage = messages[messages.length - 1];

        if (doesMessageContainCapability(lastMessage.content)) {
          capabilityCallCount++;
          channel.send(lastMessage.content);
        }

        chainReport += `${chainId} - Capability Call ${capabilityCallIndex}: ${lastMessage.content.slice(
          0,
          80
        )}...\n`;

        logger.info(
          `${chainId} - Capability Call ${capabilityCallIndex} completed`
        );
      } catch (error) {
        logger.info(`Error processing message: ${error}`);
      }
    } while (
      doesMessageContainCapability(lastMessage.content) &&
      !isExceedingTokenLimit(messages) &&
      capabilityCallCount <= MAX_CAPABILITY_CALLS
    );

    logger.info(`${chainId} - Chain Report:\n${chainReport}`);
  } catch (error) {
    if (retryCount < MAX_RETRY_COUNT) {
      logger.warn(
        `Error processing message chain, retrying (${
          retryCount + 1
        }/${MAX_RETRY_COUNT})`,
        error
      );
      return processMessageChain(
        messages,
        { username, channel, guild },
        retryCount + 1,
        capabilityCallCount
      );
    } else {
      logger.info(
        `${chainId} - Error processing message chain, maximum retries exceeded`,
        error
      );
      throw error;
    }
  }

  return messages;
}

/**
 * Calls a capability method and returns the response.
 *
 * @param {string} capSlug - The slug of the capability.
 * @param {string} capMethod - The method of the capability to call.
 * @param {any[]} capArgs - The arguments to pass to the capability method.
 * @param {string[]} messages - The messages related to the capability.
 * @returns {Promise<any>} The capability response.
 */
async function getCapabilityResponse(capSlug, capMethod, capArgs, messages) {
  let capabilityResponse;
  try {
    logger.info("Calling Capability: " + capSlug + ":" + capMethod);
    capabilityResponse = await callCapabilityMethod(
      capSlug,
      capMethod,
      capArgs,
      messages
    );
  } catch (e) {
    capabilityResponse = `${capSlug}:${capMethod} failed with error: ${e}`;
    logger.info("Capability Failed: " + capabilityResponse);
  }

  if (capabilityResponse.image) {
    logger.info("Capability Response is an Image");
    return capabilityResponse;
  }

  return trimResponseIfNeeded(capabilityResponse);
}

/**
 * Processes a capability by executing the specified method with the given arguments.
 * If the token count exceeds the limit, a warning message is added to the messages array.
 * The capability response is added to the messages array.
 * @param {Array} messages - The array of messages.
 * @param {Array} capabilityMatch - The array containing the capability details.
 * @returns {Promise<Array>} - The updated array of messages.
 */
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
    messages
  );

  if (capabilityResponse.image) {
    delete capabilityResponse.image;
  }

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

  logger.info("Capability Response: " + capabilityResponse);

  if (capabilityResponse.image) {
    message.image = capabilityResponse.image;
  }

  messages.push(message);

  return messages;
}

/**
 * Processes a message and generates a response.
 * @param {Array} messages - The array of messages.
 * @param {string} lastMessage - The last message in the array.
 * @param {Object} options - The options object.
 * @param {string} options.username - The username.
 * @param {string} options.channel - The channel.
 * @param {string} options.guild - The guild.
 * @returns {Array} - The updated array of messages.
 */
async function processMessage(
  messages,
  lastMessage,
  { username = "", channel = "", guild = "" }
) {
  if (doesMessageContainCapability(lastMessage)) {
    const capabilityMatch = lastMessage.match(capabilityRegex);

    try {
      messages = await processCapability(messages, capabilityMatch);
      // store a memory of the capability call
      await generateAndStoreCapabilityCompletion(
        lastMessage,
        messages[messages.length - 1].content,
        capabilityMatch[1],
        { username, channel, guild },
        messages
      );
    } catch (error) {
      messages.push({
        role: "system",
        content: "Error processing capability: " + error,
      });

      messages.push({
        role: "user",
        content: CAPABILITY_ERROR_PROMPT,
      });
    }
  }

  if (messages[messages.length - 1].image) {
    logger.info("Last Message is an Image");
    return messages;
  }

  const lastUserMessage = messages
    .slice()
    .reverse()
    .find((m) => m.role === "user");
  const prompt = lastUserMessage.content;

  storeUserMessage({ username, channel, guild }, prompt);

  const { temperature, frequency_penalty } = generateAiCompletionParams();

  const { aiResponse } = await generateAiCompletion(
    prompt,
    username,
    messages,
    {
      temperature,
      frequency_penalty,
    }
  );

  messages.push({
    role: "assistant",
    content: aiResponse,
  });

  generateAndStoreRememberCompletion(
    prompt,
    aiResponse,
    { username, channel, guild },
    messages
  );

  generateAndStoreTaskEvaluation(
    prompt,
    aiResponse,
    { username, channel, guild },
    messages
  );

  return messages;
}

module.exports = {
  processMessageChain,
  processMessage,
  processCapability,
};
