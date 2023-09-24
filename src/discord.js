// Our collection of ethereal tech tools and righteous scripts

// const { console.log, consolelog3, consolelog4 } = require("./logging");
const { Client, GatewayIntentBits, Events } = require("discord.js");
const { callCapabilityMethod, capabilityRegex } = require("./capabilities.js");
const {
  countMessageTokens,
  ERROR_MSG,
  removeMentionFromMessage,
  TOKEN_LIMIT,
  trimResponseIfNeeded,
} = require("../helpers.js");
const { processMessageChain } = require("./chain.js");

// 📜 prompts: our guidebook of conversational cues
const prompts = require("../prompts");
const {
  PROMPT_SYSTEM,
  PROMPT_REMEMBER,
  PROMPT_REMEMBER_INTRO,
  CAPABILITY_PROMPT_INTRO,
} = prompts;

// 🌿 dotenv: As graceful as a morning dew drop, simplifying process.env access since 2012!
const dotenv = require("dotenv");
dotenv.config();

// A whole heap of essential variables & functions ahead...
let client;

// 💫 Ready, set... wait! We let Discord know that we're ready to perform!
function onClientReady(c) {
  console.log(`⭐️ Ready! Logged in as ${c.user.username}`);
  console.log("\n🌐 Connected servers and channels:");
  client.guilds.cache.forEach((guild) => {
    console.log(` - ${guild.name}`);
  });
}

// 🤖 detectBotMentionOrChannel: Detecting if the bot was mentioned or if the channel name includes a bot
function detectBotMentionOrChannel(message) {
  const botMentioned = message.mentions.has(client.user);
  const channelName = message.channel.name;
  const channelNameHasBot = channelName.includes("🤖");

  return !message.author.bot && (botMentioned || channelNameHasBot);
}

// 🤖 Assembling the Discord bot client!
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

    // The sentient moment 🙌
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

  // 💌 onMessageCreate: Crucial, as life itself- translating gibberish to meaningful chats!
  async onMessageCreate(message) {
    // console.log("💌 Message seen:", message.content);
    // This function is run on every message received by the bot
    // Check if the bot was mentioned or if the channel name includes a bot
    const botMentioned = message.mentions.has(client.user);
    // const channelNameHasBot = detectBotMentionOrChannel(message);
    const botMentionOrChannel = detectBotMentionOrChannel(message);
    const channelNameHasBot = message.channel.name.includes("🤖");
    const messageAuthorIsBot = message.author.bot;
    const authorIsMe = message.author.username === "coachartie";

    if (!botMentionOrChannel) return;

    if (authorIsMe) {
      console.log("I'm talking to myself! 😳");
      return;
    }

    if (messageAuthorIsBot) {
      console.log("Another bot is trying to talk to me! 😡");
      return;
    }

    // Remove the bot mention from the message content
    const prompt = removeMentionFromMessage(message.content, "@coachartie");
    console.log(`✉️ Message received: ${prompt}`);

    // Process the message/prompt – this may mean repeatedly calling capabilities until the response is found or token limit is reached
    await processMessageChain(
      message,
      [
        {
          role: "user",
          content: prompt,
        },
      ],
      message.author.username
    );
  }
}

module.exports = DiscordBot;
