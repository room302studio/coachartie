/**
 * @file helpers-llm.js
 * @description Handles interactions with various LLM (Large Language Model) providers including OpenAI, Anthropic, and localhost instances.
 */

const OpenAI = require("openai");
const Anthropic = require("@anthropic-ai/sdk");
const axios = require("axios");
const logger = require("./src/logger.js")("helpers-llm");
const { getConfigFromSupabase } = require("./helpers-utility.js");
const { assembleMessagePreamble } = require("./helpers-prompt.js");
const { Chance } = require("chance");
const chance = new Chance();

const chatProviderModelOptions = {
  openai: ["gpt-4o", "gpt-3.5-turbo"],
  anthropic: [
    "claude-3-5-sonnet-20240620",
    "claude-3-sonnet-20240229",
    "claude-3-opus-20240229",
    "claude-3-haiku-20240307",
  ],
  localhost: ["lmstudio-community/Meta-Llama-3-8B-Instruct-GGUF"],
};

class LLMHelper {
  constructor() {
    this.providers = {
      openai: {
        initialize: () => new OpenAI({ apiKey: process.env.OPENAI_API_KEY }),
        createCompletion: async (client, config) => {
          config.model = chatProviderModelOptions.openai[0];
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
          config.model = chatProviderModelOptions.anthropic[0];

          config.messages = config.messages.map((msg) => {
            if (msg.role === "system") {
              return { ...msg, role: "user" };
            }
            return msg;
          });

          const formattedMessages = config.messages.reduce((acc, msg) => {
            if (acc.length === 0) {
              return [msg];
            }
            if (msg.role === "user") {
              const lastMsg = acc.pop();
              return [
                ...acc,
                { ...lastMsg, content: `${lastMsg.content}\n${msg.content}` },
              ];
            }
            return [...acc, msg];
          }, []);

          config.messages = formattedMessages.reduce((acc, msg) => {
            if (acc.length === 0) {
              return [msg];
            }
            if (msg.role === "assistant") {
              const lastMsg = acc.pop();
              return [
                ...acc,
                { ...lastMsg, content: `${lastMsg.content}\n${msg.content}` },
              ];
            }
            return [...acc, msg];
          }, []);

          delete config.presence_penalty;
          config.temperature = Math.min(1, Math.max(0, config.temperature));

          const res = await client.messages.create(config);
          logger.info(`Anthropic response: ${JSON.stringify(res)}`);
          return res;
        },
        normalizeCompletion: (completion) => ({
          content: completion.content[0].text,
          role: "assistant",
        }),
      },
      localhost: {
        initialize: () => null,
        createCompletion: async (client, config) => {
          config.model = chatProviderModelOptions.localhost[0];
          const endpoint = "http://localhost:1234/v1/chat/completions";

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

  /**
   * Retrieves the current LLM provider from the Supabase configuration.
   * @returns {Promise<string>} The name of the current LLM provider.
   */
  async getCurrentProvider() {
    const { CHAT_MODEL } = await getConfigFromSupabase();
    logger.info(`Current LLM provider from config: ${CHAT_MODEL}`);
    return CHAT_MODEL || "openai";
  }

  /**
   * Initializes the current LLM provider based on the configuration.
   * @returns {Promise<void>}
   * @throws {Error} If the provider is not supported.
   */
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

  /**
   * Creates a chat completion using the current LLM provider.
   * @param {Array<Object>} messages - An array of message objects for the conversation.
   * @param {Object} config - Configuration options for the LLM.
   * @returns {Promise<Object>} The normalized completion response from the LLM.
   * @throws {Error} If there is an issue creating the chat completion.
   */
  async createChatCompletion(messages, config = {}) {
    await this.initializeProvider();

    const defaultConfig = {
      model: config.memoryModel ? config.memoryModel : "gpt-3.5-turbo",
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

  /**
   * Generates random AI completion parameters.
   * @returns {Object} An object containing temperature, presence_penalty, and frequency_penalty values.
   */
  generateAiCompletionParams() {
    return {
      temperature: chance.floating({ min: 0, max: 1.2 }),
      presence_penalty: chance.floating({ min: -0.05, max: 0.1 }),
      frequency_penalty: chance.floating({ min: 0.0, max: 0.1 }),
    };
  }

  /**
   * Generates an AI completion based on the prompt, username, and messages provided.
   * @param {string} prompt - The prompt for the AI completion.
   * @param {string} username - The username associated with the messages.
   * @param {Array<Object>} messages - An array of message objects for the conversation.
   * @param {Object} config - Configuration options for the LLM.
   * @returns {Promise<Object>} An object containing the updated messages array and the AI response.
   * @throws {Error} If there is an issue generating the AI completion.
   */
  async generateAiCompletion(prompt, username, messages, config = {}) {
    let { temperature, presence_penalty } = config;

    if (!temperature) temperature = 1;
    if (!presence_penalty) presence_penalty = 0;

    if (messages[messages.length - 1].image) {
      delete messages[messages.length - 1].image;
    }

    logger.info(
      `The length of the messages before adding preamble, filtering, and transformation is: ${messages.length}.`
    );
    logger.info(
      `🤖 Generating AI completion for <${username}> from ${messages.length} messages: ${prompt}`
    );

    messages = await this.addPreambleToMessages(username, prompt, messages);

    messages = messages.filter((message) => message.content);

    logger.info(
      `The length of the messages after filtering but before transformation is: ${messages.length}.`
    );

    messages = messages.map((msg) => ({
      role: msg.role,
      content:
        typeof msg.content === "string"
          ? msg.content
          : JSON.stringify(msg.content),
    }));

    logger.info(
      `The final length of the messages after transformation is: ${messages.length}.`
    );

    try {
      logger.info(`🔧 Chat completion parameters:
  - Temperature: ${temperature}
  - Presence Penalty: ${presence_penalty}
 - Message Count: ${messages.length}.`);

      const completion = await this.createChatCompletion(messages, {
        temperature,
        presence_penalty,
      });

      logger.info(`🔧 Chat completion created:\n-${completion.content}`);

      const aiResponse = { role: completion.role, content: completion.content };
      messages.push(aiResponse);

      logger.info(
        `The length of the messages array after appending AI response is: ${messages.length}`
      );

      return { messages, aiResponse };
    } catch (err) {
      logger.error(`Error creating chat completion ${err}`);
      throw err;
    }
  }

  /**
   * Adds a preamble to the provided messages based on the username and prompt.
   * @param {string} username - The username associated with the messages.
   * @param {string} prompt - The prompt for the AI completion.
   * @param {Array<Object>} messages - An array of message objects for the conversation.
   * @returns {Promise<Array<Object>>} The messages array with the preamble added.
   */
  async addPreambleToMessages(username, prompt, messages) {
    const preamble = await assembleMessagePreamble(username, prompt, messages);
    return [...preamble, ...messages.flat()];
  }
}

module.exports = new LLMHelper();
