// helpers-llm.js
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
          // set the proper anthropic top-level model
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
          // set the proper anthropic top-level model
          config.model = chatProviderModelOptions.anthropic[0];

          // we gotta go thru all the messages and if the role is system, we change the role to user
          // anthropic doesn't do more than just the initial system message

          config.messages = config.messages.map((msg) => {
            if (msg.role === "system") {
              return { ...msg, role: "user" };
            }
            return msg;
          });

          // anthropic also hates multiple user messages in a row
          // so if we find any sequential user messages
          // we concat them with a newline

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

          config.messages = formattedMessages;

          // they also hate multiple ASSISTANT messages in a row
          // so we concat them with a newline
          config.messages = config.messages.reduce((acc, msg) => {
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

          // anthropic also hates having presence_penalty in the config
          // delete that
          delete config.presence_penalty;

          // anthropic also requires temperature to be between 0 and 1
          // so we clamp it
          config.temperature = Math.min(1, Math.max(0, config.temperature));

          const res = await client.messages.create(config);
          console.log(`Anthropic response: ${JSON.stringify(res)}`);
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
          // set the proper anthropic top-level model
          config.model = chatProviderModelOptions.localhost[0];
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
