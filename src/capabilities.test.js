const { encode } = require("@nem035/gpt-3-encoder");
const { describe, it, expect } = require("@jest/globals");
const { capabilityRegex, callCapabilityMethod } = require("./capabilities");
const { TOKEN_LIMIT } = require("../helpers");

describe("Capabilities", () => {
  it("should handle errors gracefully", async () => {
    const capabilitySlug = "nonexistentCapability";
    const methodName = "nonexistentMethod";
    const args = [];
    const response = await callCapabilityMethod(
      capabilitySlug,
      methodName,
      args,
    );
    expect(response).toContain("Error");
  });

  it("should match capabilities in user messages", () => {
    const message = "callSomething:callSomething()";
    const matches = message.match(capabilityRegex);
    expect(matches).not.toBeNull();
  });

  it("should extract function name and arguments from a capability call", () => {
    const message = "callSomething:callSomething(arg1, arg2)";
    const matches = message.match(capabilityRegex);
    expect(matches).not.toBeNull();
    expect(matches[1]).toEqual("callSomething");
    expect(matches[2]).toEqual("callSomething");
    expect(matches[3]).toEqual("arg1, arg2");
  });
});
