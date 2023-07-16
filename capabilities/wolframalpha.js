const axios = require('axios');
const dotenv = require("dotenv");
dotenv.config();

const { destructureArgs } = require('./helpers');

async function handleCapabilityMethod(method, args) {
  const [arg1] = destructureArgs(args);

  if (method === 'askWolframAlpha') {
    return askWolframAlpha(arg1);
  } else {
    throw new Error(`Method ${method} not supported by Wolfram Alpha capability.`);
  }
}

async function askWolframAlpha(args) {
  const wolframAppId = process.env.WOLFRAM_APP_ID;
  const [question] = destructureArgs(args);

  const encodedQuestion = encodeURIComponent(question);
  const wolframUrl = `https://api.wolframalpha.com/v1/result?i=${encodedQuestion}&appid=${wolframAppId}`;

  try {
    const response = await axios.get(wolframUrl);
    return response.data;
  } catch (error) {
    throw new Error(`Error occurred while contacting Wolfram Alpha: ${error}`);
  }
}

module.exports = {
  handleCapabilityMethod,
};