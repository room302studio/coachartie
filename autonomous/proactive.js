const cron = require("node-cron");
const Chance = require("chance");
const chance = new Chance();
// const { getPromptsFromSupabase } = require("../helpers");
// const {
//   PROACTIVE_IDEA_BRAINSTORM,
//   PROACTIVE_PERFORM_TASK,
//   PROACTIVE_COMPLETION_EVALUATOR,
// } = require("../prompts");
const logger = require("../src/logger.js")("proactive");

const PROACTIVE_OUTPUT_CHANNEL_ID = "1086329744762622023";

const proactive = {
  start: async function (bot) {
    logger.info("Starting proactive.start()");
    cron.schedule("0 9-16/4 * * 3-5", async () => {
      if (chance.bool({ likelihood: 25 })) {
        logger.info("Skipping proactive task");
        return;
      }

      // list the potential tasks
      const potentialTasks = await this.listPotentialTasks();

      const channel = bot.bot.channels.cache.get(PROACTIVE_OUTPUT_CHANNEL_ID);
      this.channel = channel;

      if (!channel) {
        logger.info(`Channel with ID ${PROACTIVE_OUTPUT_CHANNEL_ID} not found`);
        return;
      }

      // perform the proactive task
      const processedMessage = await this.performProactiveTask(
        potentialTasks.join("\n"),
      );

      await bot.sendMessage(processedMessage, channel);
    });
  },
  listPotentialTasks: async function () {
    const { processMessageChain } = await require("../src/chain");
    logger.info("Listing potential tasks");
    // Pull recent memories and messages and identify some proactive steps
    const channel = this.channel;

    const processedMessages = await processMessageChain(
      [
        {
          role: "user",
          content: PROACTIVE_IDEA_BRAINSTORM,
        },
      ],
      { username: "proactive-cron-job", channel },
    );

    // then we take the processed messsage and split it by newline
    const potentialTaskArray =
      processedMessages[processedMessages.length - 1].content.split("\n");

    logger.info(`Listed potential tasks: ${potentialTaskArray}`);

    return potentialTaskArray;
  },
  chooseProactiveTask: function (potentialTaskArray) {
    logger.info("Choosing a proactive task", potentialTaskArray);
    // Choose a proactive task to perform
    const task = chance.pickone(potentialTaskArray);
    logger.info(`Chose proactive task: ${task}`);
    return task;
  },
  performProactiveTask: async function (proactiveTask) {
    const { processMessageChain } = await require("../src/chain");
    const channel = this.channel;

    logger.info("Performing proactive task", proactiveTask);
    // Perform the proactive task
    const processedMessages = await processMessageChain(
      [
        {
          role: "user",
          content: `# Brainstormed Task To-do List\n${proactiveTask}\n${PROACTIVE_PERFORM_TASK}`,
        },
      ],
      { username: "proactive-cron-job", channel },
    );

    return processedMessages[processedMessages.length - 1].content;
  },
};

module.exports = proactive;
