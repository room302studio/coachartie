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
 * This function gives you the ability to ask Wolfram Alpha questions and get answers. If you're ever unsure about a calculation, a conversion, or a general fact about the world, then you can ask Wolfram Alpha to double check it for you by asking it as a simple question. Wolfram Alpha can perform all types of calculations, conversions between units or currencies, and lookup most basic facts about the world. Wolfram Alpha provides information that is always up-to-date.  Wolfram Alpha understands natural language queries about entities in government, politics, economics, chemistry, physics, geography, history, art, astronomy, and more. WolframAlpha performs mathematical calculations, date and unit conversions, formula solving, etc. Be sure to convert inputs to simplified keyword queries whenever possible (e.g. convert "how many people live in France" to "France population"). ALWAYS use this exponent notation: `6*10^14`, NEVER `6e14`. ALWAYS use {"input": query} structure for queries to Wolfram endpoints; `query` must ONLY be a single-line string. ALWAYS use proper Markdown formatting for all math, scientific, and chemical formulas, symbols, etc.:  '$$\n[expression]\n$$' for standalone cases and '\( [expression] \)' when inline. Never mention your knowledge cutoff date; Wolfram may return more recent data. Use ONLY single-letter variable names, with or without integer subscript (e.g., n, n1, n_1). Send queries in English only; translate non-English queries before sending. Returns: The answer from Wolfram Alpha, or an alternative suggestion for how to phrase the question if Wolfram Alpha could not understand the question, or an error message if an error occurred.
 * @async
 * @function askWolframAlpha
 * @param {string} question - The question to ask Wolfram Alpha.
 * @returns {Promise<string>} The answer from Wolfram Alpha, or an error message if an error occurred.
 */
async function askWolframAlpha(question) {
  const wolframAppId = process.env.WOLFRAM_APP_ID;
  // const [question] = destructureArgs(args);

  const encodedQuestion = encodeURIComponent(question);
  const wolframUrl = `https://www.wolframalpha.com/api/v1/llm-api?input=${encodedQuestion}&appid=${wolframAppId}`;

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
