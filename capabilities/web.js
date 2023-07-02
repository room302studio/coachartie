const axios = require('axios');

async function duckDuckGoSearch(query) {
  const url = `https://api.duckduckgo.com/?format=json&q=${encodeURIComponent(query)}`;
  try {
    const response = await axios.get(url);
    const results = response.data.Results.map(result => ({
      title: result.Title,
      url: result.FirstURL,
    }));
    return results;
  } catch (error) {
    console.error(`Error: ${error.message}`);
    return error.message;
  }
}

module.exports = {
  duckDuckGoSearch
};