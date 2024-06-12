const memoryFunctionsPromise = require("./memory");
const { callCapabilityMethod } = require("./capabilities");
const { capabilityRegex } = require("../helpers-utility.js");
const { storeUserMessage } = require("./remember");
const logger = require("../src/logger.js")("chain");
// const { countTokensInMessageArray } = require("../helpers");

module.exports = (async () => {
  const {
    countMessageTokens,
    doesMessageContainCapability,
    generateAiCompletionParams,
    generateAiCompletion,
    countTokens,
    getUniqueEmoji,
    getConfigFromSupabase,
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
    // Create a unique chain ID so we can track this specific one in the logs
    // This is helpful if multiple chains are being processed concurrently
    const chainId = getUniqueEmoji();
    const lastMessage = messages[messages.length - 1];

    try {
      // We need messages to process, at least
      if (!messages.length) {
        logger.error(
          `[${chainId}] Cannot process empty message chain, aborting.`
        );
        return [];
      }

      // TODO: If the last message contains an image, then it's probably a capability response and we should return early
      if (lastMessage.image) {
        logger.info("Last Message is an Image");
        return messages;
      }

      // Otherwise, let's process the message chain over and over (up to MAX_CAPABILITY_CALLS)
      const processedMessages = await processMessageChainRecursively(
        messages,
        { username, channel, guild, related_message_id },
        capabilityCallCount,
        chainId
      );

      logger.info(
        `[${chainId}] Message Chain Returning Processed Messages: ${processedMessages.length} messages, ${capabilityCallCount} capability calls.`
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

  function getCapabilityFromMessage(message) {
    if (!capabilityRegex) logger.error(`Capability regex not found`);
    if (!capabilityRegex.test(message)) return null;
    const capabilityMatch = message.match(capabilityRegex);
    if (!capabilityMatch) return null;
    return capabilityMatch[1];
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

    if (!messages.length) {
      logger.error(`[${chainId}] Empty message chain.`);
      return [];
    }

    logger.info(
      `[${chainId}] Processing message chain with ${messages.length} messages.`
    );

    try {
      for (const message of messages) {
        capabilityCallIndex++;
        if (!message || !message.content) {
          logger.error(
            `[${chainId}] Message or content is undefined. Aborting.`
          );
          return messages;
        }

        logger.info(
          `[${chainId}] Capability call ${capabilityCallIndex} started. Last message content: ${message.content}...`
        );

        const updatedMessages = await processMessage(
          messages,
          message.content,
          { username, channel, guild, related_message_id }
        );
        messages = updatedMessages;

        if (doesMessageContainCapability(message.content)) {
          const messageCapability = getCapabilityFromMessage(message.content);
          capabilityCallCount++;
          logger.info(
            `[${chainId}] Capability detected: ${messageCapability}. Capability call count: ${capabilityCallCount}`
          );
        }

        // logger.info(
        //   `[${chainId}] Capability call ${capabilityCallIndex} completed. Assistant response: ${messages[
        //     messages.length - 1
        //   ].content.slice(0, 100)}...`
        // );
        return messages;
      }
    } catch (error) {
      logger.error(`[${chainId}] Error processing message: ${error}`);
      messages.push({
        role: "assistant",
        content: `#Error\n Error processing message: ${error}\n `,
      });
      return messages;
    }

    logger.info(
      `[${chainId}] Message chain processing completed. Final message chain length: ${messages.length}`
    );

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
        }/${MAX_RETRY_COUNT}) \n ${error} \n ${error.stack} `
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

    // if (capabilityResponse.image) {
    //   logger.info("Capability Response is an Image");
    //   return capabilityResponse;
    // }

    // logger.info(`Capability Response: ${JSON.stringify(capabilityResponse)}`);

    // return trimResponseIfNeeded(capabilityResponse);
  }

  /**
   * Processes the capability response and logs relevant information.
   *
   * @param {Array} messages - The array of messages.
   * @param {Array} capabilityMatch - The capability match array.
   * @returns {Promise<Array>} - The updated array of messages.
   */
  async function processAndLogCapabilityResponse(messages, capabilityMatch) {
    logger.info(`processAndLogCapabilityResponse: ${capabilityMatch}`);
    const [_, capSlug, capMethod, capArgs] = capabilityMatch;
    const currentTokenCount = countMessageTokens(messages);

    if (!capabilityMatch) {
      logger.error("No capability match found");
      return messages;
    }

    // log the capabilityMatch and the stuff we extract from it
    logger.info(
      `Capability match: ${capabilityMatch}\nProcessing Capability: ${capSlug}:${capMethod} with args: ${capArgs}`
    );

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
  // function findAllCapabilities(messageContent) {
  //   const capabilityRegex = /your-capability-pattern/g; // Define your capability pattern
  //   return [...messageContent.matchAll(capabilityRegex)];
  // }

  /**
   * Processes a single capability.
   * @param {Object} capabilityMatch - The capability match object.
   * @param {Object} options - The options object containing additional context.
   * @returns {Promise<Object>} A promise that resolves to the result of the capability processing.
   */
  // async function processSingleCapability(capabilityMatch, options) {
  //   const [_, capSlug, capMethod, capArgs] = capabilityMatch;
  //   const currentTokenCount = countMessageTokens(messages);

  //   if (currentTokenCount >= TOKEN_LIMIT - WARNING_BUFFER) {
  //     logger.warn("Token Limit Warning: Current Tokens - " + currentTokenCount);
  //     messages.push(createTokenLimitWarning());
  //   }

  //   logger.info("Processing Capability: " + capSlug + ":" + capMethod);

  //   const capabilityResponse = await getCapabilityResponse(
  //     capSlug,
  //     capMethod,
  //     capArgs,
  //     messages
  //   );

  //   return capabilityResponse;
  // }

  /**
   * Processes all capabilities found in a single message concurrently.
   * @param {string} messageContent - The content of the message to process.
   * @param {Object} options - The options object containing additional context.
   * @returns {Promise<Array>} A promise that resolves to an array of processed capability results.
   */
  // async function processAllCapabilitiesInMessage(messageContent, options) {
  //   const capabilityMatches = findAllCapabilities(messageContent);
  //   const capabilityPromises = capabilityMatches.map((capabilityMatch) =>
  //     processSingleCapability(capabilityMatch, options)
  //   );

  //   return await Promise.all(capabilityPromises);
  // }

  // TODO: Remove this function to simplify
  async function processCapability(messages, lastMessage) {
    // check for all the arguments
    if (!lastMessage) {
      logger.error("No last message found - cannot process capability");
      return messages;
    }

    if (!messages) {
      logger.error("No messages found - cannot process capability");
      return messages;
    }

    if (!capabilityRegex) logger.error(`Capability regex not found`);

    const capabilityMatch = lastMessage.match(capabilityRegex);
    if (!capabilityMatch) {
      logger.info("No capability match found");
      return messages;
    }
    logger.info(`${lastMessage} is a capability: ${capabilityMatch}`);

    try {
      return await processAndLogCapabilityResponse(messages, capabilityMatch);
    } catch (error) {
      logger.error(`Error processing capability: ${error}`);
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

    logger.info(`Processing Message in chain.js: ${lastMessage}`);

    const isCapability = doesMessageContainCapability(lastMessage);
    logger.info(`Is Capability: ${isCapability} - ${lastMessage}`);

    if (isCapability) {
      logger.info(`Capability Detected: ${lastMessage}`);
      messages = await processCapability(messages, lastMessage, {
        username,
        channel,
        guild,
        related_message_id,
      });
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
    logger.info(`Prompt: ${prompt}`);

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

    logger.info(`AI Response: ${aiResponse}`);

    messages.push({
      role: "assistant",
      content: aiResponse,
    });

    logInteraction(
      prompt,
      aiResponse,
      { username, channel, guild, related_message_id: storedMessageId },
      messages,
      isCapability,
      isCapability ? lastMessage.match(capabilityRegex)[1] : ""
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
