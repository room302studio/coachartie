// src/index.js

// Import modules from chain.js
const {
  processMessageChain,
  processMessage,
  processCapability,
  DiscordBot,
  countMessageTokens,
  doesMessageContainCapability,
  generateAiCompletionParams,
  displayTypingIndicator,
  generateAiCompletion,
  splitAndSendMessage
} = require('./chain');

// Import modules from capabilities.js
const {
  capabilityRegex,
  capabilities,
  capabilityPrompt,
  callCapabilityMethod
} = require('./capabilities');

// Import modules from memory.js
const {
  generateAndStoreRememberCompletion
} = require('./memory');

// Import modules from openai.js
const {
  openai
} = require('./openai');

// Export modules
module.exports = {
  processMessageChain,
  processMessage,
  processCapability,
  DiscordBot,
  countMessageTokens,
  doesMessageContainCapability,
  generateAiCompletionParams,
  displayTypingIndicator,
  generateAiCompletion,
  splitAndSendMessage,
  capabilityRegex,
  capabilities,
  capabilityPrompt,
  callCapabilityMethod,
  generateAndStoreRememberCompletion,
  openai
};
