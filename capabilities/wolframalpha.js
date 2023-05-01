const axios = require('axios');

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
    return 'Error occurred while contacting Wolfram Alpha. Please try again later.';
  }
}

module.exports = {
  askWolframAlpha,
};