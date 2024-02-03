const {
  countMessageTokens,
  doesMessageContainCapability,
  generateAiCompletionParams,
  trimResponseIfNeeded,
  isExceedingTokenLimit,
  getUniqueEmoji,
  assembleMessagePreamble,
} = require("../helpers");
const { generateAndStoreRememberCompletion } = require("./memory");
const { capabilityRegex, callCapabilityMethod } = require("./capabilities");
const { storeUserMessage } = require("./remember");
const { CAPABILITY_ERROR_MESSAGE } = require("../prompts");
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
  { username, channel, guild, isDM },
  retryCount = 0,
  capabilityCallCount = 0
) {
  const chainId = getUniqueEmoji();

  if (isDM) {
    logger.info(`DM Received from ${username}`);
  }

  // get the last message in the chain
  let lastMessage = messages[messages.length - 1];

  // if there is no lastMessage, return and error
  if (!lastMessage) {
    logger.error(`No Last Message`);
    return [
      {
        role: "system",
        content: CAPABILITY_ERROR_MESSAGE,
      },
    ];
  }

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
      logger.info(
        `${chainId} - Message Chain ${capabilityCallIndex} started: ${lastMessage.content.slice(
          0,
          4096
        )}...`
      );

      // process the last message in the chain
      try {
        if (doesMessageContainCapability(lastMessage.content)) {
          logger.info(
            `${chainId} - Message Chain ${capabilityCallIndex} contains capability`
          );
          const capabilityMatch = lastMessage.content.match(capabilityRegex);
          messages = await processCapability(messages, capabilityMatch);
          capabilityCallCount++;
          channel.send(lastMessage.content);
        } else {
          logger.info(
            `${chainId} - Message Chain ${capabilityCallIndex} does not contain capability`
          );
          messages = await processAiResponse(messages, {
            username,
            channel,
            guild,
          });

          logger.info(
            `${chainId} - Message Chain ${capabilityCallIndex} processed with ${messages.length} messages`
          );
        }

        chainReport += `${chainId} - Capability Call ${capabilityCallIndex}: ${lastMessage.content.slice(
          0,
          80
        )}...\n`;
      } catch (error) {
        // logger.error(`Error processing message: ${error}`);
        // we wanna be much more detailed
        logger.error(
          `Error processing message: ${error.message} - ${capabilityCallIndex} - ${lastMessage.content}`
        );
      }

      capabilityCallIndex++;
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
      logger.error(error);
      logger.info(`${chainId} - Retrying message chain`);
      logger.info(`${chainId} - ${JSON.stringify(messages)}`);

      return processMessageChain(
        messages,
        { username, channel, guild },
        retryCount + 1,
        capabilityCallCount
      );
    } else {
      logger.error(
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
    logger.error("Capability Failed: " + capabilityResponse);
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
 * Processes an AI response and generates a response.
 * @param {Array} messages - The array of messages.
 * @param {Object} options - The options object.
 * @param {string} options.username - The username.
 * @param {string} options.channel - The channel.
 * @param {string} options.guild - The guild.
 * @returns {Array} - The updated array of messages.
 */
async function processAiResponse(
  messages,
  { username = "", channel = "", guild = "" }
) {
  const lastUserMessage = messages.find((m) => m.role === "user");
  const lastAiMessage = messages.find((m) => m.role === "assistant");

  const prompt = lastUserMessage.content;
  const aiResponse = lastAiMessage ? lastAiMessage.content : null;

  storeUserMessage({ username, channel, guild }, prompt);

  // if the last message has .image, delete that property off it
  if (messages[messages.length - 1].image) {
    delete messages[messages.length - 1].image;
  }

  try {
    generateAndStoreRememberCompletion(
      prompt,
      aiResponse,
      { username, channel, guild },
      messages
    );

    // get the last message with the role of 'assistant'
    const lastAssistantMessage = messages.find(
      (message) => message.role === "assistant"
    );

    if (!lastAssistantMessage) {
      logger.info("No last assistant message");
      return messages;
    }
  } catch (err) {
    logger.info(err);
    messages.push({
      role: "system",
      content: `Error: ${err}`,
    });
  }

  return messages;
}

module.exports = {
  processMessageChain,
  processCapability,
};
