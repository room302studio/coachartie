const dotenv = require("dotenv");
dotenv.config();
const axios = require("axios");

const { destructureArgs } = require("../helpers");

async function handleCapabilityMethod(method, args) {
  const [arg1] = destructureArgs(args);

  if (method === "makeWeeklySummary") {
    return await makeWeeklySummary(arg1);
    // TODO:
    // - makeProjectSummary
    // - make
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
async function makeWeeklySummary() {
  try {
    // const response = await axios.get(url);
    // return response.data;

    // look for feedback on previous weekly summaries

    // Look at all memories from this week (timestamp comparison)

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
