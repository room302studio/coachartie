const winston = require('winston');
const {
  countMessageTokens,
  doesMessageContainCapability,
  generateAiCompletionParams,
  generateAiCompletion,
  trimResponseIfNeeded,
  TOKEN_LIMIT,
  WARNING_BUFFER,
  isExceedingTokenLimit
} = require("../helpers.js");
const { generateAndStoreRememberCompletion } = require("./memory.js");
const {
  capabilityRegex,
  callCapabilityMethod
} = require("./capabilities.js");
const { storeUserMessage } = require("../capabilities/remember");

// Create a new logger instance
const logger = winston.createLogger({
  level: 'info',
  format: winston.format.json(),
  defaultMeta: { service: 'user-service' },
  transports: [
    new winston.transports.File({ filename: 'capability-chain.log' })
  ]
});

async function getCapabilityResponse(capSlug, capMethod, capArgs) {
  let capabilityResponse;
  try {
    logger.info('Calling Capability: ' + capSlug + ':' + capMethod);
    capabilityResponse = await callCapabilityMethod(
      capSlug,
      capMethod,
      capArgs
    );
    logger.info('Capability Responded: ' + capSlug + ':' + capMethod);
  } catch (e) {
    logger.error(e);
    capabilityResponse = "Capability error: " + e;
    logger.error('Error: ' + e);
  }

  logger.info('Capability Response: ' + capabilityResponse);
  if (capabilityResponse.image) {
    logger.info('📍 Capability Response is an Image');
    return capabilityResponse;
  }
  
  return trimResponseIfNeeded(capabilityResponse);
}

async function processCapability(messages, capabilityMatch) {
  const [_, capSlug, capMethod, capArgs] = capabilityMatch;
  const currentTokenCount = countMessageTokens(messages);

  if (currentTokenCount >= TOKEN_LIMIT - WARNING_BUFFER) {
    logger.warn('Token Limit Warning: Current Tokens - ' + currentTokenCount);
    messages.push(createTokenLimitWarning());
  }

  logger.info('Processing Capability: ' + capSlug + ':' + capMethod);
  const capabilityResponse = await getCapabilityResponse(
    capSlug,
    capMethod,
    capArgs
  );

  // if the response has .image property, delete it
  // if (capabilityResponse.image) {
  //   delete capabilityResponse.image;
  // }

  const message = {
    role: "system",
    content: 'Capability ' + capSlug + ':' + capMethod + ' responded with: ' + capabilityResponse,
  }

  if (capabilityResponse.image) {
    message.image = capabilityResponse.image;
  }

  messages.push(message);

  return messages;
}

async function processMessageChain(messages, username) {
  if (!messages.length) {
    logger.warn('Empty Message Chain');
    return [];
  }

  let lastMessage = messages[messages.length - 1];

  if(lastMessage.image) {
    logger.info('Last Message is an Image');
    return messages;
  }

  do {
    logger.info('Processing Message Chain: ' + lastMessage.content.slice(0, 20) + '...');
    messages = await processMessage(messages, lastMessage.content, username);
    lastMessage = messages[messages.length - 1];
  } while (
    doesMessageContainCapability(lastMessage.content) &&
    !isExceedingTokenLimit(messages)
  );

  return messages;
}

async function processMessage(messages, lastMessage, username) {
  if (doesMessageContainCapability(lastMessage)) {
    const capabilityMatch = lastMessage.match(capabilityRegex);

    try {
      messages = await processCapability(messages, capabilityMatch);
    } catch (error) {
      messages.push({
        role: "system",
        content: 'Error processing capability: ' + error,
      });
    }
  }

  if (messages[messages.length - 1].image) {
    logger.info('Last Message is an Image');
    return messages;
  }

  const lastUserMessage = messages.find((m) => m.role === "user");
  const prompt = lastUserMessage.content;

  storeUserMessage(username, prompt);

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

  generateAndStoreRememberCompletion(prompt, aiResponse, username, messages);

  return messages;
}

module.exports = {
  processMessageChain,
  processMessage,
  processCapability,
};
