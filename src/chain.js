const memoryFunctionsPromise = require("./memory");
const { callCapabilityMethod } = require("./capabilities");
const { storeUserMessage } = require("./remember");
const logger = require("../src/logger.js")("chain");
const { capabilityRegex } = require("../helpers-utility");
const { createTokenLimitWarning } = require("../helpers");

module.exports = (async () => {
  const {
    countMessageTokens,
    doesMessageContainCapability,
    generateAiCompletionParams,
    generateAiCompletion,
    getConfigFromSupabase,
    createTokenLimitWarning,
    splitAndSendMessage,
  } = require("../helpers");

  const { TOKEN_LIMIT, WARNING_BUFFER, MAX_RETRY_COUNT } =
    await getConfigFromSupabase();

  /**
   * Processes a message chain.
   * @param {Array} messages - The array of messages to process.
   * @param {Object} options - The options object containing username, channel, and guild.
   * @returns {Promise<Array>} - The processed message chain.
   */
  async function processMessageChain(messages, options, retryCount = 0) {
    const { username, channel, guild, related_message_id } = options;

    // If ther aren't messages, username, or channel
    // we can't process the message chain
    if (!messages || !username || !channel) {
      logger.error("Invalid arguments - cannot process message chain");
      return [];
    }

    // Let's try to process the message chain recursively
    try {
      // this will run as many times as necessay
      // and continue adding messages to the `messages` array
      // until it returns
      const processedMessages = await processMessageChainRecursively(
        messages,
        options
      );
      return processedMessages;
    } catch (error) {
      logger.error(`Error processing message chain: ${error}`);
      // But if there is an error- we will try to re-process it
      // up to MAX_RETRY_COUNT times
      if (retryCount < MAX_RETRY_COUNT) {
        logger.warn(
          `Error processing message chain, retrying (${
            retryCount + 1
          }/${MAX_RETRY_COUNT})`
        );
        return processMessageChain(messages, options, retryCount + 1);
      } else {
        // after MAX_RETRY_COUNT times, we will log the error
        // and give up
        logger.error(
          "Error processing message chain, maximum retries exceeded",
          error
        );
        throw error;
      }
    }
  }

  /**
   * Recursively processes a message chain, and will call capabilities for as long as they exist in the final message.
   * @param {Array} messages - The array of messages to process.
   * @param {Object} options - The options object containing username, channel, and guild.
   * @returns {Promise<Array>} - The processed message chain.
   */
  async function processMessageChainRecursively(messages, options) {
    if (!messages.length) {
      return [];
    }

    // grab the last message out of the messages array
    const lastMessage = messages[messages.length - 1];

    // if there is none, what are we even doing?
    if (!lastMessage || !lastMessage.content) {
      logger.error(`Last message is empty: ${JSON.stringify(lastMessage)}`);
      return messages;
    }

    // let's process the last message (which adds an AI completion)
    messages = await processMessage(messages, lastMessage.content, options);

    // Now the last message is the AI completion
    let robotCompletion = messages[messages.length - 1];

    // once again, if there is no last message, what are we even doing?
    if (!robotCompletion || !robotCompletion.content) {
      logger.error(
        `Last message is empty after processing: ${JSON.stringify(
          robotCompletion
        )}`
      );
      return messages;
    }

    // Find all the capability calls in the last message
    const capabilityCalls = Array.from(
      robotCompletion.content.matchAll(capabilityRegex)
    );

    // now we loop through all the capability calls and process them
    for (const [_, capSlug, capMethod, capArgs] of capabilityCalls) {
      await splitAndSendMessage(
        options.channel,
        `Processing capability: ${capSlug}:${capMethod}`
      );
      messages = await processCapability(
        messages,
        lastMessage.content,
        options
      );
    }

    // and then, ALSO, process it recursively???
    // kinda sus
    if (capabilityCalls.length > 0) {
      return processMessageChainRecursively(messages, options);
    }

    // return messages full of the responses
    // from the AI and the capabilities
    return messages;
  }

  /**
   * Processes a message and generates a response.
   * @param {Array} messages - The array of messages.
   * @param {string} lastMessage - The last message in the array.
   * @param {Object} options - The options object.
   * @returns {Promise<Array>} - The updated array of messages.
   */
  async function processMessage(messages, lastMessage, options) {
    const { logInteraction } = await memoryFunctionsPromise;
    const { username, channel, guild, related_message_id } = options;

    // Check if the last message contains a capability
    // which is weird because we get the messages array
    // so we can just check the last message in the array
    // instead of passing it in as an argument (which is confusing)
    if (doesMessageContainCapability(lastMessage)) {
      messages = await processCapability(messages, lastMessage, options);
    }

    // if the last message is an image, we don't want to process anymore
    // we just return messages so the image is sent to the channel

    if (messages[messages.length - 1].image) {
      return messages;
    }

    // find the last user message by looking at the messages array
    // and the "role" property of each message
    const lastUserMessage = messages
      .slice()
      .reverse()
      .find((m) => m.role === "user");

    // get the raw text out of the message
    const prompt = lastUserMessage.content;

    // store the user message in the database
    const storedMessageId = await storeUserMessage(
      { username, channel, guild },
      prompt
    );

    // generate an AI completion
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

    // add the response to the messages array
    messages.push({
      role: "assistant",
      content: aiResponse,
    });

    const lastMessageContainsCapability =
      doesMessageContainCapability(lastMessage);

    // log the interaction (which generates a memory)
    logInteraction(
      prompt,
      aiResponse,
      { username, channel, guild, related_message_id: storedMessageId },
      messages,
      lastMessageContainsCapability,
      // I don't understand why we're doing this
      lastMessageContainsCapability ? lastMessage.match(capabilityRegex)[1] : ""
    );

    return messages;
  }

  /**
   * Processes a capability.
   * @param {Array} messages - The array of messages.
   * @param {string} lastMessage - The last message in the array.
   * @param {Object} options - The options object.
   * @returns {Promise<Array>} - The updated array of messages.
   */
  async function processCapability(messages, lastMessage, options) {
    logger.info("Processing capability for message:", lastMessage);

    // Another case of getting lastMessage from args
    // when we also have the messages array - doesn't make much sense
    // also we don't handle multiple capabilities in a single message
    // or maybe we handle it before this function is called
    // slug:method(args)
    // const capabilityMatch = lastMessage.match(capabilityRegex);
    const capabilityMatch = Array.from(
      lastMessage.matchAll(capabilityRegex)
    )[0];

    if (!capabilityMatch) {
      return messages;
    }
    logger.info("Capability match:", capabilityMatch);

    // extract the capability slug, method, and arguments
    // from the regex match
    const [_, capSlug, capMethod, capArgs] = capabilityMatch;
    logger.info(`Extracted capability: ${capSlug}:${capMethod}(${capArgs})`);
    // figure out how many tokens are in the current message chain
    const currentTokenCount = countMessageTokens(messages);

    // if we are close to the token limit, we want to warn the AI
    if (currentTokenCount >= TOKEN_LIMIT - WARNING_BUFFER) {
      messages.push(createTokenLimitWarning());
    }

    // call the capability method
    const capabilityResponse = await callCapabilityMethod(
      capSlug,
      capMethod,
      capArgs,
      messages
    );

    logger.info(`Capability response: ${JSON.stringify(capabilityResponse)}`);

    if (capabilityResponse.success) {
      const message = {
        role: "system",
        content: `# Capability ${capSlug}:${capMethod} was run
## Args:
${capArgs}

## Response:
${JSON.stringify(capabilityResponse.data, null, 2)}`,
      };

      // add the image to the message if it exists
      if (capabilityResponse.data.image) {
        message.image = capabilityResponse.data.image;
      }

      messages.push(message);
    } else {
      messages.push({
        role: "system",
        content: `Error running capability ${capSlug}:${capMethod}: ${capabilityResponse.error}`,
      });
    }
    return messages;
  }

  return {
    processMessageChain,
  };
})();
