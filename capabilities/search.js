const axios = require("axios");

/**
 * Performs a search using the DuckDuckGo API.
 * @param {string} query - The search query.
 * @returns {Promise<Array<{title: string, url: string}>>} - A promise that resolves to an array of search results.
 * @throws {Error} - If an error occurs during the search.
 */
async function duckDuckGoSearch(query) {
  const url = `https://api.duckduckgo.com/?format=json&q=${encodeURIComponent(
    query,
  )}`;
  try {
    const response = await axios.get(url);
    const results = response.data.Results.map((result) => ({
      title: result.Title,
      url: result.FirstURL,
    }));
    return results;
  } catch (error) {
    console.error(`Error: ${error.message}`);
    return error.message;
  }
}

function handleCapabilityMethod(args) {
  const [operation, arg1] = destructureArgs(args);

  switch (operation) {
    case "duckDuckGoSearch":
      return duckDuckGoSearch(arg1);
    default:
      throw new Error("Invalid operation");
  }
}

module.exports = {
  handleCapabilityMethod,
};
