const axios = require('axios');
const cheerio = require('cheerio');
const dotenv = require("dotenv");
const { encode, decode } = require("@nem035/gpt-3-encoder");
const { Configuration, OpenAIApi } = require("openai");


dotenv.config();

const configuration = new Configuration({
  organization: process.env.OPENAI_API_ORGANIZATION,
  apiKey: process.env.OPENAI_API_KEY,
});
const openai = new OpenAIApi(configuration);


async function getWikipediaArticleText(query) {
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
    // console.log('searchResponse.data.query.search', searchResponse.data.query.search);

    if (searchResponse.data.query.search.length === 0) {
      // throw Error('No Wikipedia articles found for the given query.');
      console.log('No Wikipedia articles found for the given query.');
      return 'No Wikipedia articles found for the given query.';
    }

    // use chatCompletion to evaluate all of the search results and pick one to navigate to directly
    const searchEvaluation = await openai.createChatCompletion({
      model: "gpt-3.5-turbo-16k",
      max_tokens: 444,
      temperature: 1,
      // frequency_penalty: 0.1,
      messages: [
        {
          role: "user",
          content: `# Wikipedia search results for "${query}"\n${searchResponse.data.query.search.map((result) => `* ${result.title} (${result.snippet})`).join('\n')}`,
        },
        // {
        //   role: "user",
        //   content: `From the list of wikipedia results I just gave you, what is the ID of the article that best answers (${query}) Respond ONLY with the page ID of the article that is most relevant to my query.`
        // },
        {
          role: "user",
          content: `Given these search results which Wikipedia articles would be most useful to answer ${query}? Please respond only with a simple list of articles and why they are relevant to the query. Highlight anything fun and interesting or that might spark creativity. Be as concise as possible. Also include the article URL (do not use markdown).`
        }
      ],
    });

    return searchEvaluation.data.choices[0].message.content

  } catch (error) {
    console.log('error', error);
    return 'Error occurred while contacting Wikipedia. Please try again later.';
  }
}

async function askWikipedia(query) {
  const articleText = await getWikipediaArticleText(query);
  return `A search for ${query} returned a few articles: ${articleText}
  
  If any of these articles look interesting, use your web capabilities to navigate to the article and read it. If you find any interesting information, share it with the user.`;
}

module.exports = {
  askWikipedia,
};

function countMessageTokens(messageArray = []) {
  let totalTokens = 0;
  // console.log("Message Array: ", messageArray);
  if (!messageArray) {
    return totalTokens;
  }
  if (messageArray.length === 0) {
    return totalTokens;
  }

  // for some reason we get messageArray.forEach is not a function
  // when we try to use the forEach method on messageArray
  // so we use a for loop instead

  // messageArray.forEach((message) => {
  //   // encode message.content
  //   const encodedMessage = encode(JSON.stringify(message));
  //   totalTokens += encodedMessage.length;
  // });

  // for loop
  for (let i = 0; i < messageArray.length; i++) {
    const message = messageArray[i];
    // encode message.content
    const encodedMessage = encode(JSON.stringify(message));
    totalTokens += encodedMessage.length;
  }

  return totalTokens;
}