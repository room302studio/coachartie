const { generateAndStoreRememberCompletion } = require("./memory");
const { expect } = require("chai");

describe("Memory Module", function() {
  describe("generateAndStoreRememberCompletion", function() {
    const prompt = "Hello, how are you?";
    const response = "I'm fine, thank you.";
    const username = "testUser";
    const conversationHistory = [
      {
        role: "system",
        content: "You remember from a previous interaction at 2022-01-01: Happy New Year!  ",
      },
      {
        role: "user",
        content: prompt,
      },
      {
        role: "assistant",
        content: response,
      },
      {
        role: "user",
        content: "Remember this conversation.",
      },
    ];

    it("should return a string", async function() {
      const result = await generateAndStoreRememberCompletion(prompt, response, username, conversationHistory);
      expect(result).to.be.a("string");
    });



