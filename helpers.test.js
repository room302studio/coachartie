const dotenv = require("dotenv");
dotenv.config();

const {
  countTokens,
  countTokensInMessageArray,
  removeMentionFromMessage,
  splitAndSendMessage,
  splitMessageIntoChunks,
  destructureArgs,
  parseJSONArg,
  cleanUrlForPuppeteer,
  sleep,
  processChunks,
  getConfigFromSupabase,
  displayTypingIndicator,
  getUniqueEmoji,
  doesMessageContainCapability,
  countMessageTokens,
  lastUserMessage,
} = require("./helpers-utility.js");

const {
  assembleMessagePreamble,
  addCurrentDateTime,
  addHexagramPrompt,
  addSystemPrompt,
  addCapabilityPromptIntro,
  addCapabilityManifestMessage,
} = require("./helpers-prompt.js");

// Mock dependencies
jest.mock("./src/logger.js", () => {
  return () => ({
    info: jest.fn(),
    error: jest.fn(),
    warn: jest.fn(),
  });
});

jest.mock("./src/supabaseclient", () => ({
  supabase: {
    from: jest.fn().mockReturnThis(),
    select: jest.fn().mockResolvedValue({ data: [], error: null }),
  },
}));

jest.mock("@nem035/gpt-3-encoder", () => ({
  encode: jest.fn().mockReturnValue([1, 2, 3, 4]),
}));

jest.mock("chance", () => {
  return {
    Chance: jest.fn().mockImplementation(() => ({
      bool: jest.fn().mockReturnValue(true),
      integer: jest.fn().mockReturnValue(5),
    })),
  };
});

describe("Helpers", () => {
  describe("helpers-utility.js", () => {
    test("countTokens", () => {
      expect(countTokens("test string")).toBe(4);
    });

    test("countTokensInMessageArray", () => {
      const messages = [
        { role: "user", content: "Hello" },
        { role: "assistant", content: "Hi there" },
      ];
      expect(countTokensInMessageArray(messages)).toBe(8);
    });

    test("removeMentionFromMessage", () => {
      expect(removeMentionFromMessage("<@123456> Hello", "123456")).toBe(
        "Hello"
      );
    });

    test("splitMessageIntoChunks", () => {
      const longMessage = "a".repeat(2500);
      const chunks = splitMessageIntoChunks(longMessage);
      expect(chunks.length).toBe(2);
      expect(chunks[0].length).toBeLessThanOrEqual(2500);
      expect(chunks[1].length).toBeLessThanOrEqual(2500);
    });

    test("destructureArgs", () => {
      expect(destructureArgs("arg1, arg2, arg3")).toEqual([
        "arg1",
        "arg2",
        "arg3",
      ]);
    });

    test("parseJSONArg", () => {
      expect(parseJSONArg("{'key': 'value'}")).toEqual({ key: "value" });
    });

    test("cleanUrlForPuppeteer", () => {
      expect(cleanUrlForPuppeteer("'https://example.com'")).toBe(
        "https://example.com"
      );
    });

    test("sleep", async () => {
      const start = Date.now();
      await sleep(100);
      const end = Date.now();
      expect(end - start).toBeGreaterThanOrEqual(100);
    });

    test("processChunks", async () => {
      const chunks = [[1], [2], [3]];
      const processFunction = jest.fn().mockResolvedValue("processed");
      const result = await processChunks(chunks, processFunction);
      expect(result).toEqual(["processed", "processed", "processed"]);
    });

    test("getConfigFromSupabase", async () => {
      const config = await getConfigFromSupabase();
      expect(config).toEqual({});
    });

    test("getUniqueEmoji", () => {
      const emoji1 = getUniqueEmoji();
      const emoji2 = getUniqueEmoji();
      expect(emoji1).not.toBe(emoji2);
    });

    test("doesMessageContainCapability", () => {
      expect(doesMessageContainCapability("calculator:add(1,2)")).toBe(true);
      expect(doesMessageContainCapability("Hello world")).toBe(false);
    });

    test("countMessageTokens", () => {
      const messages = [
        { role: "user", content: "Hello" },
        { role: "assistant", content: "Hi there" },
      ];
      expect(countMessageTokens(messages)).toBe(8);
    });

    test("lastUserMessage", () => {
      const messages = [
        { role: "user", content: "Hello" },
        { role: "assistant", content: "Hi there" },
        { role: "user", content: "How are you?" },
      ];
      expect(lastUserMessage(messages)).toBe("How are you?");
    });
  });

  describe("helpers-prompt.js", () => {
    test("assembleMessagePreamble", async () => {
      const result = await assembleMessagePreamble(
        "testUser",
        "Test prompt",
        []
      );
      expect(Array.isArray(result)).toBe(true);
      expect(result.length).toBeGreaterThan(0);
    });

    test("addCurrentDateTime", () => {
      const messages = [];
      addCurrentDateTime(messages);
      expect(messages.length).toBe(1);
      expect(messages[0].role).toBe("system");
      expect(messages[0].content).toContain("Today is");
    });

    test("addHexagramPrompt", async () => {
      const messages = [];
      await addHexagramPrompt(messages);
      expect(messages.length).toBe(1);
      expect(messages[0].role).toBe("system");
      expect(messages[0].content).toContain(
        "Let this hexagram from the I Ching guide this interaction:"
      );
    });

    test("addSystemPrompt", async () => {
      const messages = [];
      await addSystemPrompt(messages);
      expect(messages.length).toBe(1);
      expect(messages[0].role).toBe("user");
    });

    test("addCapabilityPromptIntro", async () => {
      const messages = [];
      await addCapabilityPromptIntro(messages);
      expect(messages.length).toBe(1);
      expect(messages[0].role).toBe("user");
    });

    test("addCapabilityManifestMessage", async () => {
      const messages = [];
      await addCapabilityManifestMessage(messages);
      expect(messages.length).toBe(1);
      expect(messages[0].role).toBe("user");
      expect(messages[0].content).toContain("CAPABILITY MANIFEST");
    });
  });
});
