const { GatewayIntentBits, Events } = require("discord.js");

class DiscordEvents {
  constructor(bot, discord) {
    this.bot = bot;
    this.discord = discord;
  }

  // Function to create a new scheduled event
  async createScheduledEvent(guildId, channelId, name, description, scheduledStartTime) {
    try {
      const guild = this.discord.guilds.cache.get(guildId);
      const channel = guild.channels.cache.get(channelId);

      const event = await channel.createScheduledEvent({
        name: name,
        description: description,
        privacyLevel: 'GUILD_ONLY',
        scheduledStartTime: scheduledStartTime,
        entityType: 'EXTERNAL',
      });

      console.log(`Scheduled event '${name}' created successfully.`);
      return event;
    } catch (error) {
      console.log(`Error creating scheduled event: ${error}`);
    }
  }

  // Function to get all scheduled events in a guild
  async getScheduledEvents(guildId) {
    try {
      const guild = this.discord.guilds.cache.get(guildId);
      const events = await guild.scheduledEvents.fetch();

      console.log(`Fetched ${events.size} scheduled events.`);
      return events;
    } catch (error) {
      console.log(`Error fetching scheduled events: ${error}`);
    }
  }
}

module.exports = DiscordEvents;

