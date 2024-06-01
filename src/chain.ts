import memoryFunctionsPromise from "./memory";
import { capabilityRegex, callCapabilityMethod } from "./capabilities";
import { storeUserMessage } from "./remember";
import createLogger from "../src/logger";
import {
  countMessageTokens,
  doesMessageContainCapability,
  generateAiCompletionParams,
  generateAiCompletion,
  countTokens,
  getUniqueEmoji,
  getConfigFromSupabase,
  createTokenLimitWarning,
} from "../helpers";

const logger = createLogger("chain");

interface Message {
  role: string;
  content: string;
  image?: string;
}

interface Options {
  username: string;
  channel: string;
  guild: string;
  related_message_id?: string;
}

export default (async () => {
  const { TOKEN_LIMIT, WARNING_BUFFER, MAX_CAPABILITY_CALLS, MAX_RETRY_COUNT } =
    await getConfigFromSupabase();

  /**
   * Processes a message chain.
   *
   * @param {Message[]} messages - The array of messages to process.
   * @param {Options} options - The options object containing username, channel, and guild.
   * @param {number} [retryCount=0] - The number of retry attempts.
   * @param {number} [capabilityCallCount=0] - The number of capability calls.
   * @returns {Promise<Message[]>} - The processed message chain.
   */
  async function processMessageChain(
    messages: Message[],
    { username, channel, guild, related_message_id }: Options,
    retryCount = 0,
    capabilityCallCount = 0
  ): Promise<Message[]> {
    const chainId = getUniqueEmoji();
    const lastMessage = messages[messages.length - 1];

    try {
      if (!messages.length) {
        logger.error(
          `[${chainId}] Cannot process empty message chain, aborting.`
        );
        return [];
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

  function getCapabilityFromMessage(message: string): string | null {
    const capabilityMatch = message.match(capabilityRegex);
    if (!capabilityMatch) return null;
    return capabilityMatch[1];
  }

  /**
   * Recursively processes a message chain.
   *
   * @param {Message[]} messages - The array of messages to process.
   * @param {Options} options - The options object containing username, channel, and guild.
   * @param {number} capabilityCallCount - The number of capability calls.
   * @param {string} chainId - The unique identifier for the chain.
   * @returns {Promise<Message[]>} - The processed message chain.
   */
  async function processMessageChainRecursively(
    messages: Message[],
    { username, channel, guild, related_message_id }: Options,
    capabilityCallCount: number,
    chainId: string
  ): Promise<Message[]> {
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
   * @param {Message[]} messages - The array of messages.
   * @param {Options} options - The options object containing username, channel, and guild.
   * @param {number} retryCount - The number of retry attempts.
   * @param {number} capabilityCallCount - The number of capability calls.
   * @param {Error} error - The error object.
   * @param {string} chainId - The unique identifier for the chain.
   * @returns {Promise<Message[]>} - The processed message chain.
   */
  async function handleMessageChainError(
    messages: Message[],
    { username, channel, guild, related_message_id }: Options,
    retryCount: number,
    capabilityCallCount: number,
    error: Error,
    chainId: string
  ): Promise<Message[]> {
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
   * @param {Message[]} messages - The array of messages.
   * @returns {Promise<any>} - The capability response.
   */
  async function getCapabilityResponse(
    capSlug: string,
    capMethod: string,
    capArgs: any[],
    messages: Message[]
  ): Promise<any> {
    try {
      logger.info("Calling Capability: " + capSlug + ":" + capMethod);
      const response = await callCapabilityMethod(
        capSlug,
        capMethod,
        capArgs,
        messages
      );

      if (response.success) {
        if (response.data.image) {
          logger.info("Capability Response is an Image");
          return response.data;
        }
        return trimResponseIfNeeded(response.data);
      } else {
        logger.info("Capability Failed: " + response.error);
        return response.error;
      }
    } catch (e) {
      logger.error("Unexpected error in getCapabilityResponse: " + e);
      return "Unexpected error: " + e.message;
    }
  }

  /**
   * Processes the capability response and logs relevant information.
   *
   * @param {Message[]} messages - The array of messages.
   * @param {RegExpMatchArray} capabilityMatch - The capability match array.
   * @returns {Promise<Message[]>} - The updated array of messages.
   */
  async function processAndLogCapabilityResponse(
    messages: Message[],
    capabilityMatch: RegExpMatchArray
  ): Promise<Message[]> {
    logger.info(`processAndLogCapabilityResponse: ${capabilityMatch}`);
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

    const message: Message = {
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

  // TODO: Remove this function to simplify
  async function processCapability(
    messages: Message[],
    lastMessage: string,
    options: Options
  ): Promise<Message[]> {
    if (!lastMessage) {
      logger.error("No last message found - cannot process capability");
      return messages;
    }

    if (!messages) {
      logger.error("No messages found - cannot process capability");
      return messages;
    }

    const capabilityMatch = lastMessage.match(capabilityRegex);
    if (!capabilityMatch) return messages;
    logger.info(`${lastMessage} is a capability: ${capabilityMatch[0]}`);

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
   * @param {Message[]} messages - The array of messages.
   * @param {string} lastMessage - The last message in the array.
   * @param {Options} options - The options object.
   * @returns {Promise<Message[]>} - The updated array of messages.
   */
  async function processMessage(
    messages: Message[],
    lastMessage: string,
    {
      username = "",
      channel = "",
      guild = "",
      related_message_id = "",
    }: Options
  ): Promise<Message[]> {
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
    if (!lastUserMessage) {
      logger.error("No user message found - cannot process message");
      return messages;
    }
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
      isCapability ? lastMessage.match(capabilityRegex)?.[1] : ""
    );

    return messages;
  }

  /**
   * Trims a response if it exceeds the limit.
   * @param {string} capabilityResponse - The response to trim.
   * @returns {string} - The trimmed response.
   */
  function trimResponseIfNeeded(capabilityResponse: string): string {
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
  function isResponseExceedingLimit(response: string): boolean {
    return countTokens(response) > TOKEN_LIMIT;
  }

  /**
   * Checks if the total number of tokens in the given messages exceeds the token limit.
   * @param {Message[]} messages - The array of messages to count tokens from.
   * @returns {boolean} - True if the total number of tokens exceeds the token limit, false otherwise.
   */
  function isExceedingTokenLimit(messages: Message[]): boolean {
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
