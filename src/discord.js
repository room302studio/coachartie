const { Client, GatewayIntentBits, Events } = require("discord.js");
const {
  removeMentionFromMessage,
  splitAndSendMessage,
  displayTypingIndicator,
} = require("../helpers.js");
const { processMessageChain } = require("./chain.js");
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
    this.bot.on("ready", onClientReady);
    this.bot.on("messageCreate", this.respondToMessage.bind(this)); // Bind the context of `this`

    client = this.bot;
  }

  /**
   * Responds to a message if it mentions the bot or is in a bot channel, and is not from the bot itself.
   * @param {object} message - The message to respond to.
   */
  async respondToMessage(message) {
    const botMentionOrChannel = detectBotMentionOrChannel(message);
    const messageAuthorIsBot = message.author.bot;
    const authorIsMe = message.author.username === "coachartie";
    if (!botMentionOrChannel || authorIsMe || messageAuthorIsBot) return;

    const typing = displayTypingIndicator(message);

    let prompt = await this.processPrompt(message);
    let processedPrompt = await this.processImageAttachment(message, prompt);

    const username = message.author.username;
    const guild = message.guild.name;

    // if a DM, we need the channel to be the actual discord channel object
    const isDM = !message.guild;
    const channel = isDM
      ? message.channel
      : this.fetchChannelById(message.channel.id);

    let messages = await processMessageChain(
      [
        {
          role: "user",
          content: processedPrompt,
        },
      ],
      {
        username,
        channel,
        guild,
        isDM,
      }
    );

    // Check if the last message contains an image- if so send it as a file
    const lastMessage = messages[messages.length - 1];

    // we need to make a better check of whether it is an image or not
    // if it is, we are going to be receiving a buffer from the processMessageChain function
    // if it isn't, it'll be a string
    // so we check if the last message is a buffer
    const lastMsgIsBuffer = lastMessage.image;

    if (lastMsgIsBuffer) {
      logger.info("last message is a buffer");
      // Send the image as an attachment
      // message.channel.send({
      //   files: [{
      //     attachment: lastMessage.image,
      //     name: 'image.png'
      //   }]
      // });
      // stop typing interval
      this.sendAttachment(lastMessage.image, channel);
    }

    if (lastMessage.content) {
      this.sendMessage(lastMessage.content, channel);
    }

    clearInterval(typing);
  }

  /**
   * Fetches a channel by its ID.
   *
   * @param {string} channelId - The ID of the channel to fetch.
   * @returns {Channel|null} - The fetched channel object, or null if not found.
   */
  fetchChannelById(channelId) {
    // Direct Messages have a different method to fetch channels
    if (channelId.startsWith("DM")) {
      return client.users.cache.get(channelId.replace("DM-", "")).createDM();
    }

    // For guild channels, iterate through the guilds as before
    let channelObj = null;
    client.guilds.cache.forEach((guild) => {
      const channel = guild.channels.cache.get(channelId);
      if (channel) {
        channelObj = channel;
      }
    });
    return channelObj;
  }

  /**
   * Sends a message to a specific channel.
   * @param {string} message - The message to be sent.
   * @param {object} channel - The Discord channel object where the message will be sent.
   */
  async sendMessage(message, channel) {
    logger.info(`Sending message: ${message}`);
    try {
      // await channel.send(message);
      splitAndSendMessage(message, channel);
    } catch (error) {
      logger.info(error);
    }
  }

  /**
   * Sends an attachment to a Discord channel.
   * @param {string} image - The path or URL of the image to send.
   * @param {Discord.Channel} channel - The Discord channel to send the attachment to.
   * @returns {Promise<void>} - A promise that resolves when the attachment is sent successfully.
   */
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

  /**
   * Processes the prompt from the message content.
   * @param {object} message - The message object containing the content.
   */
  async processPrompt(message) {
    const prompt = removeMentionFromMessage(message.content, "@coachartie");
    logger.info(`✉️ Message received: ${prompt}`);
    return prompt;
  }

  /**
   * Processes the image attachment from the message and adds its description to the prompt.
   * @param {object} message - The message object containing the attachment.
   * @param {string} prompt - The prompt to which the image description will be added.
   */
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
}

function onClientReady(c) {
  logger.info(`⭐️ Ready! Logged in as ${c.user.username}`);
  logger.info("\n🌐 Connected servers and channels:");
  client.guilds.cache.forEach((guild) => {
    logger.info(` - ${guild.name}`);
  });
}

function detectBotMentionOrChannel(message) {
  const botMentioned = message.mentions.has(client.user);
  const channelName = message.channel.name;
  const channelNameHasBot = channelName.includes("🤖");

  return !message.author.bot && (botMentioned || channelNameHasBot);
}

module.exports = DiscordBot;
