const { handleCapabilityMethod } = require("./wikipedia");
const assert = require("assert");

describe("Wikipedia", function () {
  describe("#handleCapabilityMethod()", function () {
    it('should return a string when "askWikipedia" method is passed with a valid question', async function () {
      const result = await handleCapabilityMethod("askWikipedia", [
        "Paris, France",
      ]);
      assert.equal(typeof result, "string");
      assert.notInclude(result, "error");
    });

    it("should throw an error when an unsupported method is passed", async function () {
      try {
        await handleCapabilityMethod("unsupportedMethod", ["Paris,"]);
      } catch (error) {
        assert.equal(
          error.message,
          "Method unsupportedMethod not supported by Wikipedia capability."
        );
      }
    });
  });
});
