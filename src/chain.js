const { memoryFunctions } = require("./memory");
const { callCapabilityMethod } = require("./capabilities");
const { storeUserMessage } = require("./remember");
const { logInteraction } = require("./memory");
const logger = require("../src/logger.js")("chain");
const {
  capabilityRegex,
  doesMessageContainCapability,
} = require("../helpers-utility");
const llmHelper = require("../helpers-llm");
const { getConfigFromSupabase, splitAndSendMessage } = require("../helpers");

module.exports = (async () => {
  const {
    countMessageTokens,
    doesMessageContainCapability,
    generateAiCompletionParams,
    generateAiCompletion,
    getConfigFromSupabase,
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

    // Sanity check: Ensure we have the bare minimum to process a message
    if (!messages || !username || !channel) {
      logger.error("Invalid arguments - cannot process message chain");
      return [];
    }

    try {
      // The main event: Process all messages recursively
      // This handles nested capability calls and AI responses
      const processedMessages = await processMessageChainRecursively(
        messages,
        options
      );
      return processedMessages;
    } catch (error) {
      // Uh oh, something went wrong. Let's handle it gracefully
      logger.error(`Error processing message chain: ${error}`);

      // We're not giving up that easily! Let's try again (up to a point)
      if (retryCount < MAX_RETRY_COUNT) {
        logger.warn(
          `Error processing message chain, retrying (${
            retryCount + 1
          }/${MAX_RETRY_COUNT})`
        );
        // Recursive call with increased retry count
        return processMessageChain(messages, options, retryCount + 1);
      } else {
        // We've tried our best, time to admit defeat
        logger.error(
          "Error processing message chain, maximum retries exceeded",
          error
        );
        throw error; // Bubble up the error for higher-level handling
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
    if (!messages.length) return [];

    const lastMessage = messages[messages.length - 1];

    // Ensure we have a valid message to process
    if (!lastMessage?.content) {
      logger.error(`Last message is empty: ${JSON.stringify(lastMessage)}`);
      return messages;
    }

    // Process the current message and get AI response
    messages = await processMessage(messages, options);

    const robotCompletion = messages[messages.length - 1];
    console.log(`robotCompletion: ${JSON.stringify(robotCompletion)}`);

    // Check if AI response is valid
    if (!robotCompletion?.content) {
      logger.error(
        `Last message is empty after processing: ${JSON.stringify(
          robotCompletion
        )}`
      );
      return messages;
    }

    // double content? why? idk
    const completionContent = robotCompletion.content.content;

    logger.info(`completionContent: ${JSON.stringify(completionContent)}`);

    // Extract all capability calls from the AI response
    const capabilityCalls = Array.from(
      completionContent.matchAll(capabilityRegex)
    );

    // Process each capability call sequentially
    for (const [_, capSlug, capMethod, capArgs] of capabilityCalls) {
      await splitAndSendMessage(
        options.channel,
        `Processing capability: ${capSlug}:${capMethod}`
      );
      messages = await processCapability(messages, options);
    }

    // If we processed any capabilities, recurse to handle any new capability calls
    // Otherwise, return the final message array
    return capabilityCalls.length > 0
      ? processMessageChainRecursively(messages, options)
      : messages;
  }

  /**
   * Processes a message and generates a response.
   * @param {Array} messages - The array of messages.
   * @param {Object} options - The options object.
   * @returns {Promise<Array>} - The updated array of messages.
   */
  async function processMessage(messages, options) {
    const { username, channel, guild, related_message_id } = options;

    const lastMessage = messages[messages.length - 1];
    // If the last message is an image, we're done here
    // No need to process images, just return and let it be sent
    if (lastMessage.image) {
      return messages;
    }

    // Find the last message from the user
    // We're looking for the most recent 'user' role message
    const lastUserMessage = messages
      .slice()
      .reverse()
      .find((m) => m.role === "user");

    // Extract the raw text from the user's message
    const prompt = lastUserMessage.content;

    // Store the user's message in our memory banks
    // This helps us maintain context over time
    const storedMessageId = await storeUserMessage(
      { username, channel, guild },
      prompt
    );

    // Time to cook up an AI response!
    // We're using some randomness to keep things interesting
    const { temperature, frequency_penalty } =
      llmHelper.generateAiCompletionParams();
    const { aiResponse } = await llmHelper.generateAiCompletion(
      prompt,
      username,
      messages,
      {
        temperature,
        frequency_penalty,
      }
    );

    // Add the AI's response to our conversation
    messages.push({
      role: "assistant",
      content: aiResponse,
    });

    // Check if the last message contained a capability call
    const lastMessageContainsCapability = doesMessageContainCapability(
      aiResponse.content
    );

    // Log this interaction for posterity
    // This helps us learn and improve over time
    await logInteraction(
      prompt,
      aiResponse,
      { username, channel, guild, related_message_id: storedMessageId },
      messages,
      lastMessageContainsCapability,
      lastMessageContainsCapability
        ? aiResponse.content.match(capabilityRegex)[1]
        : ""
    );

    // Return the updated message array with the new AI response
    return messages;
  }
  /**
   * Processes a capability.
   * @param {Array} messages - The array of messages.
   * @param {Object} options - The options object.
   * @returns {Promise<Array>} - The updated array of messages.
   */
  async function processCapability(messages, options) {
    // Another case of getting lastMessage from args
    // when we also have the messages array - doesn't make much sense
    // also we don't handle multiple capabilities in a single message
    // or maybe we handle it before this function is called
    // slug:method(args)
    // const capabilityMatch = lastMessage.match(capabilityRegex);
    const lastMessage = messages[messages.length - 1];
    logger.info("Processing capability for message:", lastMessage);
    const capabilityMatch = Array.from(
      lastMessage.content.matchAll(capabilityRegex)
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
      logger.warn(`Token limit warning: ${currentTokenCount}`);
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
