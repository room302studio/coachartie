/**
 * chain.js
 *
 * This file handles the recursive processing of user messages, LLM responses, and capability execution.
 * Key Functions:
 *
 * - processMessageChain: Main entry point for processing a message chain.
 * - processMessageChainRecursively: Recursively processes messages and executes capabilities.
 * - processUserMessage: Handles incoming user messages and initiates the conversation turn.
 * - generateLLMResponse: Sends the user message and context to the LLM for generating a response.
 * - processLLMResponse: Splits the LLM response into explanation text and capability calls.
 * - sendExplanationText: Sends the explanation text to the user immediately via the Discord channel.
 * - extractCapabilityCalls: Extracts the capability calls from the LLM response for execution.
 * - executeCapabilityChain: Recursively executes the capability calls and sends updates to the user.
 *
 * The main conversation loop starts with processUserMessage and continues recursively through
 * executeCapabilityChain until no more capability calls are found in the LLM responses.
 *
 * Throughout the process, the user receives real-time updates and explanations via the Discord
 * channel, while the capability chain executes asynchronously in the background.
 */
const { callCapabilityMethod } = require("./capabilities");
const {
  capabilityRegexGlobal,
  capabilityRegexSingle,
} = require("../helpers-utility");

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
   * @returns {Promise<Object>} - The processed message chain and final content.
   */
  async function processMessageChain(messages, options, retryCount = 0) {
    try {
      logger.info("Entering processMessageChain");
      const { username, channel, guild, related_message_id } = options;

      if (
        !messages ||
        !Array.isArray(messages) ||
        messages.length === 0 ||
        !username ||
        !channel
      ) {
        logger.error(
          `Invalid arguments - cannot process message chain. Messages: ${JSON.stringify(
            messages
          )}, Options: ${JSON.stringify(options)}`
        );
        return { messages: [], finalContent: null };
      }

      logger.info(
        `Processing message chain: ${JSON.stringify({ messages, options })}`
      );

      logger.info("Calling processMessageChainRecursively");
      const processedMessages = await processMessageChainRecursively(
        messages,
        options
      );
      logger.info("processMessageChainRecursively completed");

      const finalMessage = processedMessages[processedMessages.length - 1];
      const finalContent = finalMessage ? finalMessage.content : null;

      logger.info(`Final message content: ${finalContent}`);

      return { messages: processedMessages, finalContent };
    } catch (error) {
      logger.error(
        `Error in processMessageChain: ${error.message}\nStack: ${error.stack}`
      );
      if (retryCount < MAX_RETRY_COUNT) {
        logger.warn(`Retrying (${retryCount + 1}/${MAX_RETRY_COUNT})`);
        return processMessageChain(messages, options, retryCount + 1);
      } else {
        logger.error("Maximum retries exceeded");
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
    try {
      logger.info("Entering processMessageChainRecursively");
      if (!messages || !Array.isArray(messages) || messages.length === 0) {
        logger.error(
          "Invalid messages array in processMessageChainRecursively"
        );
        return [];
      }

      const lastMessage = messages[messages.length - 1];

      if (!lastMessage || !lastMessage.content) {
        logger.error("Invalid last message in processMessageChainRecursively");
        return messages;
      }

      logger.info(`Processing message: ${JSON.stringify(lastMessage)}`);

      // Process user message or AI response
      if (lastMessage.role === "user") {
        logger.info("Processing user message");
        messages = await processUserMessage(messages, options);
      } else {
        logger.info("Processing LLM response");
        messages = await processLLMResponse(messages, options);
      }

      logger.info("Extracting capability calls");
      const lastProcessedMessage = messages[messages.length - 1];
      const capabilityCalls = extractCapabilityCalls(
        lastProcessedMessage.content
      );
      logger.info(
        `Extracted capability calls: ${JSON.stringify(capabilityCalls)}`
      );

      // If we found any new capability calls, execute them
      if (capabilityCalls.length > 0) {
        logger.info("Executing capability chain");
        messages = await executeCapabilityChain(
          messages,
          capabilityCalls,
          options
        );
        // After executing capabilities, let the LLM generate a response
        logger.info("Recursing to process new messages");
        return processMessageChainRecursively(messages, options);
      }

      logger.info("No more capability calls, returning messages");
      return messages;
    } catch (error) {
      logger.error(
        `Error in processMessageChainRecursively: ${error.message}\nStack: ${error.stack}`
      );
      throw error;
    }
  }

  async function processUserMessage(messages, options) {
    try {
      const { username, channel, guild } = options;
      const userMessage = messages[messages.length - 1];

      const storedMessageId = await storeUserMessage(
        { username, channel, guild },
        userMessage.content
      );

      const llmResponse = await generateLLMResponse(messages, options);
      const processedResponse = await processLLMResponse(
        [...messages, llmResponse],
        options
      );

      return processedResponse;
    } catch (error) {
      logger.error(`Error processing user message: ${error}`);
      throw error;
    }
  }

  async function generateLLMResponse(messages, options) {
    try {
      const { username } = options;
      const lastMessage = messages[messages.length - 1];

      // Generate AI completion params
      const { temperature, frequency_penalty } =
        llmHelper.generateAiCompletionParams();

      // Prepare the prompt, including embed information if available
      let prompt = lastMessage.content;
      if (lastMessage.embeds && lastMessage.embeds.length > 0) {
        prompt += "\n\nMessage includes the following embeds:\n";
        lastMessage.embeds.forEach((embed, index) => {
          prompt += `Embed ${index + 1}:\n`;
          if (embed.title) prompt += `Title: ${embed.title}\n`;
          if (embed.description)
            prompt += `Description: ${embed.description}\n`;
          if (embed.fields) {
            embed.fields.forEach((field) => {
              prompt += `${field.name}: ${field.value}\n`;
            });
          }
          prompt += "\n";
        });
      }

      // Generate AI completion
      const completion = await llmHelper.generateAiCompletion(
        prompt,
        username,
        messages,
        {
          temperature,
          frequency_penalty,
        }
      );

      const aiResponse =
        completion.messages[completion.messages.length - 1].content;

      return {
        role: "assistant",
        content: aiResponse,
      };
    } catch (error) {
      logger.error(`Error generating LLM response: ${error}`);
      throw error;
    }
  }

  function extractCapabilityCalls(content) {
    const calls = Array.from(content.matchAll(capabilityRegexGlobal)).map(
      (match) => ({
        full: match[0],
        slug: match[1],
        method: match[2],
        args: match[3],
      })
    );
    logger.info(`Extracted capability calls: ${JSON.stringify(calls)}`);
    return calls;
  }

  async function processLLMResponse(messages, options, sendToChannel = true) {
    const llmResponse = messages[messages.length - 1];
    const { explanationText, capabilityCalls } = splitLLMResponse(
      llmResponse.content
    );

    if (explanationText && sendToChannel) {
      await sendExplanationText(explanationText, options);
    }

    if (capabilityCalls.length > 0) {
      logger.info(`Found ${capabilityCalls.length} capability calls`);
      messages.push({
        role: "system",
        content: `Capability calls:\n${capabilityCalls.join("\n")}`,
      });
    } else {
      logger.info("No capability calls found in LLM response");
    }

    return messages;
  }

  function sendExplanationText(text, options, sendToChannel = true) {
    const { channel } = options;
    if (sendToChannel) {
      return channel.send(text);
    }
  }

  function splitLLMResponse(content) {
    const capabilityMatches = Array.from(
      content.matchAll(capabilityRegexGlobal)
    );
    let explanationText = content;
    const capabilityCalls = [];

    for (const match of capabilityMatches) {
      const [fullMatch] = match;
      explanationText = explanationText.replace(fullMatch, "");
      capabilityCalls.push(fullMatch.trim());
    }

    return { explanationText: explanationText.trim(), capabilityCalls };
  }

  async function processMessageChainRecursively(
    messages,
    options,
    isInitialCall = true
  ) {
    try {
      logger.info("Entering processMessageChainRecursively");
      if (!messages || !Array.isArray(messages) || messages.length === 0) {
        logger.error(
          "Invalid messages array in processMessageChainRecursively"
        );
        return [];
      }

      const lastMessage = messages[messages.length - 1];

      if (!lastMessage || !lastMessage.content) {
        logger.error("Invalid last message in processMessageChainRecursively");
        return messages;
      }

      logger.info(`Processing message: ${JSON.stringify(lastMessage)}`);

      // Process user message or AI response
      if (lastMessage.role === "user") {
        logger.info("Processing user message");
        messages = await processUserMessage(messages, options);
      } else {
        logger.info("Processing LLM response");
        messages = await processLLMResponse(messages, options, isInitialCall);
      }

      logger.info("Extracting capability calls");
      const lastProcessedMessage = messages[messages.length - 1];
      const capabilityCalls = extractCapabilityCalls(
        lastProcessedMessage.content
      );
      logger.info(
        `Extracted capability calls: ${JSON.stringify(capabilityCalls)}`
      );

      // If we found any new capability calls, execute them
      if (capabilityCalls.length > 0) {
        logger.info("Executing capability chain");
        messages = await executeCapabilityChain(
          messages,
          capabilityCalls,
          options,
          isInitialCall // Only send updates to channel on initial call
        );
        // After executing capabilities, let the LLM generate a response
        logger.info("Recursing to process new messages");
        return processMessageChainRecursively(messages, options, false);
      }

      logger.info("No more capability calls, returning messages");
      return messages;
    } catch (error) {
      logger.error(
        `Error in processMessageChainRecursively: ${error.message}\nStack: ${error.stack}`
      );
      throw error;
    }
  }

  async function executeCapabilityChain(
    messages,
    capabilityCalls,
    options,
    sendUpdatesToChannel = true
  ) {
    const { channel } = options;
    for (const call of capabilityCalls) {
      logger.info(`Processing capability call: ${JSON.stringify(call)}`);
      const { slug, method, args } = call;

      // Send an update to the user (if sendUpdatesToChannel is true)
      // await sendExplanationText(
      //   `Executing capability: ${slug}:${method}`,
      //   {
      //     channel,
      //   },
      //   sendUpdatesToChannel
      // );

      // Call the capability method
      const capabilityResponse = await callCapabilityMethod(
        slug,
        method,
        args,
        messages
      );

      if (capabilityResponse.success) {
        const message = {
          role: "system",
          content: `# Capability ${slug}:${method} was run
  ## Args:
  ${args}
  
  ## Response:
  ${JSON.stringify(capabilityResponse.data, null, 2)}`,
        };

        // Add the image to the message if it exists
        if (capabilityResponse.data.image) {
          message.image = capabilityResponse.data.image;
        }

        messages.push(message);

        // Send an update to the user (if sendUpdatesToChannel is true)
        await sendExplanationText(
          `Capability ${slug}:${method} executed successfully`,
          { channel },
          sendUpdatesToChannel
        );
      } else {
        messages.push({
          role: "system",
          content: `Error running capability ${slug}:${method}: ${capabilityResponse.error}`,
        });

        // Send an update to the user (if sendUpdatesToChannel is true)
        await sendExplanationText(
          `Error executing capability ${slug}:${method}`,
          { channel },
          sendUpdatesToChannel
        );
      }
    }

    return messages;
  }

  return {
    processMessageChain,
  };
})();
