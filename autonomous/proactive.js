const cron = require('node-cron');
const Chance = require('chance');
const chance = new Chance();
const { processMessageChain } = require("../src/chain");
const { PROACTIVE_IDEA_BRAINSTORM, PROACTIVE_PERFORM_TASK, PROACTIVE_COMPLETION_EVALUATOR } = require('../prompts');
const logger = require("../src/logger.js")("proactive");


const PROACTIVE_OUTPUT_CHANNEL_ID = "1086329744762622023";

const proactive = {
  start: async function(bot) {
    logger.info("Starting proactive.start()");
    // Schedule the task to run every hour
    cron.schedule('0 * * * *', async () => {
      // Replace the logger.info statement with your desired action
      logger.info("Running proactive.start() every hour via cron");

      // list the potential tasks
      const potentialTasks = await this.listPotentialTasks();

      const channel = bot.bot.channels.cache.get(PROACTIVE_OUTPUT_CHANNEL_ID);
      this.channel = channel;

      if(!channel) {
        logger.error(`Channel with ID ${PROACTIVE_OUTPUT_CHANNEL_ID} not found`);
        return;
      }

      // start an interval that sends typing every 5 seconds
      const interval = setInterval(() => {
        channel.sendTyping();
      }, 5000);      

      // perform the proactive task
      const processedMessage = await this.performProactiveTask(potentialTasks.join('\n'));

      // evaluate the proactive task completion
      // const taskCompleted = await this.evaluateProactiveTaskCompletion(processedMessage);

      // if (taskCompleted) {
      //   logger.info("Task completed!");
      // }



      // Check if the channel exists
      if (!channel) {
        logger.error(`Channel with ID ${PROACTIVE_OUTPUT_CHANNEL_ID} not found`);
        return;
      }

      await bot.sendMessage(processedMessage, channel);

      // clear the interval
      clearInterval(interval);

    
    });
  },
  listPotentialTasks: async function() {
    logger.info("Listing potential tasks");
    // Pull recent memories and messages and identify some proactive steps
    const channel = this.channel;

    const processedMessages = await processMessageChain(
      [
        {
          role: "user",
          content: PROACTIVE_IDEA_BRAINSTORM
          ,
        },
      ],
      {username: "proactive-cron-job", channel}
    );

    logger.info('listPotentialTasks processedMessages', processedMessages);

    // then we take the processed messsage and split it by newline
    const potentialTaskArray = processedMessages[processedMessages.length - 1].content.split("\n");
    logger.info("potentialTaskArray", potentialTaskArray);

    return potentialTaskArray;

  },
  chooseProactiveTask: function(potentialTaskArray) {
    logger.info("Choosing a proactive task", potentialTaskArray);
    // Choose a proactive task to perform
    const task = chance.pickone(potentialTaskArray);
    return task;
  },
  performProactiveTask: async function(proactiveTask) {
    const channel = this.channel;

    logger.info("Performing proactive task", proactiveTask);
    // Perform the proactive task
    const processedMessages = await processMessageChain(
      [
        { role: "user", content: `# Brainstormed Task To-do List\n${proactiveTask}\n${PROACTIVE_PERFORM_TASK}` },
      ],
      {username: "proactive-cron-job", channel}
    );

    return processedMessages[processedMessages.length - 1].content;    
  },
  evaluateProactiveTaskCompletion: async function(finalMessage) {
    const channel = this.channel;
    logger.info("Evaluating proactive task completion", finalMessage);
    // Evaluate the proactive task completion
    // If the task is complete, send the final message to the user
    // If the task is not complete, start over
    const processedMessages = await processMessageChain(
      [
        {
          role: "user",
          content: finalMessage + "\n" + PROACTIVE_COMPLETION_EVALUATOR
          ,
        },
      ],
      {username: "proactive-cron-job", channel}
    );

    const completionText = processedMessages[processedMessages.length - 1].content;

    // if the completion text, when lowercased, contains "yes" then return true
    return completionText.toLowerCase().includes("yes");
  }

};

module.exports = proactive;
