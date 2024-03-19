const dotenv = require("dotenv");
const dateFns = require("date-fns");
dotenv.config();
const axios = require("axios");
const { getAllMemories, getRelevantMemories, getMemoriesBetweenDates } = require("../src/remember");
const logger = require("../src/logger")("briefing")
const { listEventsThisWeek, listEventsBetweenDates } = require("./calendar.js"); // Adjust the path as necessary


const { destructureArgs, countTokens, createChatCompletion } = require("../helpers");

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
    // const feedback = await retrieveFeedback();
    // TODO: Figure out the best way to incorporate this feedback into the summary generation

    // Look at all memories from this week (timestamp comparison in memories table)
    // Turn this week's memories into a factlist/meta-summary
    // const processedMemories = await processMemories();
    const weekStartDate = dateFns.startOfWeek(new Date());
    const weekEndDate = dateFns.endOfWeek(new Date());
    logger.info(`Looking for memories between ${weekStartDate} and ${weekEndDate}`);
    const weekMemories = getMemoriesBetweenDates(
      weekStartDate,
      weekEndDate
    );

    logger.info(`${countTokens(weekMemories)} tokens for all memories this week from ${weekStartDate} to ${weekEndDate} and ${weekMemories.length} memories`);

    // Look for any projects / project IDs / project slugs
    const projects = await identifyProjectsInMemories(processedMemories);

    const projectMemoryMap = {};

    // loop through each project, and get the relevant memories for it 
    for (const project of projects) {
      const projectMemories = getRelevantMemories(project.label, 5);
      logger.info(`Found ${countTokens(projectMemories)} tokens for project ${project.label} across ${projectMemories.length} memories`);
      projectMemoryMap[project.label] = projectMemories;
    }



    // Look for any todos that have been completed
    // List all todo changes from this week (added, edited, deleted)
    const todoChanges = await listTodoChanges();

    // Read the calendar for the previous + upcoming week
    const calendarEntries = await readCalendar();

    let projectSummaries = [];
    for (const projectMemories of projects) {
      const projectSummary = await generateProjectSummary({ projectMemories, projectMemoryMap, todoChanges, calendarEntries });

      // add the project summary to the project summaries
      projectSummaries.push(projectSummary);
    }

    // Generate meta-summary based on project summaries
    const metaSummary = await generateMetaSummary({
      projectSummaries,
      todoChanges,
      calendarEntries,
    });

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

  // query supabase for all memories with the feedback tag
  const { supabase } = require("../helpers");
  const { data, error } = await supabase
    .from("memories")
    .select("*")
    .eq("tags", "feedback");

  if (error) {
    console.error("Error retrieving feedback", error);
    return [];
  }

  return data;
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
  // We are going to get a bunch of memory objects
  // First let's extract all the content
  const memoryContentOnly = processedMemories.map((memory) => memory.content);

  // Then we can look for any project slugs or project IDs in the content
  // This will be a few regexes, and we prefer false positives over false negatives
  let missiveIds = [];
  let githubRepos = [];
  let projectSlugs = [];

  // Then we can go and look for each of them in the string
  const bigMemoryString = memoryContentOnly.join("\n");

  // create some messages with the string and some instructions
  const messages = [
    {
      role: "user",
      content: bigMemoryString,
    },
    {
      role: "user",
      content: "Find me all the Missive IDs in this string",      
    }
  ]
  
  // we can send the big string to an LLM and ask it to look for the "needles" of various IDs for conversations, repos, and projects
  // And just ask it to return it in a standard JSON format
  // that we can pass down to the next function
  const response = await createChatCompletion(messages, ["missive", "repo", "project"]);

  // Let's assume & hope the robot returns the format we requested:
  // A newline delimited list of each ID with a little label
  // Like:
  //  - Discussion on Project 1: Missive#fkdf993ek9k93k
  //  - Discussion on Project 2: Missive#fkdf993ek9k93k
  //  - Discussion on Project 3 in #studio: Discord#studio
  //  - Discussion on repo-name Issue 123: GitHub#repo-name/issue/123

  const parsedResponse = response.split("\n").map((line) => {
    const [label, id] = line.split(": ");
    return { label, id };
  })

  // make sure the parsedResponse has a length, if it doesn't, error out
  if (parsedResponse.length === 0) {
    logger.error(`No project slugs or IDs found in the memories ${JSON.stringify(response)}`);
    return [];
  }

  return parsedResponse;
}

/**
 * Lists all todo changes from this week (added, edited, deleted).
 * @returns {Promise<Array>} A promise that resolves to an array of todo changes.
 */
async function listTodoChanges() {
  const { supabase } = require("../helpers");
  const { data, error } = await supabase
    .from("todo")
    .select("*")
    .gte("updated_at", dateFns.startOfWeek(new Date()))
    .lte("updated_at", dateFns.endOfWeek(new Date()));

  if (error) {
    logger.error("Error retrieving todo changes", error);
    return [];
  }

  return data;
}


/**
 * Reads the calendar for the current week.
 * @returns {Promise<Object>} A promise that resolves to an object containing calendar entries.
 */
async function readCalendar() {
  try {
    // Assuming you have a way to determine the calendarId. It could be an environment variable or a fixed value.
    // TODO: Get this from supabase config table
    const calendarId = "your_calendar_id_here"; // Replace with actual calendar ID
    // const events = await listEventsThisWeek(calendarId);
    const events = await listEventsBetweenDates(calendarId, dateFns.startOfWeek(new Date()), dateFns.endOfWeek(new Date()));

    return events;
  } catch (error) {
    logger.error(`Error reading calendar: ${error}`);
    return {}; // Return an empty object or handle the error as appropriate
  }
}

/**
 * Generates summary by project.
 * @param {Object} worldInfoObject - An object containing information about the various projects.
 * @param {Array} worldInfoObject.projects - An array of projects.
 * @param {Array} worldInfoObject.todoChanges - An array of todo changes.
 * @param {Object} worldInfoObject.calendarEntries - An object containing calendar entries.
 * @returns {Promise<Array>} A promise that resolves to an array of project summaries.
 * @example await generateProjectSummary({ project, projectMemoryMap, todoChanges, calendarEntries });
 */
async function generateProjectSummary({ project, projectMemoryMap, todoChanges, calendarEntries }) {
  // Placeholder for project summary generation logic
  const completion = createChatCompletion([
    {
      role: "user",
      content: `I want to generate a summary for project ${project.label}`,
    },
    {
      role: "user",
      content: `Here are the memories for project ${project.label}: ${projectMemoryMap[project.label].map((memory) => memory.content).join("\n")}`,
    },
    {
      role: "user",
      content: `Here are the todo changes for project ${project.label}: ${todoChanges.map((todo) => todo.content).join("\n")}`,
    },
    {
      role: "user",
      content: `Here are the calendar entries for project ${project.label}: ${JSON.stringify(calendarEntries)}`,
    },
    {
      role: "user",
      content: `Can you please generate a summary for project ${project.label}?Be as detailed as possible.`,
    },
  ]);
  console.log(completion);
  return completion
}

/**
 * Generates a meta-summary based on project summaries.
 * @param {Array} projectSummaries - The project summaries to base the meta-summary on.
 * @returns {Promise<String>} A promise that resolves to a string containing the meta-summary.
 */
async function generateMetaSummary({ projectSummaries, todoChanges, calendarEntries }) {
  const metaSummaryCompletion = createChatCompletion([
    {
      role: "user",
      content: `I want to generate a meta-summary based on the project summaries: ${projectSummaries.join("\n")}`,
    },
    {
      role: "user",
      content: `Here are the todo changes: ${todoChanges.map((todo) => todo.content).join("\n")}`,
    },
    {
      role: "user",
      content: `Here are the calendar entries: ${JSON.stringify(calendarEntries)}`,
    },
    {
      role: "user",
      content: `Can you please generate a meta-summary of this week? Be as detailed as possible.`,
    },
  ]);

  return metaSummaryCompletion;
}

/**
 * Formats the fact-based summary through a weekly summary prompt/template.
 * @param {String} summary - The summary to format.
 * @returns {Promise<String>} A promise that resolves to a string containing the formatted summary.
 */
async function formatSummary(summary) {
  const formattedCompletion = createChatCompletion([
    {
      role: "user",
      content: `I want to format the summary: ${summary}`,
    },
    {
      role: "user",
      content: `Can you please re-write this summary of facts into a well-architected summary document? Wherever possible, summarize related facts into a single sentence or paragraph. Use bullet points for lists. Be as detailed as possible and surface specific links, dates, projects, and names.`,
    },
  ]);

  return formattedCompletion;
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
  // we will save a special type of memory that is tagged as a weekly summary archive
  const { supabase } = require("../helpers");
  const { data, error } = await supabase.from("memories").insert([
    {
      content: summary,
      tags: ["weekly_summary"],
    },
  ]);

  if (error) {
    logger.error("Error archiving summary", error);
  }

  return data;
}

module.exports = {
  handleCapabilityMethod,
};
