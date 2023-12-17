const { Chance } = require("chance");
const chance = new Chance();
const dotenv = require("dotenv");
const { openai } = require("./src/openai");
const { capabilityRegex } = require("./src/capabilities.js");
const {
  getUserMemory,
  getUserMessageHistory,
} = require("./capabilities/remember");
dotenv.config();

const {
  ERROR_MSG,
  TOKEN_LIMIT,
  RESPONSE_LIMIT,
  WARNING_BUFFER,
  destructureArgs,
  getHexagram,
  countTokens,
  countMessageTokens,
  removeMentionFromMessage,
  replaceRobotIdWithName,
  doesMessageContainCapability,
  isBreakingMessageChain,
  trimResponseIfNeeded,
  generateAiCompletionParams,
  displayTypingIndicator,
  generateAiCompletion,
  assembleMessagePreamble,
  splitMessageIntoChunks,
  splitAndSendMessage,
  createTokenLimitWarning,
  isExceedingTokenLimit,
} = require("./helpers.js");

describe("Helpers", () => {
  describe("destructureArgs", () => {
    it("should destructure arguments correctly", () => {
      const args = "arg1, arg2, arg3";
      const result = destructureArgs(args);
      expect(result).toEqual(["arg1", "arg2", "arg3"]);
    });
  });

  describe("getHexagram", () => {
    it("should return a valid hexagram", () => {
      const hexagram = getHexagram();
      expect(hexagram).toMatch(/^[1-9][0-9]?.\s.+/);
    });
  });

  describe("countTokens", () => {
    it("should return correct token count", () => {
      const str = "Hello, world!";
      const result = countTokens(str);
      expect(result).toBe(4);
    });
  });

  describe("countMessageTokens", () => {
    it("should return correct token count for messages", () => {
      const messages = [{ role: "user", content: "Hello, world!" }];
      const result = countMessageTokens(messages);
      expect(result).toBe(12);
    });
  });

  describe("removeMentionFromMessage", () => {
    it("should remove mention from message", () => {
      const message = "<@1234567890> Hello, world!";
      const mention = "<@1234567890>";
      const result = removeMentionFromMessage(message, mention);
      expect(result).toBe("Hello, world!");
    });
  });

  describe("countTokens", () => {
    it("should return correct token count", () => {
      const str = "Hello, world!";
      const result = countTokens(str);
      expect(result).toBe(4);
    });
  });

  describe("countMessageTokens", () => {
    it("should return correct token count for messages", () => {
      const messages = [{ role: "user", content: "Hello, world!" }];
      const result = countMessageTokens(messages);
      expect(result).toBe(12);
    });
  });

  describe("removeMentionFromMessage", () => {
    it("should remove mention from message", () => {
      const message = "<@1234567890> Hello, world!";
      const mention = "<@1234567890>";
      const result = removeMentionFromMessage(message, mention);
      expect(result).toBe("Hello, world!");
    });
  });

  describe("isBreakingMessageChain", () => {
    it("should return true if there is no capability match and the last message role is not user or system", () => {
      const capabilityMatch = false;
      const lastMessage = { role: "bot" };
      const result = isBreakingMessageChain(capabilityMatch, lastMessage);
      expect(result).toBe(true);
    });

    it("should return false if there is a capability match", () => {
      const capabilityMatch = true;
      const lastMessage = { role: "bot" };
      const result = isBreakingMessageChain(capabilityMatch, lastMessage);
      expect(result).toBe(false);
    });

    it("should return false if the last message role is user or system", () => {
      const capabilityMatch = false;
      const lastMessageUser = { role: "user" };
      const lastMessageSystem = { role: "system" };
      const resultUser = isBreakingMessageChain(
        capabilityMatch,
        lastMessageUser,
      );
      const resultSystem = isBreakingMessageChain(
        capabilityMatch,
        lastMessageSystem,
      );
      expect(resultUser).toBe(false);
      expect(resultSystem).toBe(false);
    });
  });
});
