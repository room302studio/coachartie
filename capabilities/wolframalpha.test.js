const { handleCapabilityMethod } = require("./wolframalpha");
const assert = require("assert");

describe("WolframAlpha", function () {
  describe("#handleCapabilityMethod()", function () {
    it("should throw an error when an unsupported method is passed", async function () {
      try {
        await handleCapabilityMethod("unsupportedMethod", "arg1");
      } catch (error) {
        assert.equal(
          error.message,
          "Method unsupportedMethod not supported by Wolfram Alpha capability."
        );
      }
    });

    it('should return a string when "askWolframAlpha" method is passed with a valid question', async function () {
      const result = await handleCapabilityMethod(
        "askWolframAlpha",
        "What is the capital of France?"
      );
      assert.equal(typeof result, "string");
      assert.notInclude(result, "error");
    });
  });
});
