const dotenv = require("dotenv");
dotenv.config();
const axios = require("axios");
const { getAllMemories } = require("../src/remember");

const { destructureArgs } = require("../helpers");

async function handleCapabilityMethod(method, args) {
  const [arg1] = destructureArgs(args);

  if (method === "makeWeeklyBriefing") {
    return await makeWeeklyBriefing(arg1);
    // TODO:
    // - Rename to makeWeeklyBriefing
    // - makeDailyProjectBriefing - last 24 hours into project conversation
    // - makeDailyBriefing
    //   - last 24 hours into same conversation as makeWeeklyBriefing,
    //   - aggregated across all projects
  } else {
    throw new Error(`Method ${method} not supported by this capability.`);
  }
}

// This jsdoc documentation is parsed and passed to the robot capabilities through the manifest
/**
 * @async
 * @function makeExternalRequest
 * @param {string} url - The URL to make an external request to.
 * @returns {Promise<string>} The response from the external API, or an error message if an error occurred.
 */
async function makeWeeklyBriefing() {
  try {
    // const response = await axios.get(url);
    // return response.data;

    // look for feedback on previous weekly summaries

    // Look at all memories from this week (timestamp comparison in memories table)
    // Turn this week's memories into a factlist/meta-summary

    // Look for any projects / project IDs / project slugs

    // Look for any todos that have been completed
    // List all todo changes from this week (added, edited, deleted)

    // Read the calendar for the previous + upcoming week

    // Generate summary by project

    // Generate meta-summary based on project summaries

    // Take fact-based summary and run it through weekly sumary prompt / template
    // TODO: Prommpt engineering around turning list of facts across org into well-summarized document
    // for final user-facing message

    // Create new post in new conversation (if missive)
    // and/or
    // Create new thread in private channel (if Discord)

    // Save an archived copy of this weekly summary into our database (as special memory?)

    return "Weekly summary done!";
  } catch (error) {
    throw new Error(`Error occurred while making external request: ${error}`);
  }
}

module.exports = {
  handleCapabilityMethod,
};
