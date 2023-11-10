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

  async sendMessage(message, channel) {
    try {
      await channel.send(message);
    } catch (error) {
      console.log(error);
    }
  }

  async sendEmbedMessage(message, channel) {
    try {
      await channel.send({ embeds: [message] });
    } catch (error) {
      console.log(error);
    }
  }

  async onMessageCreate(message) {
    const botMentionOrChannel = detectBotMentionOrChannel(message);
    const messageAuthorIsBot = message.author.bot;
    const authorIsMe = message.author.username === "coachartie";

    if (!botMentionOrChannel || authorIsMe || messageAuthorIsBot) return;

    const prompt = removeMentionFromMessage(message.content, "@coachartie");
    console.log(`✉️ Message received: ${prompt}`);

    const thread = await message.startThread({
      name: "Processing...",
      autoArchiveDuration: 60,
    });
    const tempMessage = await thread.send('Processing...');
    
    let messages;
    if (message.attachments.first()) {
      const imageUrl = message.attachments.first().url;
      vision.setup().imageUrl = imageUrl;
      await vision.setup().fetchImageDescription();
      const imageDescription = vision.setup().imageDescription;
      messages = await processMessageChain(
        thread,
        [
          {
            role: "user",
            content: `${prompt}\n\nImage Description: ${imageDescription}`,
          },
        ],
        message.author.username
      );
    } else {
      messages = await processMessageChain(
        thread,
        [
          {
            role: "user",
            content: prompt,
          },
        ],
        message.author.username
      );
    }

    tempMessage.edit(messages[messages.length - 1])
  }
}

module.exports = DiscordBot;
