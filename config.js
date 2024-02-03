const dotenv = require("dotenv");
// set up dotenv config
dotenv.config();

const ERROR_MSG = `I am so sorry, there was some sort of problem. Feel free to ask me again, or try again later.`;
const TOKEN_LIMIT = 14000;
const RESPONSE_LIMIT = 5120;
const WARNING_BUFFER = 1024;
const MAX_OUTPUT_TOKENS = 720;
// const REMEMBER_MODEL = "gpt-4-1106-preview";
// const CHAT_MODEL = "gpt-4-1106-preview";
const REMEMBER_MODEL = process.env.OPENAI_REMEMBER_MODEL;
const CHAT_MODEL = process.env.OPENAI_CHAT_MODEL;

const MAX_RETRY_COUNT = 3;
const MAX_CAPABILITY_CALLS = 6;

// DB config stuff
const MESSAGES_TABLE_NAME = "messages";
const MEMORIES_TABLE_NAME = "memories";

module.exports = {
  ERROR_MSG,
  TOKEN_LIMIT,
  RESPONSE_LIMIT,
  WARNING_BUFFER,
  MESSAGES_TABLE_NAME,
  MEMORIES_TABLE_NAME,
  MAX_OUTPUT_TOKENS,
  REMEMBER_MODEL,
  CHAT_MODEL,
  MAX_RETRY_COUNT,
  MAX_CAPABILITY_CALLS,
};
