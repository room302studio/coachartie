const dotenv = require("dotenv");
// const { Configuration, OpenAIApi } = require("openai");
dotenv.config();
const OpenAI = require("openai");
const openai = new OpenAI();

// const configuration = new Configuration({
//   apiKey: process.env.OPENAI_API_KEY,
//   organization: process.env.OPENAI_API_ORGANIZATION,
// });
// const openai = new OpenAIApi(configuration);

module.exports = {
  openai,
};
