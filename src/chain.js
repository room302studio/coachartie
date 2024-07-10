const memoryFunctionsPromise = require("./memory");
const { callCapabilityMethod } = require("./capabilities");
const {
  capabilityRegex,
  capabilityRegexGlobal,
} = require("../helpers-utility.js");
const { storeUserMessage } = require("./remember");
const logger = require("../src/logger.js")("chain");
const llmHelper = require("../helpers-llm"); // Import the LLMHelper
const { getUniqueEmoji } = require("../helpers-utility");

const { getConfigFromSupabase, countTokens } = require("../helpers-utility");
let config;

(async function loadConfig() {
  config = await getConfigFromSupabase();
  logger.info(`Loaded configuration: ${JSON.stringify(config)}`);
})();

function safeGet(obj, path, defaultValue = undefined) {
  return (
    path.split(".").reduce((acc, part) => acc && acc[part], obj) ?? defaultValue
  );
}

module.exports = (async () => {
  async function processMessageChain(
    messages,
    { username, channel, guild, related_message_id, sendMessage, sendImage },
    retryCount = 0,
    capabilityCallCount = 0
  ) {
    if (!config) {
      logger.info("Loading configuration...");
      config = await getConfigFromSupabase();
      logger.info(`Configuration loaded: ${JSON.stringify(config)}`);
    }

    const chainId = getUniqueEmoji();
    // logger.info(
    //   `[${chainId}] Starting message chain processing for ${username} in ${
    //     guild ? guild + " - " : ""
    //   }${channel?.name}`
    // );

    logger.info(
      `[${chainId}] Starting message chain processing for ${
        options.username
      } in ${
        safeGet(options, "guild", "")
          ? safeGet(options, "guild", "") + " - "
          : ""
      }${safeGet(options, "channel.name", "unknown channel")}`
    );

    if (!messages || !Array.isArray(messages) || messages.length === 0) {
      logger.error(`[${chainId}] Invalid or empty message array`);
      return { messages: [], finalContent: null };
    }

    try {
      while (
        retryCount <= config.MAX_RETRY_COUNT &&
        capabilityCallCount < config.MAX_CAPABILITY_CALLS
      ) {
        logger.info(`[${chainId}] Processing message iteration`);
        const { updatedMessages, updatedCapabilityCallCount, shouldContinue } =
          await processMessageChainIteration(
            messages,
            {
              username,
              channel,
              guild,
              related_message_id,
              sendMessage,
              sendImage,
            },
            capabilityCallCount,
            chainId
          );

        messages = updatedMessages;
        capabilityCallCount = updatedCapabilityCallCount;

        logger.info(
          `[${chainId}] Iteration completed: shouldContinue=${shouldContinue}`
        );
        if (!shouldContinue) break;
      }

      logger.info(`[${chainId}] Finished processing message chain`);
      return { messages, finalContent: messages[messages.length - 1].content };
    } catch (error) {
      return await handleMessageChainError(
        messages,
        { username, channel, guild, related_message_id, sendMessage },
        retryCount,
        capabilityCallCount,
        error,
        chainId
      );
    }
  }

  async function processMessageChainIteration(
    messages,
    options,
    capabilityCallCount,
    chainId
  ) {
    const lastMessage = messages[messages.length - 1];
    logger.info(`[${chainId}] Last message: ${JSON.stringify(lastMessage)}`);

    // if options doesn't come with a sendMessage, we need to stub it
    if (!options.sendMessage) {
      options.sendMessage = async (content) => {
        logger.info(`[${chainId}] Stubbed sendMessage: ${content}`);
      };
    }
    if (!options.sendImage) {
      options.sendImage = async (image) => {
        logger.info(`[${chainId}] Stubbed sendImage: <image data>`);
      };
    }

    if (lastMessage.role === "user") {
      await storeUserMessage(
        {
          username: options.username,
          channel: safeGet(options, "channel.name", "unknown"),
          guild: safeGet(options, "guild", "unknown"),
        },
        lastMessage.content
      );
      logger.info(`[${chainId}] Stored user message`);
      const aiResponse = await generateLLMResponse(messages, options);
      messages.push(aiResponse);
      logger.info(
        `[${chainId}] Generated LLM response: ${JSON.stringify(aiResponse)}`
      );
      await options.sendMessage(aiResponse.content);
      logger.info(`[${chainId}] Sent AI response`);
    }

    if (lastMessage.image) {
      logger.info(
        `[${chainId}] Last message is an image. Skipping further processing.`
      );
      return {
        updatedMessages: messages,
        updatedCapabilityCallCount: capabilityCallCount,
        shouldContinue: false,
      };
    }

    const capabilityCalls = extractCapabilityCalls(lastMessage.content);
    logger.info(
      `[${chainId}] Extracted capability calls: ${JSON.stringify(
        capabilityCalls
      )}`
    );

    if (capabilityCalls.length === 0) {
      logger.info(`[${chainId}] No capability calls found. Ending processing.`);
      return {
        updatedMessages: messages,
        updatedCapabilityCallCount: capabilityCallCount,
        shouldContinue: false,
      };
    }

    for (const call of capabilityCalls) {
      if (capabilityCallCount >= config.MAX_CAPABILITY_CALLS) {
        logger.info(
          `[${chainId}] Max capability calls reached: ${capabilityCallCount}`
        );
        return {
          updatedMessages: messages,
          updatedCapabilityCallCount: capabilityCallCount,
          shouldContinue: false,
        };
      }

      logger.info(
        `[${chainId}] Executing capability: ${call.slug}:${call.method}`
      );
      const capabilityResult = await executeCapability(call, messages);
      messages.push(capabilityResult);
      logger.info(
        `[${chainId}] Capability result: ${JSON.stringify(capabilityResult)}`
      );

      if (capabilityResult.image) {
        await options.sendImage(capabilityResult.image);
        await options.sendMessage(
          `Image generated by ${call.slug}:${call.method}`
        );
        logger.info(`[${chainId}] Sent image from capability result`);
      }

      capabilityCallCount++;
      const aiResponse = await generateLLMResponse(messages, options);
      messages.push(aiResponse);
      await options.sendMessage(aiResponse.content);
      logger.info(`[${chainId}] Sent AI response after capability`);
    }

    return {
      updatedMessages: messages,
      updatedCapabilityCallCount: capabilityCallCount,
      shouldContinue: true,
    };
  }

  async function handleMessageChainError(
    messages,
    options,
    retryCount,
    capabilityCallCount,
    error,
    chainId
  ) {
    const sendMessage =
      options.sendMessage ||
      (async (content) => {
        logger.info(`[${chainId}] Stubbed sendMessage: ${content}`);
      });

    if (retryCount < config.MAX_RETRY_COUNT) {
      logger.warn(
        `[${chainId}] Error processing message chain, retrying (${
          retryCount + 1
        }/${config.MAX_RETRY_COUNT}): ${error}`
      );
      await sendMessage(
        `An error occurred. Retrying (attempt ${retryCount + 1}/${
          config.MAX_RETRY_COUNT
        })...`
      );
      return processMessageChain(
        messages,
        options,
        retryCount + 1,
        capabilityCallCount
      );
    } else {
      logger.error(
        `[${chainId}] Error processing message chain, maximum retries exceeded: ${error}`
      );
      await options.sendMessage(
        "I apologize, but I've encountered multiple errors while processing your request. Here's my best attempt at a response based on our conversation so far:"
      );
      const finalResponse = await generateFinalResponse(messages, options);
      messages.push(finalResponse);
      await options.sendMessage(finalResponse.content);
      return { messages, finalContent: finalResponse.content };
    }
  }

  async function generateLLMResponse(messages, options) {
    const { username } = options;
    const { temperature, frequency_penalty } =
      await llmHelper.generateAiCompletionParams();

    const completion = await llmHelper.generateAiCompletion(
      messages[messages.length - 1].content,
      username,
      messages,
      { temperature, frequency_penalty }
    );
    const aiResponse =
      completion.messages[completion.messages.length - 1].content;

    return { role: "assistant", content: aiResponse };
  }

  function extractCapabilityCalls(content) {
    return Array.from(content.matchAll(capabilityRegexGlobal)).map((match) => ({
      full: match[0],
      slug: match[1],
      method: match[2],
      args: match[3],
    }));
  }

  async function executeCapability(call, messages) {
    const { slug, method, args } = call;
    try {
      logger.info(`Calling Capability: ${slug}:${method}`);
      const response = await callCapabilityMethod(slug, method, args, messages);
      logger.info(`Capability Response: ${JSON.stringify(response)}`);

      if (response.success) {
        if (response.data.image) {
          logger.info("Capability Response is an Image");
          return {
            role: "system",
            content: `Image generated by ${slug}:${method}`,
            image: response.data.image,
          };
        }
        return { role: "system", content: trimResponseIfNeeded(response.data) };
      } else {
        logger.info(`Capability Failed: ${response.error}`);
        return {
          role: "system",
          content: `Error executing capability ${slug}:${method}: ${response.error}`,
        };
      }
    } catch (error) {
      logger.error(`Unexpected error in executeCapability: ${error}`);
      return {
        role: "system",
        content: `Unexpected error executing capability ${slug}:${method}: ${error.message}`,
      };
    }
  }

  async function generateFinalResponse(messages, options) {
    const retryMessage =
      "I apologize, but I've encountered multiple issues while processing your request. Here's my best attempt at a response based on our conversation so far:";
    const llmResponse = await generateLLMResponse(
      [...messages, { role: "system", content: retryMessage }],
      options
    );
    return {
      role: "assistant",
      content: `${retryMessage}\n\n${llmResponse.content}`,
    };
  }

  function trimResponseIfNeeded(capabilityResponse) {
    if (typeof capabilityResponse !== "string") {
      capabilityResponse = JSON.stringify(capabilityResponse);
    }
    while (countTokens(capabilityResponse) > config.TOKEN_LIMIT) {
      capabilityResponse = capabilityResponse
        .split("\n")
        .slice(0, -1)
        .join("\n");
    }
    return capabilityResponse;
  }

  return { processMessageChain };
})();
