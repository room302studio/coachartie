const axios = require('axios');
const dotenv = require("dotenv");
dotenv.config();

/*

{
  slug: 'wolframalpha',
  description: 'This capability gives you the ability to ask Wolfram Alpha questions and get answers.',
  enabled: false,
  methods: [
    {
      name: 'askWolframAlpha',
      parameters: [
        {
          name: 'question',
          type: 'string',
        }
      ],
      returns: 'string',
    }
  ]
},

*/

async function askWolframAlpha(question) {
  const wolframAppId = process.env.WOLFRAM_APP_ID;
  const encodedQuestion = encodeURIComponent(question);
  const wolframUrl = `https://api.wolframalpha.com/v1/result?i=${encodedQuestion}&appid=${wolframAppId}`;

  try {
    const response = await axios.get(wolframUrl);
    return response.data;
  } catch (error) {
    return `Error occurred while contacting Wolfram Alpha. 501 errors are commonly caused by input that is misspelled, poorly formatted or otherwise unintelligible... try rephrasing the query or breaking it down into multiple queries so that Wolfram Alpha can better understand it. Example queries: 
      - What is the population of New York City?
      - Sunrise tomorrow
      - How many cups in 4 liters?
      - 42% of 79 years
      - average velocity, 2 miles over 20 minutes
    
    Error: ${error}`;
  }
}

module.exports = {
  askWolframAlpha,
};