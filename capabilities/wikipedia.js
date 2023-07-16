const axios = require('axios');
const {
  Configuration,
  OpenAIApi
} = require("openai");
const dotenv = require("dotenv");
const { destructureArgs } = require('./helpers');

dotenv.config();

const configuration = new Configuration({
  organization: process.env.OPENAI_API_ORGANIZATION,
  apiKey: process.env.OPENAI_API_KEY,
});
const openai = new OpenAIApi(configuration);

async function handleCapabilityMethod(method, args) {
  const [arg1] = destructureArgs(args);

  if (method === 'askWikipedia') {
    return askWikipedia(arg1);
  } else {
    throw new Error(`Method ${method} not supported by Wikipedia capability.`);
  }
}

async function askWikipedia(args) {
  const query = destructureArgs(args)[0];

  const wikipediaApiUrl = 'https://en.wikipedia.org/w/api.php';
  const searchParams = {
    action: 'query',
    list: 'search',
    format: 'json',
    srsearch: `${encodeURIComponent(query)}`,
    srprop: 'snippet',
    srsort: 'relevance',
    srlimit: 32,
  };

  console.log('Searching Wikipedia for:', query);
  console.log('Encoded query:', searchParams.srsearch);
  console.log('Full URL:', `${wikipediaApiUrl}?${new URLSearchParams(searchParams).toString()}`);

  try {
    const searchResponse = await axios.get(wikipediaApiUrl, { params: searchParams });

    if (searchResponse.data.query.search.length === 0) {
      console.log('No Wikipedia articles found for the given query.');
      return 'No Wikipedia articles found for the given query.';
    }

    const searchEvaluation = await openai.createChatCompletion({
      model: "gpt-3.5-turbo-16k",
      max_tokens: 444,
      temperature: 1,
      messages: [{
          role: "user",
          content: `# Wikipedia search results for "${query}"\n${searchResponse.data.query.search.map((result) => `* ${result.title} (${result.snippet})`).join('\n')}`,
        },
        {
          role: "user",
          content: `Given these search results which Wikipedia articles would be most useful to answer ${query}? Please respond only with a simple list of articles and why they are relevant to the query. Highlight anything fun and interesting or that might spark creativity. Be as concise as possible. Also include the article URL (do not use markdown).`
        }
      ],
    });

    return searchEvaluation.data.choices[0].message.content;

  } catch (error) {
    console.log('error', error);
    return 'Error occurred while contacting Wikipedia. Please try again later.';
  }
}

module.exports = {
  handleCapabilityMethod,
};