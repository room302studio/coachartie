// const {
//   generateAndStoreRememberCompletion,
//   generateAndStoreCapabilityCompletion,
// } = require("./memory");
const memoryFunctionsPromise = require("./memory");
const { capabilityRegex, callCapabilityMethod } = require("./capabilities");
const { storeUserMessage } = require("./remember");
// const { getPromptsFromSupabase } = require("../helpers");
// const { CAPABILITY_ERROR_PROMPT } = await getPromptsFromSupabase();
const logger = require("../src/logger.js")("chain");

// TODO: Swap out with getConfigFromSupabase
// const {
//   TOKEN_LIMIT,
//   WARNING_BUFFER,
//   MAX_CAPABILITY_CALLS,
//   MAX_RETRY_COUNT,
// } = require("../config");



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
   * @param {Object} message - The message object.
   * @param {number} [retryCount=0] - The number of retry attempts.
   * @param {number} [capabilityCallCount=0] - The number of capability calls.
   * @returns {Array} - The processed message chain.
   */

  // TODO: Right now, I think, we accept too many arguments. And also, we depend on there being a `message` object, which we use to send our response. But it's not always there, sometimes, like if we are being run proactively, we need to actually look up the channel and send the message that way, instead of using message.send ... so we should probably refactor this to be more flexible and accept a channel object instead of a message object, and then we can send the message using the channel object instead of the message object. But that means we need to find every place that calls processMessageChain currently and update it to pass in the channel object instead of the message object. And then we can remove the message object from the processMessageChain function signature.

  /**
   * Processes a message chain.
   *
   * This function orchestrates the processing of a series of messages, including handling capabilities,
   * generating AI completions, and managing images. When a capability returns an image, or an AI completion
   * results in an image, this function ensures that the image is correctly flagged for downstream handling.
   *
   * @param {Array} messages - The array of messages to process. Each message is an object that may contain text or image data.
   * @param {Object} options - The options object containing contextual information like username, channel, and guild.
   * @param {number} [retryCount=0] - The number of retry attempts for processing the message chain.
   * @param {number} [capabilityCallCount=0] - The number of capability calls made during the processing.
   * @returns {Array} - The processed message chain, with each message properly flagged if it contains an image.
   */
  async function processMessageChain(
    messages,
    { username, channel, guild },
    retryCount = 0,
    capabilityCallCount = 0,
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
            2400,
          )}...`,
        );

        // process the last message in the chain
        try {
          const updatedMessages = await processMessage(
            messages,
            lastMessage.content,
            { username, channel, guild },
          );
          messages = updatedMessages;
          lastMessage = messages[messages.length - 1];

          if (doesMessageContainCapability(lastMessage.content)) {
            capabilityCallCount++;
            channel.send(lastMessage.content);
          }

          chainReport += `${chainId} - Capability Call ${capabilityCallIndex}: ${lastMessage.content.slice(
            0,
            80,
          )}...\n`;

          logger.info(
            `${chainId} - Capability Call ${capabilityCallIndex} completed`,
          );
        } catch (error) {
          logger.info(
            `Process message chain: error processing message: ${error}`,
          );
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
          error,
        );
        return await processMessageChain(
          messages,
          { username, channel, guild },
          retryCount + 1,
          capabilityCallCount,
        );
      } else {
        logger.info(
          `${chainId} - Error processing message chain, maximum retries exceeded`,
          error,
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
        messages,
      );
    } catch (e) {
      capabilityResponse = `${capSlug}:${capMethod} failed with error: ${e}`;
      logger.info("Capability Failed: " + capabilityResponse);
    }

    if (capabilityResponse.image) {
      logger.info("Capability Response is an Image");
      return capabilityResponse;
    }

    logger.info(`Capability Response: ${JSON.stringify(capabilityResponse)}`);

    return trimResponseIfNeeded(capabilityResponse);
  }

  /**
   * Processes a capability by executing the specified method with the given arguments.
   * If the capability method returns an image, this function ensures the image is included
   * in the response for downstream processing. This is crucial for capabilities that generate
   * visual content, as it allows the bot to handle and return images to the user appropriately.
   *
   * @param {Array} messages - The array of messages, potentially including previous capability responses.
   * @param {Array} capabilityMatch - The array containing the capability details extracted from the message.
   * @returns {Promise<Array>} - The updated array of messages, including the capability response which may be an image.
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
      messages,
    );

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

    logger.info("Capability Response: " + capabilityResponse);

    if (capabilityResponse.image) {
      message.image = capabilityResponse.image;
    }

    // messages.push(message);
    // actually lets add it to the front of the array so that it's the first thing the user sees
    messages.unshift(message);

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
    { username = "", channel = "", guild = "" },
  ) {
    logger.info(`Processing Message in chain.js`);

    const { generateAndStoreCompletion } = await memoryFunctionsPromise;

    if (doesMessageContainCapability(lastMessage)) {
      const capabilityMatch = lastMessage.match(capabilityRegex);

      try {
        messages = await processCapability(messages, capabilityMatch);

        const lastMessage = messages[messages.length - 1];
        const lastUserMessage = messages.find((m) => m.role === "user").content;

        // check if the lastMessage has an image
        if (lastMessage.image) {
          logger.info("Last Message is an Image");
          return messages;
        }

        // store a memory of the capability call
        await generateAndStoreCompletion(
          lastUserMessage,
          messages[messages.length - 1].content,
          { username, channel, guild },
          messages,
          true, // mark as capability
          capabilityMatch[1],
        );
      } catch (error) {
        logger.info(`Error processing capability: ${error}`);
        messages.push({
          role: "system",
          content: "Error processing capability: " + error,
        });

        // messages.push({
        //   role: "user",
        //   content: CAPABILITY_ERROR_PROMPT,
        // });
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
      },
    );

    messages.push({
      role: "assistant",
      content: aiResponse,
    });

    generateAndStoreCompletion(
      prompt,
      aiResponse,
      { username, channel, guild },
      messages,
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
      countTokens(capabilityResponse),
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



  // module.exports = {
  //   processMessageChain,
  //   processMessage,
  //   processCapability,
  // };
  return {
    processMessageChain,
    processMessage,
    processCapability,
    callCapabilityMethod,
    getCapabilityResponse,
  };
})();
