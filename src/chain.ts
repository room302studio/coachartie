// chain.ts

import {
  getConfigFromSupabase,
  countTokens,
  getUniqueEmoji,
} from "../helpers-utility";
import { callCapabilityMethod } from "./capabilities";
import { storeUserMessage } from "./remember";
// import { logger } from "../src/logger";
import logger from "../src/logger";
import llmHelper from "../helpers-llm";
import { capabilityRegexGlobal } from "../helpers-utility";

interface Config {
  MAX_RETRY_COUNT: number;
  MAX_CAPABILITY_CALLS: number;
  TOKEN_LIMIT: number;
}

interface Message {
  role: "user" | "assistant" | "system";
  content: string;
  image?: string;
}

interface Options {
  username: string;
  channel: { name: string };
  guild?: string;
  related_message_id?: string;
  sendMessage: (content: string) => Promise<void>;
  sendImage: (image: string) => Promise<void>;
}

interface CapabilityCall {
  full: string;
  slug: string;
  method: string;
  args: string;
}

interface IterationResult {
  updatedMessages: Message[];
  updatedCapabilityCallCount: number;
  shouldContinue: boolean;
}

let config: Config;

async function loadConfig(): Promise<void> {
  config = await getConfigFromSupabase();
  logger.info(`Loaded configuration: ${JSON.stringify(config)}`);
}

loadConfig();

export async function processMessageChain(
  messages: Message[],
  options: Options,
  retryCount = 0,
  capabilityCallCount = 0
): Promise<{ messages: Message[]; finalContent: string | null }> {
  if (!config) {
    logger.info("Loading configuration...");
    await loadConfig();
  }

  const chainId = getUniqueEmoji();
  logger.info(
    `[${chainId}] Starting message chain processing for ${
      options.username
    } in ${options.guild ? options.guild + " - " : ""}${options.channel.name}`
  );

  if (!messages || messages.length === 0) {
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
          options,
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
    return handleMessageChainError(
      messages,
      options,
      retryCount,
      capabilityCallCount,
      error,
      chainId
    );
  }
}

async function processMessageChainIteration(
  messages: Message[],
  options: Options,
  capabilityCallCount: number,
  chainId: string
): Promise<IterationResult> {
  const lastMessage = messages[messages.length - 1];
  logger.info(`[${chainId}] Last message: ${JSON.stringify(lastMessage)}`);

  if (lastMessage.role === "user") {
    await storeUserMessage(
      {
        username: options.username,
        channel: options.channel.name,
        guild: options.guild,
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
  messages: Message[],
  options: Options,
  retryCount: number,
  capabilityCallCount: number,
  error: Error,
  chainId: string
): Promise<{ messages: Message[]; finalContent: string | null }> {
  if (retryCount < config.MAX_RETRY_COUNT) {
    logger.warn(
      `[${chainId}] Error processing message chain, retrying (${
        retryCount + 1
      }/${config.MAX_RETRY_COUNT}): ${error}`
    );
    await options.sendMessage(
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

async function generateLLMResponse(
  messages: Message[],
  options: Options
): Promise<Message> {
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

function extractCapabilityCalls(content: string): CapabilityCall[] {
  return Array.from(content.matchAll(capabilityRegexGlobal)).map((match) => ({
    full: match[0],
    slug: match[1],
    method: match[2],
    args: match[3],
  }));
}

async function executeCapability(
  call: CapabilityCall,
  messages: Message[]
): Promise<Message> {
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

async function generateFinalResponse(
  messages: Message[],
  options: Options
): Promise<Message> {
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

function trimResponseIfNeeded(capabilityResponse: string | object): string {
  let response =
    typeof capabilityResponse === "string"
      ? capabilityResponse
      : JSON.stringify(capabilityResponse);
  while (countTokens(response) > config.TOKEN_LIMIT) {
    response = response.split("\n").slice(0, -1).join("\n");
  }
  return response;
}
