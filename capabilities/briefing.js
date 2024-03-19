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
    // look for feedback on previous weekly summaries
    const feedback = await retrieveFeedback();

    // Look at all memories from this week (timestamp comparison in memories table)
    // Turn this week's memories into a factlist/meta-summary
    const processedMemories = await processMemories();

    // Look for any projects / project IDs / project slugs
    const projects = await identifyProjectsInMemories(processedMemories);

    // Look for any todos that have been completed
    // List all todo changes from this week (added, edited, deleted)
    const todoChanges = await listTodoChanges();

    // Read the calendar for the previous + upcoming week
    const calendarEntries = await readCalendar();

    // Generate summary by project
    const projectSummaries = await generateProjectSummaries({
      projects,
      todoChanges,
      clendarEntries,
    });

    // Generate meta-summary based on project summaries
    const metaSummary = await generateMetaSummary(projectSummaries);

    // Take fact-based summary and run it through weekly summary prompt / template
    // TODO: Prompt engineering around turning list of facts across org into well-summarized document
    // for final user-facing message
    const formattedSummary = await formatSummary(metaSummary);

    

    // Create new post in new conversation (if missive)
    // and/or
    // Create new thread in private channel (if Discord)
    await communicateSummary(formattedSummary);

    // Save an archived copy of this weekly summary into our database (as special memory?)
    await archiveSummary(formattedSummary);

    return "Weekly summary done!";
  } catch (error) {
    throw new Error(`Error occurred while making external request: ${error}`);
  }
}

/**
 * Retrieves feedback on previous weekly summaries.
 * @returns {Promise<Array>} A promise that resolves to an array of feedback items.
 */
async function retrieveFeedback() {
  // Placeholder for feedback retrieval logic
  return []; // Return an empty array for now
}

/**
 * Processes this week's memories into a factlist/meta-summary.
 * @returns {Promise<Array>} A promise that resolves to an array of processed memories.
 */
async function processMemories() {
  // Placeholder for memory processing logic
  return []; // Return an empty array for now
}

/**
 * Identifies projects, project IDs, or project slugs mentioned in the memories.
 * @param {Array} processedMemories - The processed memories to identify projects in.
 * @returns {Promise<Array>} A promise that resolves to an array of project identifiers.
 */
async function identifyProjectsInMemories(processedMemories) {
  // Placeholder for project identification logic
  return []; // Return an empty array for now
}

/**
 * Lists all todo changes from this week (added, edited, deleted).
 * @returns {Promise<Array>} A promise that resolves to an array of todo changes.
 */
async function listTodoChanges() {
  // Placeholder for todo list changes logic
  return []; // Return an empty array for now
}

/**
 * Reads the calendar for the previous and upcoming week.
 * @returns {Promise<Object>} A promise that resolves to an object containing calendar entries.
 */
async function readCalendar() {
  // Placeholder for calendar reading logic
  return {}; // Return an empty object for now
}

/**
 * Generates summary by project.
 * @param {Object} worldInfoObject - An object containing information about the various projects.
 * @param {Array} worldInfoObject.projects - An array of projects.
 * @param {Array} worldInfoObject.todoChanges - An array of todo changes.
 * @param {Object} worldInfoObject.calendarEntries - An object containing calendar entries.
 * @returns {Promise<Array>} A promise that resolves to an array of project summaries.
 */
async function generateProjectSummaries(worldInfoObject = { projects: [], todoChanges: [], calendarEntries: {} }) {

  // Placeholder for project summary generation logic
  return []; // Return an empty array for now
}

/**
 * Generates a meta-summary based on project summaries.
 * @param {Array} projectSummaries - The project summaries to base the meta-summary on.
 * @returns {Promise<String>} A promise that resolves to a string containing the meta-summary.
 */
async function generateMetaSummary(projectSummaries) {
  // Placeholder for meta-summary generation logic
  return ""; // Return an empty string for now
}

/**
 * Formats the fact-based summary through a weekly summary prompt/template.
 * @param {String} summary - The summary to format.
 * @returns {Promise<String>} A promise that resolves to a string containing the formatted summary.
 */
async function formatSummary(summary) {
  // Placeholder for summary formatting logic
  return ""; // Return an empty string for now
}

/**
 * Creates new posts or threads in communication platforms.
 * @param {String} message - The message to post.
 * @returns {Promise<void>}
 */
async function communicateSummary(message) {
  // Placeholder for communication logic
}

/**
 * Saves an archived copy of the weekly summary.
 * @param {String} summary - The summary to archive.
 * @returns {Promise<void>}
 */
async function archiveSummary(summary) {
  // Placeholder for archiving logic
}

module.exports = {
  handleCapabilityMethod,
};
