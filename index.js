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
} = require('./src/chain');

// Import modules from capabilities.js
const {
  capabilityRegex,
  capabilities,
  capabilityPrompt,
  callCapabilityMethod
} = require('./src/capabilities');

// Import modules from memory.js
const {
  generateAndStoreRememberCompletion
} = require('./src/memory');

// Import modules from openai.js
const {
  openai
} = require('./src/openai');

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
