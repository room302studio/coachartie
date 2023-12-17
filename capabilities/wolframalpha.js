const axios = require("axios");
const dotenv = require("dotenv");
dotenv.config();

const { destructureArgs } = require("../helpers");

async function handleCapabilityMethod(method, args) {
  const [arg1] = destructureArgs(args);

  if (method === "askWolframAlpha") {
    return askWolframAlpha(arg1);
  } else {
    throw new Error(
      `Method ${method} not supported by Wolfram Alpha capability.`,
    );
  }
}

/**
 * This function gives you the ability to ask Wolfram Alpha questions and get answers.
 * @async
 * @function askWolframAlpha
 * @param {string} question - The question to ask Wolfram Alpha.
 * @returns {Promise<string>} The answer from Wolfram Alpha, or an error message if an error occurred.
 */
async function askWolframAlpha(question) {
  const wolframAppId = process.env.WOLFRAM_APP_ID;
  // const [question] = destructureArgs(args);

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
