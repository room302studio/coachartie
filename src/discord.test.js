const { Client, GatewayIntentBits } = require("discord.js");
const { expect } = require("chai");
const DiscordBot = require("./discord.js");
const sinon = require("sinon");

jest.mock("discord.js", () => {
  return {
    Client: jest.fn().mockImplementation(() => {
      return {
        login: jest.fn(),
        on: jest.fn(),
      };
    }),
    GatewayIntentBits: {
      Guilds: "Guilds",
      GuildMessages: "GuildMessages",
      MessageContent: "MessageContent",
      GuildMessageReactions: "GuildMessageReactions",
    },
  };
});

describe("Discord Bot", () => {
  let bot;
  let message;

  beforeEach(() => {
    bot = new DiscordBot();
    message = {
      content: "",
      author: { bot: false, username: "test-user" },
      mentions: { has: sinon.stub().returns(false) },
      channel: {
        send: sinon.stub(),
        sendTyping: sinon.stub(),
        name: "🤖robot",
      },
    };
  });

  // ensure the bot processes messages when in a bot channel
  test("should process a message from a bot channel", () => {
    message.channel.name = "🤖bot-channel";
    message.content = "Hello bot!";
    return bot.onMessageCreate(message).then(() => {
      // make sure the bot responds
      expect(message.channel.send.called).toBe(true);
    });
  });

  // make sure capabilities work
  // it("should process a message chain that includes a capability", async () => {
  //   message.content = "calculator:calculate(add, 1, 2)";
  //   await bot.onMessageCreate(message);
  //   // wait 15 seconds for the message to process
  //   // await new Promise((resolve) => setTimeout(resolve, 15000));

  //   expect(message.channel.send.called).to.be.true;
  // });

  // ensure the bot displays the typing indicator when processing a message
  // it("should display the typing indicator when processing a message", async () => {
  //   message.content = "Hello bot!";
  //   await bot.onMessageCreate(message);
  //   // make sure the bot calls the startTyping method
  //   expect(message.channel.startTyping.called).to.be.true;
  // });

  // ensure the bot calls the clearTyping method after processing a message
  // it("should clear the typing indicator after processing a message", async () => {
  //   message.content = "Hello bot!";
  //   await bot.onMessageCreate(message);
  //   // make sure the bot calls the clearTyping method after 5 seconds
  //   expect(message.channel.stopTyping.called).to.be.true;
  // });

  // ensure the bot does not process messages from other bots
  // it("should not process a message from another bot", async () => {
  //   message.author.bot = true;
  //   await bot.onMessageCreate(message);
  //   expect(message.channel.send.called).to.be.false;
  //   // also it should log "Another bot is trying to talk to me! 😡"
  // });

  // ensure the bot does not respond if the message is outside of a bot channel or the bot is not mentioned
  // it("should not process a message without a bot mention or channel name", async () => {
  //   message.mentions.has = sinon.stub().returns(false);
  //   message.channel.name = "non-bot-channel";
  //   await bot.onMessageCreate(message);
  //   expect(message.channel.send.called).to.be.false;
  // });
});
