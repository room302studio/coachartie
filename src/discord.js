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
    // login to discord
    this.bot.login(process.env.DISCORD_BOT_TOKEN);
    // log that the bot is ready
    this.bot.on("ready", onClientReady);
    this.bot.on("messageCreate", this.onMessageCreate.bind(this)); // Bind the context of `this`

    // log the supabase config once
    getConfigFromSupabase().then((config) => {
      logger.info(`Supabase config: ${JSON.stringify(config)}`);
    });

    client = this.bot;
  }

  /**
   * Processes the message chain with the given prompt and username.
   * @param {string} prompt - The prompt to be processed.
   * @param {string} username - The username of the message author.
   */
  async processMessageChain(
    prompt,
    { username, channel, guild, related_message_id }
  ) {
    const { processMessageChain } = await require("./chain.js");
    return await processMessageChain(
      [
        {
          role: "user",
          content: prompt,
        },
      ],
      { username, channel, guild, related_message_id }
    );
  }

  /**
   * Sends a message to a specific channel.
   * @param {string} message - The message to be sent.
   * @param {object} channel - The Discord channel object where the message will be sent.
   */
  async sendMessage(messageObject, channel) {
    const message = messageObject.content;
    logger.info(`Sending message: ${message}`);
    try {
      splitAndSendMessage(message, channel);
    } catch (error) {
      logger.error(`${error} on ${JSON.stringify(message)}`);
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
    // const prompt = removeMentionFromMessage(message.content, "@coachartie");
    // const prompt = replaceStringWithId(message.content, "<@!879978978>", "@coachartie");
    // the message might look like `<@1086489885269037128> what's up`
    // and it should just be
    // what's up
    const prompt = removeMentionFromMessage(message.content, client.user.id);
    logger.info(`✉️ Message received: ${prompt}`);
    return prompt;
  }

  /**
   * Processes the image attachment from the message and adds its description to the prompt using the vision API
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

  /**
   * Responds to a message if it mentions the bot or is in a bot channel, and is not from the bot itself.
   * @param {object} message - The message to respond to.
   */
  async respondToMessage(message) {
    // Check if the message mentions the bot or is in a bot channel
    const botMentionOrChannel = detectBotMentionOrChannel(message);
    // Check if the message author is a bot
    const messageAuthorIsBot = message.author.bot;
    // Check if the message author is the bot itself
    // TODO: This should come from the config and not be hardcoded
    const authorIsMe = message.author.username === "coachartie";

    // Don't respond to messages from the bot itself
    // otherwise we get an infinite loop and use all our credits
    if (authorIsMe) return;

    // get the prompt from the message and remove any mentions of the bot from it
    let prompt = await this.processPrompt(message);

    // process the image attachment and add its description to the prompt
    let processedPrompt = await this.processImageAttachment(message, prompt);

    // get some info about the message
    const username = message.author.username;
    const guild = message.guild.name;
    const messageId = message.id;

    // we need the channel to be the actual discord channel object
    // so we can send messages to it
    // if there isn't a guild, it's a DM
    const isDM = !message.guild;

    // if it's a DM, we will get the channel name from the author's ID
    // otherwise we will get the channel name from the channel object
    const channel = isDM
      ? message.channel.name
      : this.fetchChannelById(message.channel.id).name;

    // if it's a DM, mark the channel name as DM
    const channelName = isDM ? `DM-${message.author.id}` : message.channel.id;

    // get the channel object
    // TODO: I don't understand why we call this twice
    const channelObj = this.fetchChannelById(channelName);

    // Determine if the bot should respond to the message
    let shouldRespond = false;
    if (botMentionOrChannel) {
      shouldRespond = true;
    } else if (!authorIsMe) {
      shouldRespond = false;
    } else if (!messageAuthorIsBot) {
      shouldRespond = false;
    }

    // log the "math" that goes into shouldRespond
    logger.info(
      `Determining whether to respond: ${JSON.stringify({
        botMentionOrChannel,
        messageAuthorIsBot,
        authorIsMe,
      })} -- responding: ${shouldRespond}`
    );

    // only show typing indicator if we are going to respond
    const typing = shouldRespond ? displayTypingIndicator(message) : null;

    // log the message content
    logger.info(
      `${guild} 📩 #${channelName} <${
        message.author.username
      }> Message received: ${message.content} ${
        messageAuthorIsBot ? "🤖" : "🧑"
      } ${botMentionOrChannel ? "📣" : "🦻"} - ${
        shouldRespond ? "Responding" : "Not Responding"
      }`
    );

    // check if the message has an embed or not
    const msgEmbed = message.embeds.length > 0 ? message.embeds[0] : null;
    logger.info(`Message embed: ${JSON.stringify(msgEmbed)}`);

    // TODO: add channelName- make it easier to understand what the var is and how it is meant to be used- some places expect an object, like splitAndSendMessage, and other things expect a name string, like the memory saving

    // create the messages array
    // by processing the text from the user message
    // this forms a memory but does not send any messages
    // it just returns the updated messages array
    let messages = await this.processMessageChain(processedPrompt, {
      username,
      channel,
      guild,
      related_message_id: messageId,
    });

    // and if we're not responding, we don't need to do anything else
    if (!shouldRespond) return;

    // Check if the last message contains an image- if so send it as a file
    const lastMessage = messages[messages.length - 1];

    // we need to make a better check of whether it is an image or not
    // if it is, we are going to be receiving a buffer from the processMessageChain function
    // if it isn't, it'll be a string
    // so we check if the last message is a buffer
    // if it is, we send it to the channel as an attachment
    if (lastMessage.image) {
      await this.sendAttachment(lastMessage.image, channelObj);
      logger.info("📤 Sent image as attachment");
    }

    // if the last message is a string, we send it as a message
    if (lastMessage.content) {
      this.sendMessage(lastMessage.content, channelObj);
    }

    // and stop the typing indicator
    clearInterval(typing);
  }

  /**
   * Handles the creation of a message, including displaying a typing indicator and responding to the message.
   * TODO: Should this even exist? It's just a wrapper around respondToMessage
   * @param {object} message - The message to be created.
   */
  async onMessageCreate(message) {
    await this.respondToMessage(message);
  }

  /**
   * Fetches a channel by its ID.
   * @param {string} channelId - The ID of the channel to fetch.
   * @returns {Channel|null} - The fetched channel object, or null if not found.
   */
  fetchChannelById(channelId) {
    // Direct Messages have a different method to fetch channels
    if (channelId.startsWith("DM")) {
      logger.info(`Fetching DM channel: ${channelId}`);
      // Not sure if createDM is the right method to use here
      // or what this even returns tbh
      // it should be a "channel" object
      return client.users.cache.get(channelId.replace("DM-", "")).createDM();
    }

    //
    let channelObj = null;
    // loop through all the guilds the bot is in
    client.guilds.cache.forEach((guild) => {
      const channel = guild.channels.cache.get(channelId);
      // if we find the channel, set it to the channelObj
      if (channel) {
        channelObj = channel;
      }
    });
    return channelObj;
  }
}

function onClientReady(c) {
  logger.info(`⭐️ Ready! Logged in as ${c.user.username}`);
  // logger.info("\n🌐 Connected servers and channels:");
  // client.guilds.cache.forEach((guild) => {
  //   logger.info(` - ${guild.name}`);
  // });
}

function detectBotMentionOrChannel(message) {
  const botMentioned = message.mentions.has(client.user);
  const channelName = message.channel.name;
  const channelNameHasBot = channelName.includes("🤖");

  return !message.author.bot && (botMentioned || channelNameHasBot);
}

module.exports = DiscordBot;
