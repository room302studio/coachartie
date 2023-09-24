const { fetchAndSummarizeUrl, fetchAllLinks } = require("./web");
const assert = require("assert");

describe("Web", function () {
  describe("#fetchAndSummarizeUrl()", function () {
    it("should return a string when a valid URL is passed", async function () {
      const result = await fetchAndSummarizeUrl("https://github.com");
      assert.equal(typeof result, "string");
    });
  });

  describe("#fetchAllLinks()", function () {
    it("should return a string when a valid URL is passed", async function () {
      const result = await fetchAllLinks("https://github.com");
      assert.equal(typeof result, "string");
    });
  });
});
