const ERROR_MSG = `I am so sorry, there was some sort of problem. Feel free to ask me again, or try again later.`;
const TOKEN_LIMIT = 14000;
const RESPONSE_LIMIT = 5120;
const WARNING_BUFFER = 1024;

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
};

