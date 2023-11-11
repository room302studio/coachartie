const { Client, GatewayIntentBits, Events } = require("discord.js");
const {
  removeMentionFromMessage,
} = require("../helpers.js");
const { processMessageChain } = require("./chain.js");
const vision = require('./capabilities/vision.js');

const dotenv = require("dotenv");
dotenv.config();

let client;

function onClientReady(c) {
  console.log(`⭐️ Ready! Logged in as ${c.user.username}`);
  console.log("\n🌐 Connected servers and channels:");
  client.guilds.cache.forEach((guild) => {
    console.log(` - ${guild.name}`);
  });
}

function detectBotMentionOrChannel(message) {
  const botMentioned = message.mentions.has(client.user);
  const channelName = message.channel.name;
  const channelNameHasBot = channelName.includes("🤖");

  return !message.author.bot && (botMentioned || channelNameHasBot);
}

class DiscordBot {
  constructor() {
    this.bot = new Client({
      intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent,
        GatewayIntentBits.GuildMessageReactions,
      ],
    });
    this.bot.login(process.env.DISCORD_BOT_TOKEN);
    this.bot.on("ready", onClientReady);
    this.bot.on("messageCreate", this.onMessageCreate);

    client = this.bot;
  }

  /**
   * Sends a message to a specific channel.
   * @param {string} message - The message to be sent.
   * @param {object} channel - The channel where the message will be sent.
   */
  async sendMessage(message, channel) {
    try {
      await channel.send(message);
    } catch (error) {
      console.log(error);
    }
  }

  /**
   * Sends an embedded message to a specific channel.
   * @param {string} message - The message to be embedded and sent.
   * @param {object} channel - The channel where the message will be sent.
   */
  async sendEmbedMessage(message, channel) {
    try {
      await channel.send({ embeds: [message] });
    } catch (error) {
      console.log(error);
    }
  }

  /**
   * Processes the prompt from the message content.
   * @param {object} message - The message object containing the content.
   */
  async processPrompt(message) {
    const prompt = removeMentionFromMessage(message.content, "@coachartie");
    console.log(`✉️ Message received: ${prompt}`);
    return prompt;
  }

  /**
   * Processes the image attachment from the message and adds its description to the prompt.
   * @param {object} message - The message object containing the attachment.
   * @param {string} prompt - The prompt to which the image description will be added.
   */
  async processImageAttachment(message, prompt) {
    if (message.attachments.first()) {
      const imageUrl = message.attachments.first().url;
      vision.setup().imageUrl = imageUrl;
      await vision.setup().fetchImageDescription();
      const imageDescription = vision.setup().imageDescription;
      return `${prompt}\n\nDescription of user-provided image: ${imageDescription}`;
    } else {
      return prompt;
    }
  }

  /**
   * Processes the message chain with the given prompt and username.
   * @param {string} prompt - The prompt to be processed.
   * @param {string} username - The username of the message author.
   */
  async processMessageChain(prompt, username) {
    return await processMessageChain(
      [
        {
          role: "user",
          content: prompt,
        },
      ],
      username
    );
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

    

    let prompt = await this.processPrompt(message);
    let processedPrompt = await this.processImageAttachment(message, prompt);
    let messages = await this.processMessageChain(processedPrompt, message.author.username);

    

    // Check if the last message contains an image- if so send it as a file
    const lastMessage = messages[messages.length - 1];
    if (lastMessage.image) {
      // Send the image as an attachment
      message.channel.send({
        files: [{
          attachment: lastMessage.image,
          name: 'image.png'
        }]
      });
    } 
    
    if (lastMessage.content) {
      // Send the last message of the message chain back to the channel
      this.sendMessage(lastMessage.content, message.channel);
    }
  }

  /**
   * Handles the creation of a message, including displaying a typing indicator and responding to the message.
   * @param {object} message - The message to be created.
   */
  async onMessageCreate(message) {
    // Display typing indicator
    message.channel.startTyping();
    await this.respondToMessage(message);
    // Stop typing indicator
    message.channel.stopTyping();
  }
}

module.exports = DiscordBot;
