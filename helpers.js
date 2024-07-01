// helpers.js

const llmHelper = require("./helpers-llm.js");

const {
  addUserMessages,
  addUserMemories,
  addRelevantMemories,
  addGeneralMemories,
} = require("./helpers-memory.js");

const {
  assembleMessagePreamble,
  addSystemPrompt,
  addCapabilityPromptIntro,
  addCapabilityManifestMessage,
  convertCapabilityManifestToXML,
  convertMessagesToXML,
  getPromptsFromSupabase,
} = require("./helpers-prompt.js");

const {
  addCurrentDateTime,
  cleanUrlForPuppeteer,
  countMessageTokens,
  countTokens,
  countTokensInMessageArray,
  destructureArgs,
  displayTypingIndicator,
  doesMessageContainCapability,
  getHexagram,
  getUniqueEmoji,
  parseJSONArg,
  processChunks,
  removeMentionFromMessage,
  sleep,
  splitAndSendMessage,
  splitMessageIntoChunks,
  getConfigFromSupabase,
  // capabilityRegex,
  capabilityRegexGlobal,
  capabilityRegexSingle,
  lastUserMessage,
} = require("./helpers-utility.js");

module.exports = {
  ...llmHelper,
  addCurrentDateTime,
  addSystemPrompt,
  assembleMessagePreamble,
  cleanUrlForPuppeteer,
  convertCapabilityManifestToXML,
  convertMessagesToXML,
  countMessageTokens,
  countTokens,
  countTokensInMessageArray,
  destructureArgs,
  displayTypingIndicator,
  doesMessageContainCapability,
  getConfigFromSupabase,
  getHexagram,
  getPromptsFromSupabase,
  getUniqueEmoji,
  parseJSONArg,
  processChunks,
  removeMentionFromMessage,
  sleep,
  splitAndSendMessage,
  splitMessageIntoChunks,
  addUserMessages,
  addUserMemories,
  addRelevantMemories,
  addGeneralMemories,
  // capabilityRegex,
  capabilityRegexGlobal,
  capabilityRegexSingle,
  lastUserMessage,
};
