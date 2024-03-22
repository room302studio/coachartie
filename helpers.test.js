const dotenv = require("dotenv");
dotenv.config();

const {
  destructureArgs,
  getHexagram,
  countTokens,
  countMessageTokens,
  removeMentionFromMessage,
  isBreakingMessageChain,
  processChunks,
  assembleMessagePreamble,
  addCurrentDateTime,
  addHexagramPrompt,
  // addSystemPrompt,
  addCapabilityPromptIntro,
  addCapabilityManifestMessage,
  addTodosToMessages,
  addUserMessages,
  addUserMemories,
  addRelevantMemories,
  addGeneralMemories
} = require("./helpers.js");

// Mocking the dependent functions
// jest.mock("./helpers.js", () => ({
//   ...jest.requireActual("./helpers.js"),
//   addCurrentDateTime: jest.fn(),
//   addHexagramPrompt: jest.fn(),
//   addSystemPrompt: jest.fn(),
//   addCapabilityPromptIntro: jest.fn(),
//   addCapabilityManifestMessage: jest.fn(),
//   addTodosToMessages: jest.fn(),
//   addUserMessages: jest.fn(),
//   addUserMemories: jest.fn(),
//   addRelevantMemories: jest.fn(),
//   addGeneralMemories: jest.fn()
// }));

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

    describe("processChunks", () => {
      it("should process chunks of data asynchronously", async () => {
        const chunks = [["data1"], ["data2"], ["data3"]];
        const processFunction = jest.fn().mockResolvedValue("processed");
        const results = await processChunks(chunks, processFunction, 2);
        expect(results).toEqual(["processed", "processed", "processed"]);
        expect(processFunction).toHaveBeenCalledTimes(chunks.length);
      });
    });

    describe("addCurrentDateTime", () => {
      it("should add the current date and time to the messages array", () => {
        const messages = [];
        addCurrentDateTime(messages);
        expect(messages).toHaveLength(1);
        expect(messages[0].role).toEqual("system");
        // Adjusted the regex to match the received string format including AM/PM
        expect(messages[0].content).toMatch(/Today is \d{1,2}\/\d{1,2}\/\d{4} at \d{1,2}:\d{2}:\d{2} [AP]M/);
      });
    });

    describe("addSystemPrompt", () => {
      it("should add a system prompt to the messages array", async () => {
        const { addSystemPrompt } = require("./helpers.js");
        const messages = [];
        await addSystemPrompt(messages);
        expect(messages).toHaveLength(1);
        expect(messages[0].role).toEqual("user");
      });
    });

    // make sure assembleMessagePreamble works as expected
    // describe("assembleMessagePreamble", () => {
    //   it("should assemble a message preamble", () => {
    //     const messages = [];
    //     assembleMessagePreamble(messages);
    //     expect(messages).toHaveLength(1);
    //   });
    // });


  });
});
