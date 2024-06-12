// helpers-llm.js
const { openai } = require("./src/openai");
const Anthropic = require("@anthropic-ai/sdk");
const anthropic = new Anthropic();
const logger = require("./src/logger.js")("helpers-llm");
const { getConfigFromSupabase } = require("./helpers-utility.js");
const { assembleMessagePreamble } = require("./helpers-prompt.js");
const { Chance } = require("chance");
const chance = new Chance();

async function createChatCompletion(messages, config = {}) {
  const defaultConfig = {
    temperature: 0.5,
    presence_penalty: 0,
    max_tokens: 800,
  };

  config = Object.assign({}, defaultConfig, config);

  const { CHAT_MODEL, CLAUDE_COMPLETION_MODEL, OPENAI_COMPLETION_MODEL } =
    await getConfigFromSupabase();
  const completionModel = CHAT_MODEL || "openai";

  if (completionModel === "openai") {
    return createOpenAICompletion(messages, config, OPENAI_COMPLETION_MODEL);
  } else if (completionModel === "claude") {
    return createClaudeCompletion(messages, config, CLAUDE_COMPLETION_MODEL);
  } else {
    throw new Error(`Unsupported chat model: ${completionModel}`);
  }
}

/**
 * Generates parameters for AI completion.
 * @returns {object} - The generated parameters.
 */
function generateAiCompletionParams() {
  return {
    temperature: generateTemperature(),
    presence_penalty: generatePresencePenalty(),
    frequency_penalty: generateFrequencyPenalty(),
  };
}

/**
 * Generates a temperature value.
 * @returns {number} - The generated temperature value.
 */
function generateTemperature() {
  return chance.floating({ min: 0.88, max: 1.2 });
}

/**
 * Generates a presence penalty value.
 * @returns {number} - The generated presence penalty value.
 */
function generatePresencePenalty() {
  return chance.floating({ min: -0.05, max: 0.1 });
}

/**
 * Generates a frequency penalty value.
 * @returns {number} - The generated frequency penalty value.
 */
function generateFrequencyPenalty() {
  return chance.floating({ min: 0.0, max: 0.1 });
}

async function createOpenAICompletion(messages, config, model) {
  console.info(
    `Using OpenAI for chat completion\nModel: ${model}\nTemperature: ${config.temperature}\nPresence Penalty: ${config.presence_penalty}\nMax Tokens: ${config.max_tokens}\nMessage Count: ${messages.length}`
  );

  try {
    console.info(
      `Creating OpenAI chat completion with ${messages.length} messages`
    );
    const res = await openai.chat.completions.create({
      model,
      temperature: config.temperature,
      presence_penalty: config.presence_penalty,
      max_tokens: config.max_tokens,
      messages,
    });

    const promptTokens = res.usage.prompt_tokens;
    const completionTokens = res.usage.completion_tokens;
    const totalTokens = res.usage.total_tokens;
    logger.info(
      `Completion used ${totalTokens} tokens (${promptTokens} prompt tokens, ${completionTokens} completion tokens)`
    );

    if (res.choices && res.choices.length > 0) {
      const completion = res.choices[0].message.content;
      if (completion) {
        console.info(`Chat completion response: ${completion}`);
        return completion;
      } else {
        console.info(
          `Chat completion response is missing content: ${JSON.stringify(res)}`
        );
        return null;
      }
    } else {
      console.info(
        `Chat completion response is missing choices: ${JSON.stringify(res)}`
      );
      return null;
    }
  } catch (error) {
    console.error("Error creating chat completion:", error.message);
    throw new Error(`Error creating chat completion: ${error.message}`);
  }
}

async function createClaudeCompletion(messages, config, model) {
  const xmlMessages = convertMessagesToXML(messages);

  const claudeCompletion = await anthropic.messages.create({
    model,
    max_tokens: config.max_tokens,
    messages: [{ role: "user", content: xmlMessages }],
  });

  return claudeCompletion.content[0].text;
}

function convertMessagesToXML(messages) {
  const options = { compact: true, ignoreComment: true, spaces: 4 };
  const messagesObj = { messages: { message: messages } };
  const xml = convert.js2xml(messagesObj, options);
  return xml;
}

/**
 * Adds a preamble to an array of messages.
 * @param {string} username - The username.
 * @param {string} prompt - The prompt.
 * @param {Array<Array<string>>} messages - The array of messages.
 * @returns {Array<string>} - The array of messages with the preamble added.
 */
async function addPreambleToMessages(username, prompt, messages) {
  // logger.info(`🔧 Adding preamble to messages for <${username}> ${prompt}`);
  const preamble = await assembleMessagePreamble(username, prompt);
  return [...preamble, ...messages.flat()];
}

async function generateAiCompletion(prompt, username, messages, config) {
  let { temperature, presence_penalty } = config;

  if (!temperature) temperature = 1;
  if (!presence_penalty) presence_penalty = 0;

  if (messages[messages.length - 1].image)
    delete messages[messages.length - 1].image;

  logger.info(`🤖 Generating AI completion for <${username}> ${prompt}`);
  logger.info(`${messages.length} messages`);

  messages = await addPreambleToMessages(username, prompt, messages);

  let completion = null;

  messages = messages.filter((message) => message.content);

  try {
    logger.info(`🔧 Chat completion parameters:
    - Temperature: ${temperature}
    - Presence Penalty: ${presence_penalty}`);
    logger.info("🔧 Messages:");

    // Log all message contents
    // extremely verbose
    // messages.forEach((message, index) =>
    //   logger.info(`- Message ${index + 1}: ${JSON.stringify(message)}`)
    // );

    logger.info(`Creating chat completion with ${messages.length} messages`);

    completion = await createChatCompletion(
      messages,
      temperature,
      presence_penalty
    );

    logger.info(`🔧 Chat completion created:\n- Completion: ${completion}`);
  } catch (err) {
    logger.error(`Error creating chat completion ${err}`);
  }

  const aiResponse = completion;

  messages.push(aiResponse);
  return { messages, aiResponse };
}

module.exports = {
  createChatCompletion,
  generateAiCompletionParams,
  generateAiCompletion,
};
