const { memoryFunctions } = require("./memory");
const { callCapabilityMethod, capabilityRegex } = require("./capabilities");
const { storeUserMessage } = require("./remember");
const { logInteraction } = require("./memory");
const logger = require("../src/logger.js")("chain");
const llmHelper = require("../helpers-llm");

module.exports = (async () => {
  const {
    countMessageTokens,
    doesMessageContainCapability,
    getConfigFromSupabase,
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
    try {
      const { username, channel, guild, related_message_id } = options;

      // Sanity check: Ensure we have the bare minimum to process a message
      if (!messages || !username || !channel) {
        logger.error("Invalid arguments - cannot process message chain");
        return [];
      }

      try {
        logger.info(
          `Processing message chain: ${JSON.stringify({ messages, options })}`
        );

        // The main event: Process all messages recursively
        // This handles nested capability calls and AI responses
        const processedMessages = await processMessageChainRecursively(
          messages,
          options
        );

        // Extract the final message content
        const finalMessage = processedMessages[processedMessages.length - 1];
        const finalContent = finalMessage.content;

        // Log the final content
        logger.info(`Final message content: ${finalContent}`);

        // Return both the processed messages and the final content
        return { messages: processedMessages, finalContent };
      } catch (error) {
        try {
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
        } catch (errorHandlingError) {
          logger.error(`Error while handling error: ${errorHandlingError}`);
          throw errorHandlingError;
        }
      }
    } catch (outerError) {
      logger.error(
        `Unexpected error in processMessageChain: ${outerError.message}, stack: ${outerError.stack}`
      );
      throw outerError;
    }
  }

  /**
   * Recursively processes a message chain, and will call capabilities for as long as they exist in the final message.
   * @param {Array} messages - The array of messages to process.
   * @param {Object} options - The options object containing username, channel, and guild.
   * @returns {Promise<Array>} - The processed message chain.
   */
  async function processMessageChainRecursively(messages, options) {
    if (!messages || !Array.isArray(messages)) {
      logger.error(
        `messages is not an array in processMessageChainRecursively`
      );
      return [];
    }

    if (messages.length === 0) {
      logger.error("messages array is empty in processMessageChainRecursively");
      return [];
    }

    const lastMessage = messages[messages.length - 1];

    if (!lastMessage || !lastMessage.content) {
      logger.error(
        "lastMessage or its content is empty in processMessageChainRecursively"
      );
      return messages;
    }

    logger.info(
      `lastMessage in processMessageChainRecursively: ${JSON.stringify(
        lastMessage
      )}`
    );

    // Check if the user's message contains a capability
    if (
      lastMessage.role === "user" &&
      doesMessageContainCapability(lastMessage)
    ) {
      messages = await processCapability(messages, options);
    }

    // Process the current message and get AI response
    logger.info(`messages length before processing: ${messages.length}`);
    const processedResult = await processMessage(messages, options);

    logger.info(`messages length after processing: ${processedResult.length}`);
    const robotCompletion = processedResult[processedResult.length - 1];
    logger.info(`robotCompletion: ${JSON.stringify(robotCompletion)}`);

    // Check if AI response is valid
    if (!robotCompletion?.content) {
      logger.error(
        `Last message is empty after processing: ${JSON.stringify(
          robotCompletion
        )}`
      );
      return processedResult;
    }

    const completionContent = robotCompletion.content;

    logger.info(`completionContent: ${JSON.stringify(completionContent)}`);

    // Extract all capability calls from the AI response
    const capabilityCalls = Array.from(
      completionContent.matchAll(capabilityRegex)
    );

    // If we processed any capabilities, recurse to handle any new capability calls
    // Otherwise, return the final message array
    return capabilityCalls.length > 0
      ? processMessageChainRecursively(processedResult, options)
      : processedResult;
  }

  /**
   * Processes a message and generates a response.
   * @param {Array} messages - The array of messages.
   * @param {Object} options - The options object.
   * @returns {Promise<Array>} - The updated array of messages.
   */
  async function processMessage(messages, options) {
    const { username, channel, guild, related_message_id } = options;

    // logger.info(
    //   `messages before fetching last message: ${JSON.stringify(messages)}`
    // );
    // log the length instead
    logger.info(`messages length: ${messages.length}`);
    const lastMessage = messages[messages.length - 1];

    // If the last message is an image, we're done here
    // No need to process images, just return and let it be sent
    if (lastMessage.image) {
      return messages;
    }

    // Find the last message from the user
    // logger.info(
    //   `messages before finding last user message: ${JSON.stringify(messages)}`
    // );
    const mostRecentUserMessage = messages
      .slice()
      .reverse()
      .find((m) => m.role === "user");

    // Extract the raw text from the user's message
    const prompt = mostRecentUserMessage.content;

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
    const completion = await llmHelper.generateAiCompletion(
      prompt,
      username,
      messages,
      {
        temperature,
        frequency_penalty,
      }
    );

    logger.info(`Completion: ${JSON.stringify(completion)}`);
    // so this completion is actually the entire messages array
    // so we need to get the last message from it
    // logger.info(
    //   `completion messages before fetching last message: ${JSON.stringify(
    //     completion.messages
    //   )}`
    // );
    const completionLastMessage =
      completion.messages[completion.messages.length - 1];

    logger.info(
      `completionLastMessage: ${JSON.stringify(completionLastMessage)}`
    );

    const aiResponse = completionLastMessage.content;

    // Add the AI's response to our conversation
    messages.push({
      role: "assistant",
      content: aiResponse,
    });

    logger.info(`aiResponse: ${JSON.stringify(aiResponse)}`);

    // Check if the last message contained a capability call
    const lastMessageContainsCapability = doesMessageContainCapability(
      messages[messages.length - 1].content
    );

    // if it does, call it?
    if (lastMessageContainsCapability) {
      logger.info(
        `Last message contains capability: ${lastMessage.content}, calling it now`
      );
      messages = await processCapability(messages, options);
    }

    // log everything we give to logInteraction so we can figure out what the fuck is happening
    logger.info(
      `prompt: ${JSON.stringify(prompt)}\naiResponse: ${JSON.stringify(
        aiResponse
      )}\noptions: ${JSON.stringify({
        username,
        channel,
        guild,
        related_message_id,
      })}\nmessages: ${
        messages.length
      }\nlastMessageContainsCapability: ${lastMessageContainsCapability}`
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

    // logger.info(
    //   `messages before fetching last message: ${JSON.stringify(messages)}`
    // );
    const lastMessage = messages[messages.length - 1];
    logger.info("Processing capability for message:", lastMessage);
    let messageContent;
    if (typeof lastMessage.content === "string") {
      messageContent = lastMessage.content;
    } else if (
      typeof lastMessage.content === "object" &&
      typeof lastMessage.content.content === "string"
    ) {
      messageContent = lastMessage.content.content;
    } else {
      throw new Error(
        `Unexpected message content type: ${typeof lastMessage.content}`
      );
    }

    const capabilityMatch = Array.from(
      messageContent.matchAll(capabilityRegex)
    )[0];

    if (!capabilityMatch) {
      return messages;
    }

    // extract the capability slug, method, and arguments
    // from the regex match
    const [_, capSlug, capMethod, capArgs] = capabilityMatch;

    // figure out how many tokens are in the current message chain
    const currentTokenCount = countMessageTokens(messages);

    logger.info(
      `Extracted capability: ${capSlug}:${capMethod}(${capArgs})\nCurrent token count: ${currentTokenCount}/${TOKEN_LIMIT}`
    );

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
