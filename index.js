// 🚀 Our wonderful, time-traveling imports!
const DiscordBot = require("./src/discord.js");
// If your discord.js file is in another folder, adjust the path accordingly!

// 🏗 Constructing the Bot, universe's best contractor at work!
const bot = new DiscordBot();

// 🎉 The christening of our bot's journey!
bot.bot.on("ready", () => {
  console.log("Bot is ready!");
})
