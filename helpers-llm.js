// helpers-llm.js
const OpenAI = require("openai");
const Anthropic = require("@anthropic-ai/sdk");
const axios = require("axios");
const logger = require("./src/logger.js")("helpers-llm");
const { getConfigFromSupabase } = require("./helpers-utility.js");
const { assembleMessagePreamble } = require("./helpers-prompt.js");
const { Chance } = require("chance");
const chance = new Chance();

class LLMHelper {
  constructor() {
    this.providers = {
      openai: {
        initialize: () => new OpenAI({ apiKey: process.env.OPENAI_API_KEY }),
        createCompletion: async (client, config) => {
          const res = await client.chat.completions.create(config);
          return res;
        },
        normalizeCompletion: (completion) => ({
          content: completion.choices[0].message.content,
          role: completion.choices[0].message.role,
        }),
      },
      anthropic: {
        initialize: () =>
          new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY }),
        createCompletion: async (client, config) => {
          const res = await client.messages.create(config);
          return res;
        },
        normalizeCompletion: (completion) => ({
          content: completion.content[0].text,
          role: "assistant", // Anthropic doesn't provide roles, so we assume it's always the assistant
        }),
      },
      localhost: {
        initialize: () => null,
        createCompletion: async (client, config) => {
          const endpoint = "http://localhost:1234/v1/chat/completions";
          // Ensure messages are in the correct format
          const formattedMessages = config.messages.map((msg) => ({
            role: msg.role,
            content:
              typeof msg.content === "string"
                ? msg.content
                : JSON.stringify(msg.content),
          }));
          const response = await axios.post(endpoint, {
            ...config,
            messages: formattedMessages,
          });
          return response.data;
        },
        normalizeCompletion: (completion) => ({
          content: completion.choices[0].message.content,
          role: completion.choices[0].message.role,
        }),
      },
    };
    this.currentProvider = null;
    this.currentClient = null;
  }

  async getCurrentProvider() {
    const { CHAT_MODEL } = await getConfigFromSupabase();
    logger.info(`Current LLM provider from config: ${CHAT_MODEL}`);
    return CHAT_MODEL || "openai";
  }

  async initializeProvider() {
    const providerName = await this.getCurrentProvider();
    if (providerName !== this.currentProvider) {
      const provider = this.providers[providerName];
      if (!provider) {
        throw new Error(`Unsupported LLM provider: ${providerName}`);
      }
      this.currentProvider = providerName;
      this.currentClient = provider.initialize();
    }
  }

  async createChatCompletion(messages, config = {}) {
    await this.initializeProvider();

    const defaultConfig = {
      model: "gpt-3.5-turbo",
      temperature: 0.5,
      presence_penalty: 0,
      max_tokens: 800,
    };

    config = { ...defaultConfig, ...config, messages };

    try {
      logger.info(`Creating chat completion with ${this.currentProvider}`);
      const rawCompletion = await this.providers[
        this.currentProvider
      ].createCompletion(this.currentClient, config);
      const normalizedCompletion =
        this.providers[this.currentProvider].normalizeCompletion(rawCompletion);
      logger.info(`Chat completion created successfully`);
      return normalizedCompletion;
    } catch (error) {
      logger.error(
        `Error creating chat completion with ${this.currentProvider}: ${error.message}`
      );
      throw error;
    }
  }

  generateAiCompletionParams() {
    return {
      temperature: chance.floating({ min: 0, max: 1.2 }),
      presence_penalty: chance.floating({ min: -0.05, max: 0.1 }),
      frequency_penalty: chance.floating({ min: 0.0, max: 0.1 }),
    };
  }

  lastUserMessage(messagesArray) {
    return messagesArray.find((m) => m.role === "user").content;
  }

  async generateAiCompletion(prompt, username, messages, config = {}) {
    let { temperature, presence_penalty } = config;

    if (!temperature) temperature = 1;
    if (!presence_penalty) presence_penalty = 0;

    if (messages[messages.length - 1].image)
      delete messages[messages.length - 1].image;

    logger.info(
      `🤖 Generating AI completion for <${username}> from ${messages.length} messages: ${prompt}`
    );

    messages = await this.addPreambleToMessages(username, prompt, messages);

    messages = messages.filter((message) => message.content);

    // Format messages
    messages = messages.map((msg) => ({
      role: msg.role,
      content:
        typeof msg.content === "string"
          ? msg.content
          : JSON.stringify(msg.content),
    }));

    try {
      logger.info(`🔧 Chat completion parameters:
  - Temperature: ${temperature}
  - Presence Penalty: ${presence_penalty}
  - Message Count: ${messages.length}`);

      const completion = await this.createChatCompletion(messages, {
        temperature,
        presence_penalty,
      });

      logger.info(`🔧 Chat completion created:\n-${completion.content}`);

      const aiResponse = { role: completion.role, content: completion.content };
      messages.push(aiResponse);

      return { messages, aiResponse };
    } catch (err) {
      logger.error(`Error creating chat completion ${err}`);
      throw err;
    }
  }

  async addPreambleToMessages(username, prompt, messages) {
    const preamble = await assembleMessagePreamble(username, prompt, messages);
    return [...preamble, ...messages.flat()];
  }
}

module.exports = new LLMHelper();
