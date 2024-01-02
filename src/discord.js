const { Client, GatewayIntentBits, Events } = require("discord.js");
const {
  removeMentionFromMessage,
  splitAndSendMessage,
  displayTypingIndicator,
} = require("../helpers.js");
const { processMessageChain } = require("./chain.js");
const vision = require("./vision.js");

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
      ],
    });
    this.bot.login(process.env.DISCORD_BOT_TOKEN);
    this.bot.on("ready", onClientReady);
    // this.bot.on("messageCreate", this.onMessageCreate);
    this.bot.on("messageCreate", this.onMessageCreate.bind(this)); // Bind the context of `this`

    client = this.bot;
  }

  /**
   * Sends a message to a specific channel.
   * @param {string} message - The message to be sent.
   * @param {object} channel - The channel where the message will be sent.
   */
  async sendMessage(message, channel) {
    try {
      // await channel.send(message);
      splitAndSendMessage(message, channel);
    } catch (error) {
      console.log(error);
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
    if (!message.attachments) {
      return prompt;
    }
    if (message.attachments.first()) {
      const imageUrl = message.attachments.first().url;
      console.log(imageUrl);
      vision.setImageUrl(imageUrl);
      const imageDescription = await vision.fetchImageDescription();
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
  async processMessageChain(prompt, 
    {username, channel, guild}, message) {
    return await processMessageChain(
      [
        {
          role: "user",
          content: prompt,
        },
      ],
      {username, channel, guild},
      message,
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

    const typing = displayTypingIndicator(message);

    let prompt = await this.processPrompt(message);
    let processedPrompt = await this.processImageAttachment(message, prompt);

    const username = message.author.username
    const channel = message.channel.name;
    const guild = message.guild.name;

    let messages = await this.processMessageChain(
      processedPrompt,
      {username, channel, guild},
      message,
    );

    // Check if the last message contains an image- if so send it as a file
    const lastMessage = messages[messages.length - 1];

    // we need to make a better check of whether it is an image or not
    // if it is, we are going to be receiving a buffer from the processMessageChain function
    // if it isn't, it'll be a string
    // so we check if the last message is a buffer
    const lastMsgIsBuffer = lastMessage.image;

    if (lastMsgIsBuffer) {
      console.log("last message is a buffer");
      // Send the image as an attachment
      // message.channel.send({
      //   files: [{
      //     attachment: lastMessage.image,
      //     name: 'image.png'
      //   }]
      // });
      // stop typing interval
      this.sendAttachment(lastMessage.image, message.channel);
    }

    if (lastMessage.content) {
      this.sendMessage(lastMessage.content, message.channel);
    }

    clearInterval(typing);
  }

  /**
   * Handles the creation of a message, including displaying a typing indicator and responding to the message.
   * @param {object} message - The message to be created.
   */
  async onMessageCreate(message) {
    // Display typing indicator
    // message.channel.sendTyping();
    await this.respondToMessage(message);
    // Stop typing indicator
    // message.channel.stopTyping();
  }
}

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

module.exports = DiscordBot;
