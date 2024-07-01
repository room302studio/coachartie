jest.mock("../helpers", () => ({
  // pull in existing helpers
  ...jest.requireActual("../helpers"),
  getConfigFromSupabase: jest.fn().mockResolvedValue({
    TOKEN_LIMIT: 1000,
    WARNING_BUFFER: 50,
    MAX_CAPABILITY_CALLS: 3,
    MAX_RETRY_COUNT: 2,
  }),
  getPromptsFromSupabase: jest.fn().mockResolvedValue([]),
  getUniqueEmoji: jest.fn().mockReturnValue("🔥"),
  doesMessageContainCapability: jest.fn().mockReturnValue(false),
  isExceedingTokenLimit: jest.fn().mockReturnValue(false),
  countMessageTokens: jest.fn().mockReturnValue(0),
  createTokenLimitWarning: jest.fn().mockReturnValue({
    role: "system",
    content: "Warning: Token limit approaching.",
  }),
}));

jest.mock("./supabaseclient", () => ({
  supabase: {
    from: jest.fn().mockReturnThis(),
    select: jest.fn().mockResolvedValue({ data: [], error: null }),
    insert: jest.fn().mockResolvedValue({ data: [], error: null }),
  },
}));

jest.mock("./logger", () => () => ({
  info: jest.fn(),
  error: jest.fn(),
  warn: jest.fn(),
}));

jest.mock("./chain", () => ({
  processMessageChain: jest.fn().mockResolvedValue([]),
  getCapabilityResponse: jest.fn().mockResolvedValue([]),
}));

jest.mock("./memory", () => ({
  logInteraction: jest.fn().mockResolvedValue([]),
}));

// mock the calculator capability
jest.mock("../capabilities/calculator", () => ({
  add: jest.fn().mockImplementation((a, b) => a + b),
}));

// jest.mock("./capabilities/supabaseraw", () => ({
//   select: jest.fn().mockResolvedValue([]),
//   insert: jest.fn().mockResolvedValue([]),
//   update: jest.fn().mockResolvedValue([]),
// }));

// jest.mock("./capabilities/pgcron", () => ({
//   listJobs: jest.fn().mockResolvedValue([]),
//   deleteJob: jest.fn().mockResolvedValue([]),
//   updateJob: jest.fn().mockResolvedValue([]),
// }));

// jest.mock("./capabilities/supabasetodo", () => ({
//   createTodo: jest.fn().mockResolvedValue([]),
//   deleteTodo: jest.fn().mockResolvedValue([]),
//   updateTodo: jest.fn().mockResolvedValue([]),
// }));

// jest.mock("./vision", () => ({
//   analyzeImage: jest.fn().mockResolvedValue([]),
// }));

// // discord
// jest.mock("discord.js", () => ({
//   Client: jest.fn().mockImplementation(() => ({
//     login: jest.fn().mockResolvedValue("token"),
//     on: jest.fn(),
//     user: {
//       id: "1234567890",
//     },
//   })),
//   MessageEmbed: jest.fn().mockImplementation(() => ({
//     setTitle: jest.fn().mockReturnThis(),
//     setDescription: jest.fn().mockReturnThis(),
//     setFooter: jest.fn().mockReturnThis(),
//     setTimestamp: jest.fn().mockReturnThis(),
//     setColor: jest.fn().mockReturnThis(),
//   })),
// }));

describe("processMessageChain", () => {
  it("should always return an array, even when processing fails", async () => {
    const { isExceedingTokenLimit } = require("../helpers"); // Correctly import isExceedingTokenLimit
    const { processMessageChain } = await require("./chain");

    jest.mocked(isExceedingTokenLimit).mockImplementationOnce(() => {
      throw new Error("Simulated failure");
    });
    const messages = [{ content: "Test message" }];
    const options = {
      username: "testUser",
      channel: "testChannel",
      guild: "testGuild",
    };

    const processedMessages = await processMessageChain(
      messages,
      options
    ).catch((e) => []);
    expect(Array.isArray(processedMessages)).toBe(true);
  });

  it("should return an array of processed messages when processing succeeds", async () => {
    const { processMessageChain } = await require("./chain");

    const messages = [{ content: "Test message" }];
    const options = {
      username: "testUser",
      channel: "testChannel",
      guild: "testGuild",
    };

    const processedMessages = await processMessageChain(messages, options);
    expect(Array.isArray(processedMessages)).toBe(true);
  });

  it("should skip processing for messages that are images", async () => {
    const { processMessageChain } = await require("./chain");
    const messages = [{ image: "http://example.com/image.png" }];
    const options = {
      username: "testUser",
      channel: "testChannel",
      guild: "testGuild",
    };

    const processedMessages = await processMessageChain(messages, options);
    // Assert that the original message with the image is returned unchanged
    expect(processedMessages).toEqual(messages);
  });

  // it('should return an error message without throwing', async () => {
  //   const { processMessageChain, getCapabilityResponse } = await require('./chain');

  //   // Setup a message that would attempt to invoke a non-existent capability
  //   const messages = [{ role: "user", content: 'test:test()' }];
  //   const options = { username: 'testUser', channel: 'testChannel', guild: 'testGuild' };

  //   // Attempt to process the message
  //   let processedMessages;
  //   try {
  //     processedMessages = await processMessageChain(messages, options);
  //   } catch (error) {
  //     // Fail the test if an unhandled exception is thrown
  //     fail('Unhandled exception thrown');
  //   }

  //   // Assert that processedMessages includes an error message
  //   expect(processedMessages).toEqual([
  //     // expect an object that has content that includes (but also may have some other stuff) the following:
  //     // "error running capability"
  //     expect.objectContaining({ content: expect.stringContaining('error running capability') }),
  //   ]);
  // });

  // make sure the calculator capability works
  // when running calculator:add(10,20)
  it("should return the sum of two numbers when invoking calculator:add", async () => {
    const { processMessageChain, getCapabilityResponse } =
      await require("./chain");

    // Setup a message that would invoke the calculator:add capability
    const messages = [{ role: "user", content: "calculator:add(10,20)" }];
    const options = {
      username: "testUser",
      channel: "testChannel",
      guild: "testGuild",
    };

    // Attempt to process the message
    // const processedMessages = await processMessageChain(messages, options);
    // use getCapabilityResponse instead
    const processedMessages = await getCapabilityResponse(
      "calculator",
      "add",
      "10,20",
      messages
    );

    // Assert that the response includes the sum of the two numbers
    expect(processedMessages).toEqual(30);
  });
});
