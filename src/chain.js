const {
  countMessageTokens,
  doesMessageContainCapability,
  generateAiCompletionParams,
  generateAiCompletion,
  trimResponseIfNeeded,
  isExceedingTokenLimit,
  getUniqueEmoji,
  getConfigFromSupabase,
  createTokenLimitWarning,
} = require("../helpers");

// const {
//   generateAndStoreRememberCompletion,
//   generateAndStoreCapabilityCompletion,
// } = require("./memory");
const memoryFunctionsPromise = require("./memory");
const { capabilityRegex, callCapabilityMethod } = require("./capabilities");
const { storeUserMessage } = require("./remember");
const logger = require("../src/logger.js")("chain");

module.exports = (async () => {
  const RESPONSE_LIMIT = 2048;

  const {
    countMessageTokens,
    doesMessageContainCapability,
    generateAiCompletionParams,
    generateAiCompletion,
    // trimResponseIfNeeded,
    // isExceedingTokenLimit,
    countTokens,
    getUniqueEmoji,
    getConfigFromSupabase,
    supabase,
    createTokenLimitWarning,
  } = require("../helpers");

  const { TOKEN_LIMIT, WARNING_BUFFER, MAX_CAPABILITY_CALLS, MAX_RETRY_COUNT } =
    await getConfigFromSupabase();

  /**
   * Processes a message chain.
   *
   * @param {Array} messages - The array of messages to process.
   * @param {Object} options - The options object containing username, channel, and guild.
   * @param {string} options.username - The username.
   * @param {string} options.channel - The channel.
   * @param {string} options.guild - The guild.
   * @param {number} [retryCount=0] - The number of retry attempts.
   * @param {number} [capabilityCallCount=0] - The number of capability calls.
   * @returns {Promise<Array>} - The processed message chain.
   */
  async function processMessageChain(
    messages,
    { username, channel, guild, related_message_id },
    retryCount = 0,
    capabilityCallCount = 0
  ) {
    const chainId = getUniqueEmoji();

    try {
      if (!messages.length) {
        logger.warn("Empty Message Chain");
        return [];
      }

      const lastMessage = messages[messages.length - 1];
      if (!lastMessage) {
        logger.warn("Last Message is undefined");
        return messages;
      }

      if (lastMessage.image) {
        logger.info("Last Message is an Image");
        return messages;
      }

      const processedMessages = await processMessageChainRecursively(
        messages,
        { username, channel, guild, related_message_id },
        capabilityCallCount,
        chainId
      );

      return processedMessages;
    } catch (error) {
      return await handleMessageChainError(
        messages,
        { username, channel, guild, related_message_id },
        retryCount,
        capabilityCallCount,
        error,
        chainId
      );
    }
  }

  /**
   * Recursively processes a message chain.
   *
   * @param {Array} messages - The array of messages to process.
   * @param {Object} options - The options object containing username, channel, and guild.
   * @param {string} options.username - The username.
   * @param {string} options.channel - The channel.
   * @param {string} options.guild - The guild.
   * @param {number} capabilityCallCount - The number of capability calls.
   * @param {string} chainId - The unique identifier for the chain.
   * @returns {Promise<Array>} - The processed message chain.
   */
  async function processMessageChainRecursively(
    messages,
    { username, channel, guild, related_message_id },
    capabilityCallCount,
    chainId
  ) {
    let capabilityCallIndex = 0;
    let chainReport = "";

    if (!messages.length) {
      logger.warn(`${chainId} - Empty Message Chain`);
      return [];
    }

    do {
      capabilityCallIndex++;
      const lastMessage = messages[messages.length - 1];
      if (!lastMessage) {
        logger.warn("Last Message is undefined");
        return messages;
      }
      if (!lastMessage.content) {
        logger.warn("Last Message content is undefined");
        return messages;
      }

      logger.info(
        `${chainId} - Capability Call ${capabilityCallIndex} started: ${lastMessage.content.slice(
          0,
          2400
        )}...`
      );

      try {
        const updatedMessages = await processMessage(
          messages,
          lastMessage.content,
          { username, channel, guild, related_message_id }
        );
        messages = updatedMessages;

        if (doesMessageContainCapability(lastMessage.content)) {
          capabilityCallCount++;
          logger.info(
            `${chainId} - Capability detected in message: Incrementing capability call count to ${capabilityCallCount}`
          );
        }

        chainReport += `${chainId} - Capability Call ${capabilityCallIndex}: ${lastMessage.content.slice(
          0,
          80
        )}...\n`;
        logger.info(
          `${chainId} - Capability Call ${capabilityCallIndex} completed`
        );
      } catch (error) {
        logger.info(
          `${chainId} - Process message chain: error processing message: ${error}`
        );
        messages.push({
          role: "assistant",
          content: "Error processing message: " + error,
        });
        return messages;
      }
    } while (
      (() => {
        const containsCapability = doesMessageContainCapability(
          messages[messages.length - 1].content
        );
        const exceedsTokenLimit = isExceedingTokenLimit(messages);
        const withinCapabilityLimit =
          capabilityCallCount <= MAX_CAPABILITY_CALLS;

        logger.info(
          `${chainId} - Checking while conditions: Contains Capability: ${containsCapability}, Exceeds Token Limit: ${exceedsTokenLimit}, Within Capability Limit: ${withinCapabilityLimit}`
        );

        return (
          containsCapability && !exceedsTokenLimit && withinCapabilityLimit
        );
      })()
    );

    logger.info(`${chainId} - Chain Report:\n${chainReport}`);
    return messages;
  }

  /**
   * Handles errors in the message chain processing.
   *
   * @param {Array} messages - The array of messages.
   * @param {Object} options - The options object containing username, channel, and guild.
   * @param {string} options.username - The username.
   * @param {string} options.channel - The channel.
   * @param {string} options.guild - The guild.
   * @param {number} retryCount - The number of retry attempts.
   * @param {number} capabilityCallCount - The number of capability calls.
   * @param {Error} error - The error object.
   * @param {string} chainId - The unique identifier for the chain.
   * @returns {Promise<Array>} - The processed message chain.
   */
  async function handleMessageChainError(
    messages,
    { username, channel, guild, related_message_id },
    retryCount,
    capabilityCallCount,
    error,
    chainId
  ) {
    if (retryCount < MAX_RETRY_COUNT) {
      logger.warn(
        `Error processing message chain, retrying (${
          retryCount + 1
        }/${MAX_RETRY_COUNT})`,
        error
      );
      return processMessageChain(
        messages,
        { username, channel, guild, related_message_id },
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

  /**
   * Calls a capability method and returns the response.
   *
   * @param {string} capSlug - The slug of the capability.
   * @param {string} capMethod - The method of the capability to call.
   * @param {any[]} capArgs - The arguments to pass to the capability method.
   * @param {Array} messages - The array of messages.
   * @returns {Promise<any>} - The capability response.
   */
  async function getCapabilityResponse(capSlug, capMethod, capArgs, messages) {
    try {
      logger.info("Calling Capability: " + capSlug + ":" + capMethod);
      const response = await callCapabilityMethod(
        capSlug,
        capMethod,
        capArgs,
        messages
      );

      // Check if the capability call was successful
      if (response.success) {
        if (response.data.image) {
          logger.info("Capability Response is an Image");
          return response.data;
        }
        return trimResponseIfNeeded(response.data);
      } else {
        // Handle error case
        logger.info("Capability Failed: " + response.error);
        return response.error; // Consider how you want to handle errors
      }
    } catch (e) {
      // This catch block might be redundant now, consider removing or logging unexpected errors
      logger.error("Unexpected error in getCapabilityResponse: " + e);
      return "Unexpected error: " + e.message;
    }

    if (capabilityResponse.image) {
      logger.info("Capability Response is an Image");
      return capabilityResponse;
    }

    logger.info(`Capability Response: ${JSON.stringify(capabilityResponse)}`);

    return trimResponseIfNeeded(capabilityResponse);
  }

  /**
   * Processes the capability response and logs relevant information.
   *
   * @param {Array} messages - The array of messages.
   * @param {Array} capabilityMatch - The capability match array.
   * @returns {Promise<Array>} - The updated array of messages.
   */
  async function processAndLogCapabilityResponse(messages, capabilityMatch) {
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
   * Finds all capabilities within a message content.
   * @param {string} messageContent - The content of the message to scan for capabilities.
   * @returns {Array} An array of all capability matches found within the message.
   */
  function findAllCapabilities(messageContent) {
    const capabilityRegex = /your-capability-pattern/g; // Define your capability pattern
    return [...messageContent.matchAll(capabilityRegex)];
  }

  /**
   * Processes a single capability.
   * @param {Object} capabilityMatch - The capability match object.
   * @param {Object} options - The options object containing additional context.
   * @returns {Promise<Object>} A promise that resolves to the result of the capability processing.
   */
  async function processSingleCapability(capabilityMatch, options) {
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

    return capabilityResponse;
  }

  /**
   * Processes all capabilities found in a single message concurrently.
   * @param {string} messageContent - The content of the message to process.
   * @param {Object} options - The options object containing additional context.
   * @returns {Promise<Array>} A promise that resolves to an array of processed capability results.
   */
  async function processAllCapabilitiesInMessage(messageContent, options) {
    const capabilityMatches = findAllCapabilities(messageContent);
    const capabilityPromises = capabilityMatches.map((capabilityMatch) =>
      processSingleCapability(capabilityMatch, options)
    );

    return await Promise.all(capabilityPromises);
  }

  // TODO: Remove this function to simplify
  async function processCapability(messages, lastMessage, options) {
    const capabilityMatch = lastMessage.match(capabilityRegex);
    if (!capabilityMatch) return messages;

    try {
      return await processAndLogCapabilityResponse(messages, capabilityMatch);
    } catch (error) {
      logger.info(`Error processing capability: ${error}`);
      messages.push({
        role: "system",
        content: "Error processing capability: " + error,
      });
      return messages;
    }
  }

  /**
   * Processes a message and generates a response.
   *
   * @param {Array} messages - The array of messages.
   * @param {string} lastMessage - The last message in the array.
   * @param {Object} options - The options object.
   * @param {string} options.username - The username.
   * @param {string} options.channel - The channel.
   * @param {string} options.guild - The guild.
   * @returns {Promise<Array>} - The updated array of messages.
   */
  async function processMessage(
    messages,
    lastMessage,
    { username = "", channel = "", guild = "", related_message_id = "" }
  ) {
    const { logInteraction } = await memoryFunctionsPromise;

    logger.info(`Processing Message in chain.js`);

    messages = await processCapability(messages, lastMessage, {
      username,
      channel,
      guild,
      related_message_id,
    });

    if (messages[messages.length - 1].image) {
      logger.info("Last Message is an Image");
      return messages;
    }

    const lastUserMessage = messages
      .slice()
      .reverse()
      .find((m) => m.role === "user");
    const prompt = lastUserMessage.content;

    const storedMessageId = await storeUserMessage(
      { username, channel, guild },
      prompt
    );

    logger.info(`Stored Message ID: ${storedMessageId}`);

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

    logInteraction(
      prompt,
      aiResponse,
      { username, channel, guild, related_message_id: storedMessageId },
      messages
    );

    return messages;
  }

  /**
   * Trims a response if it exceeds the limit.
   * @param {string} capabilityResponse - The response to trim.
   * @returns {string} - The trimmed response.
   */
  function trimResponseIfNeeded(capabilityResponse) {
    while (isResponseExceedingLimit(capabilityResponse)) {
      capabilityResponse = trimResponseByLineCount(
        capabilityResponse,
        countTokens(capabilityResponse)
      );
    }
    return capabilityResponse;
  }

  /**
   * Checks if a response exceeds the limit.
   * @param {string} response - The response to check.
   * @returns {boolean} - True if the response exceeds the limit, false otherwise.
   */
  function isResponseExceedingLimit(response) {
    return countTokens(response) > TOKEN_LIMIT;
  }

  /**
   * Checks if the total number of tokens in the given messages exceeds the token limit.
   * @param {Array<string>} messages - The array of messages to count tokens from.
   * @returns {boolean} - True if the total number of tokens exceeds the token limit, false otherwise.
   */
  function isExceedingTokenLimit(messages) {
    return countMessageTokens(messages) > TOKEN_LIMIT;
  }

  return {
    processMessageChain,
    processMessage,
    processCapability,
    callCapabilityMethod,
    getCapabilityResponse,
    processAndLogCapabilityResponse,
  };
})();
