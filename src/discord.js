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
        GatewayIntentBits.MessageContent,
      ],
    });
    this.bot.login(process.env.DISCORD_BOT_TOKEN);
    this.bot.on("ready", this.onClientReady);
    this.bot.on("messageCreate", this.onMessageCreate.bind(this));

    getConfigFromSupabase().then((config) => {
      logger.info(`Supabase config: ${JSON.stringify(config)}`);
    });

    client = this.bot;
  }

  onClientReady(c) {
    logger.info(`⭐️ Ready! Logged in as ${c.user.username}`);
  }

  async onMessageCreate(message) {
    await this.respondToMessage(message);
  }

  async respondToMessage(message) {
    try {
      if (this.isMessageFromSelf(message)) {
        logger.info("Message is from the bot itself, not responding");
        return;
      }

      const shouldRespond = this.shouldRespondToMessage(message);
      if (!shouldRespond) {
        logger.info("Not responding to this message");
        return;
      }

      logger.info("Starting to process message...");
      const processedPrompt = await this.processMessageContent(message);
      const messageContext = this.getMessageContext(message);

      this.logMessageDetails(messageContext, processedPrompt);

      const typing = displayTypingIndicator(message);

      logger.info("Calling processMessageChain...");
      const { messages, finalContent } = await this.processMessageChain(
        processedPrompt,
        messageContext
      );
      logger.info("processMessageChain completed");

      await this.handleResponse(finalContent, messageContext.channelObj);
    } catch (error) {
      logger.error(
        `Error in respondToMessage: ${error.message}\nStack: ${error.stack}`
      );
    } finally {
      logger.info("Response process completed");
    }
  }
  isMessageFromSelf(message) {
    return message.author.username === "coachartie";
  }

  shouldRespondToMessage(message) {
    const botMentionOrChannel = this.detectBotMentionOrChannel(message);
    const messageAuthorIsBot = message.author.bot;

    let shouldRespond = botMentionOrChannel && !messageAuthorIsBot;

    logger.info(
      `Determining whether to respond: ${JSON.stringify({
        botMentionOrChannel,
        messageAuthorIsBot,
      })} -- responding: ${shouldRespond}`
    );

    return shouldRespond;
  }

  detectBotMentionOrChannel(message) {
    const botMentioned = message.mentions.has(client.user);
    const channelName = message.channel.name;
    const channelNameHasBot = channelName.includes("🤖");

    return !message.author.bot && (botMentioned || channelNameHasBot);
  }

  async processMessageContent(message) {
    let prompt = await this.processPrompt(message);
    logger.info(`Processed prompt: ${prompt}`);

    let processedPrompt = await this.processImageAttachment(message, prompt);
    logger.info(`Processed prompt with image (if any): ${processedPrompt}`);

    return processedPrompt;
  }

  async processPrompt(message) {
    const prompt = removeMentionFromMessage(message.content, client.user.id);
    logger.info(`✉️ Message received: ${prompt}`);
    return prompt;
  }

  async processImageAttachment(message, prompt) {
    if (!message.attachments) {
      return prompt;
    }
    if (message.attachments.first()) {
      const imageUrl = message.attachments.first().url;
      logger.info(imageUrl);
      vision.setImageUrl(imageUrl);
      const imageDescription = await vision.fetchImageDescription();
      return `${prompt}\n\nDescription of user-provided image: ${imageDescription}`;
    } else {
      return prompt;
    }
  }

  getMessageContext(message) {
    const username = message.author.username;
    const guild = message.guild ? message.guild.name : "DM";
    const messageId = message.id;
    const isDM = !message.guild;
    const channelId = message.channel.id;
    const channelName = isDM ? `DM-${message.author.id}` : channelId;
    const channelObj = this.fetchChannelById(channelId);
    const embeds = message.embeds;

    return {
      username,
      channel: channelObj,
      channelName,
      guild,
      related_message_id: messageId,
      channelObj,
      embeds,
    };
  }

  logMessageDetails(context, prompt) {
    const { guild, channelName, username, embeds } = context;

    logger.info(
      `${guild} 📩 #${channelName} <${username}> Message received: ${prompt}`
    );

    if (embeds && embeds.length > 0) {
      logger.info(`Message embeds: ${JSON.stringify(embeds)}`);
    }
  }

  async processMessageChain(prompt, context) {
    const { processMessageChain } = await require("./chain.js");
    const { username, channel, guild, related_message_id, embeds } = context;

    logger.info(
      `Processing message chain with arguments: ${JSON.stringify({
        prompt,
        username,
        channel: channel.id,
        guild,
        related_message_id,
        embedCount: embeds.length,
      })}`
    );

    return await processMessageChain(
      [
        {
          role: "user",
          content: prompt,
          embeds: embeds,
        },
      ],
      {
        username,
        channel: this.fetchChannelById(channel.id),
        guild,
        related_message_id,
      }
    );
  }

  async handleResponse(finalContent, channelObj) {
    if (!finalContent) {
      logger.error("No final content to send");
      return;
    }

    logger.info(
      `Preparing to send response. finalContent: ${JSON.stringify(
        finalContent
      )}`
    );

    if (typeof finalContent === "object" && finalContent.image) {
      await this.sendImageResponse(finalContent, channelObj);
    } else if (
      typeof finalContent === "string" ||
      (typeof finalContent === "object" && finalContent.content)
    ) {
      await this.sendTextResponse(finalContent, channelObj);
    } else {
      logger.error("Unexpected finalContent format", finalContent);
    }
  }

  async sendImageResponse(finalContent, channelObj) {
    logger.info("Sending image attachment...");
    await this.sendAttachment(finalContent.image, channelObj);
    logger.info("📤 Sent image as attachment");

    if (finalContent.content) {
      logger.info("Sending text content along with image...");
      await this.sendMessage({ content: finalContent.content }, channelObj);
      logger.info("📤 Sent text content along with image");
    }
  }

  async sendTextResponse(finalContent, channelObj) {
    const content =
      typeof finalContent === "string" ? finalContent : finalContent.content;
    logger.info("Sending text response...");
    await this.sendMessage({ content }, channelObj);
    logger.info("📤 Sent text response");
  }

  async sendMessage(message, channel) {
    logger.info(`Sending message: ${JSON.stringify(message)}`);
    try {
      if (typeof message === "string") {
        await splitAndSendMessage(message, channel);
      } else if (typeof message === "object" && message.content) {
        await splitAndSendMessage(message.content, channel);
      } else {
        logger.error(`Invalid message format: ${JSON.stringify(message)}`);
        return;
      }
      logger.info("📤 Message sent successfully");
    } catch (error) {
      logger.error(`Error sending message: ${error}`, message);
    }
  }

  async sendAttachment(image, channel) {
    try {
      await channel.send({
        files: [
          {
            attachment: image,
            name: "image.png",
          },
        ],
      });
    } catch (error) {
      logger.info(error);
    }
  }

  fetchChannelById(channelId) {
    if (channelId.startsWith("DM")) {
      logger.info(`Fetching DM channel: ${channelId}`);
      return client.users.cache.get(channelId.replace("DM-", "")).createDM();
    }

    let channelObj = null;
    client.guilds.cache.forEach((guild) => {
      const channel = guild.channels.cache.get(channelId);
      if (channel) {
        channelObj = channel;
      }
    });
    return channelObj;
  }
}

module.exports = DiscordBot;
