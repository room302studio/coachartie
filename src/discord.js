const { Client, GatewayIntentBits, Events } = require("discord.js");
const {
  removeMentionFromMessage,
  splitAndSendMessage,
  displayTypingIndicator,
  getConfigFromSupabase,
} = require("../helpers.js");

const vision = require("./vision.js");
const createLogger = require("./logger.js");
const logger = createLogger("discord");

const dotenv = require("dotenv");
dotenv.config();

let client;

class DiscordBot {
  constructor() {
    this.bot = new Client({
      intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent,
        GatewayIntentBits.GuildMessageReactions,
        GatewayIntentBits.DirectMessages,
      ],
    });
    this.bot.login(process.env.DISCORD_BOT_TOKEN);
    this.bot.on("ready", this.onClientReady.bind(this));
    this.bot.on("messageCreate", this.onMessageCreate.bind(this));

    client = this.bot;
  }

  onClientReady() {
    logger.info(`⭐️ Ready! Logged in as ${this.bot.user.username}`);
  }

  async onMessageCreate(message) {
    try {
      logger.info(`📩 Message received: ${message.content}`);

      if (message.author.bot) {
        logger.info("Ignoring message from bot.");
        return;
      }

      const shouldRespond = this.detectBotMentionOrChannel(message);
      logger.info(`Should respond: ${shouldRespond}`);
      if (!shouldRespond) {
        logger.info("Not responding to message.");
        return;
      }

      logger.info("Displaying typing indicator...");
      const typing = displayTypingIndicator(message);

      const prompt = await this.processPrompt(message);
      const processedPrompt = await this.processImageAttachment(
        message,
        prompt
      );

      logger.info(`Processing message: ${processedPrompt}`);

      const result = await this.processMessageChain(processedPrompt, {
        username: message.author.username,
        channel: message.channel,
        guild: message.guild?.name,
        related_message_id: message.id,
        sendMessage: (text) => this.sendMessage(text, message.channel),
        sendImage: (image) => this.sendAttachment(image, message.channel),
      });

      logger.info(`Message chain result: ${JSON.stringify(result)}`);

      if (result.image) {
        logger.info("Sending image attachment.");
        await this.sendAttachment(result.image, message.channel);
      } else if (result.content) {
        logger.info("Sending text message.");
        await this.sendMessage(result.content, message.channel);
      }

      clearInterval(typing);
    } catch (error) {
      logger.error(`Error processing message: ${error}`);
      await this.sendMessage(
        "I'm sorry, but an error occurred while processing your request.",
        message.channel
      );
    }
  }

  async processMessageChain(prompt, options) {
    const { processMessageChain } = await require("./chain.js");
    const initialMessage = { role: "user", content: prompt };
    return await processMessageChain([initialMessage], options);
  }

  async sendMessage(message, channel) {
    logger.info(`Sending message: ${message}`);
    try {
      await splitAndSendMessage(message, channel);
    } catch (error) {
      logger.error(`Error sending message: ${error}`);
    }
  }

  async sendAttachment(image, channel) {
    logger.info("Sending attachment...");
    try {
      await channel.send({
        files: [{ attachment: image, name: "image.png" }],
      });
    } catch (error) {
      logger.error(`Error sending attachment: ${error}`);
    }
  }

  async processPrompt(message) {
    logger.info("Processing prompt...");
    return removeMentionFromMessage(message.content, client.user.id);
  }

  async processImageAttachment(message, prompt) {
    logger.info("Processing image attachment...");
    if (message.attachments.size > 0) {
      const imageUrl = message.attachments.first().url;
      vision.setImageUrl(imageUrl);
      const imageDescription = await vision.fetchImageDescription();
      return `${prompt}\n\nDescription of user-provided image: ${imageDescription}`;
    }
    return prompt;
  }

  detectBotMentionOrChannel(message) {
    logger.info("Detecting bot mention or bot channel...");
    const botMentioned = message.mentions.has(client.user);
    const channelNameHasBot = message.channel.name.includes("🤖");
    return botMentioned || channelNameHasBot;
  }
}

module.exports = DiscordBot;
