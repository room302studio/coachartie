const dotenv = require("dotenv");
const dateFns = require("date-fns");
dotenv.config();
const axios = require("axios");
const {
  getRelevantMemories,
  getMemoriesBetweenDates,
  getMemoriesByString,
} = require("../src/remember");
const logger = require("../src/logger")("briefing");
const { listEventsThisWeek, listEventsBetweenDates } = require("./calendar.js"); // Adjust the path as necessary

const { destructureArgs, countTokens } = require("../helpers");

async function handleCapabilityMethod(method, args) {
  const [arg1] = destructureArgs(args);

  if (method === "makeWeeklyBriefing") {
    return await makeWeeklyBriefing();
  } else if (method === "makeDailyBriefing") {
    return await makeDailyBriefing();
  } else if (method === "makeProjectBriefing") {
    return await makeProjectBriefing(arg1);
  } else {
    throw new Error(`Method ${method} not supported by this capability.`);
  }
}

/**
 * Makes a weekly briefing.
 * @returns {Promise<String>} A promise that resolves to a string indicating the status of the weekly briefing.
 * @example await makeWeeklyBriefing();
 */
async function makeWeeklyBriefing() {
  try {
    // look for feedback on previous weekly summaries
    // const feedback = await retrieveFeedback();
    // TODO: Figure out the best way to incorporate this feedback into the summary generation

    // Look at all memories from this week (timestamp comparison in memories table)
    // Turn this week's memories into a factlist/meta-summary
    const weekStartDate = dateFns.startOfWeek(new Date());
    const weekEndDate = dateFns.endOfWeek(new Date());
    logger.info(
      `Looking for memories between ${weekStartDate} and ${weekEndDate}`,
    );

    const weekMemories = await getMemoriesBetweenDates(
      weekStartDate,
      weekEndDate,
    );
    // console.log(weekMemories)

    logger.info("Below is the weekMemories returned from supabase");
    logger.info(`${JSON.stringify(weekMemories, null, 2)}`);

    // we want to remove all the embeddings from each memory
    // and turn into a giant string for tokenization
    const cleanMemories = weekMemories.map((memory) => {
      return memory.value;
    });

    const cleanMemoryString = cleanMemories.join("\n");

    logger.info(
      `${countTokens(
        cleanMemoryString,
      )} tokens for all memories this week from ${weekStartDate} to ${weekEndDate} and ${
        weekMemories.length
      } memories`,
    );

    // Look for any projects / project IDs / project slugs
    // const projects = await identifyProjectsInMemories(weekMemories);
    // We now have an array of projects and identifying information about them

    // const projectMemoryMap = {};

    // loop through each project, and get the relevant memories for it
    // for (const project of projects) {
    //   const projectMemories = getRelevantMemories(project.label, 5);
    //   logger.info(`Found ${countTokens(projectMemories)} tokens for project ${project.label} across ${projectMemories.length} memories`);
    //   projectMemoryMap[project.label] = projectMemories;
    // }

    // Now we've built information about projects, more world context

    // Look for any todos that have been completed
    // List all todo changes from this week (added, edited, deleted)
    // const todoChanges = await listTodoChanges();
    // logger.info(`Found ${todoChanges.length} todo changes this week`);

    // Read the calendar for the previous + upcoming week
    // const calendarEntries = await readCalendar();
    // logger.info(`Found ${calendarEntries.length} calendar entries this week`);

    // let projectSummaries = [];
    // for (const projectMemories of projects) {
    //   const projectSummary = await generateProjectSummary({ projectMemories, projectMemoryMap, todoChanges, calendarEntries });

    //   logger.info(`Generated project summary for ${projectMemories.label}: ${projectSummary}`);

    //   // add the project summary to the project summaries
    //   projectSummaries.push(projectSummary);
    // }
    // logger.info(`Generated ${projectSummaries.length} project summaries`);

    // // Generate meta-summary based on project summaries
    const metaSummary = await generateMetaSummary({
      weekMemories,
      // projectSummaries,
      // todoChanges,
      // calendarEntries,
    });

    // Take fact-based summary and run it through weekly summary prompt / template
    // TODO: Prompt engineering around turning list of facts across org into well-summarized document
    // for final user-facing message
    // const formattedSummary = await formatSummary(metaSummary);

    // Create new post in new conversation (if missive)
    // and/or
    // Create new thread in private channel (if Discord)
    // TODO: For when we do long-running capabilities
    // await communicateSummary(formattedSummary);

    // Save an archived copy of this weekly summary into our database (as special memory?)
    // await archiveSummary(formattedSummary);
    // const formattedSummary = 'This is a formatted summary';
    // return metaSummary
    // console.log(metaSummary);
    return metaSummary;

    // return "Weekly summary done!";
    // return formattedSummary;
  } catch (error) {
    throw new Error(`Error occurred while making external request: ${error}`);
  }
}

/**
 * Makes a daily briefing across all projects
 * @returns {Promise<String>} A promise that resolves to a string indicating the status of the daily briefing.
 */
async function makeDailyBriefing() {
  try {
    return "Daily briefing done!";
  } catch (error) {
    throw new Error(
      `Error occurred while trying to make daily briefing: ${error}`,
    );
  }
}

/**
 * Makes a briefing on one particular project.
 * @param {String} project - The project name to make a briefing on.
 */
async function makeProjectBriefing(projectName) {
  try {
    // Placeholder for project briefing logic
    const processedMemories = await getRelevantMemories(projectName);
    const memoriesMentioningProject = await getMemoriesByString(projectName);
    const todoChanges = await listTodoChanges();
    const calendarEntries = await readCalendar();
    const projectMemoryMap =
      await identifyProjectsInMemories(processedMemories);

    const projectSummary = await generateProjectSummary({
      project,
      projectMemoryMap,
      todoChanges,
      calendarEntries,
      memoriesMentioningProject,
    });
    return projectSummary;
  } catch (error) {
    throw new Error(
      `Error occurred while trying to make project briefing: ${error}`,
    );
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
 * Identifies projects, project IDs, or project slugs mentioned in the memories.
 * @param {Array} processedMemories - The processed memories to identify projects in.
 * @returns {Promise<Array>} A promise that resolves to an array of project identifiers.
 */
async function identifyProjectsInMemories(processedMemories) {
  const { createChatCompletion } = require("../helpers");
  // Placeholder for project identification logic
  // We are going to get a bunch of memory objects
  // First let's extract all the content

  // make sure processedMemories is an array of objects with a content property
  if (!Array.isArray(processedMemories) || processedMemories.length === 0) {
    logger.error(`No memories found to identify projects in`);
    return [];
  }

  if (!processedMemories[0].content) {
    logger.error(`No content found in memories to identify projects in`);
    return [];
  }

  const memoryContentOnly = processedMemories.map((memory) => memory.content);

  // Then we can look for any project slugs or project IDs in the content
  const bigMemoryString = memoryContentOnly.join("\n");

  // create some messages with the string and some instructions
  const messages = [
    {
      role: "user",
      // this is an example message to extract IDs out of
      content: `We should add a new issue to coachartie - we had three conversations about it in #23ij2329, #sdijs, and #studio. We also had a long conversation about Project 2 in #studio.

In the previous message I just sent, please identify any GitHub Repos, Issues, Missive Conversations, or Projects. Please respond in the following format, newline-delimited with no other text: 

- Discussion on Project 1: Missive#fkdf993ek9k93k
- Discussion on Project 2: Missive#fkdf993ek9k93k      
      `,
    },
    {
      role: "assistant",
      content: `- Discussion on GitHub repo: GitHub#coachartie
- Discussion on Coach Artie: Missive#23ij2329
- Discussion on Coach Artie: Missive#sdijs
- Discussion on Coach Artie: Discord#studio
- Discussion on Project 2: Discord#studio`,
    },
    {
      role: "user",
      content: `Perfect! Thank you!`,
    },
    {
      role: "user",
      content: bigMemoryString,
    },
    {
      role: "user",
      content: `In the previous message I just sent, please identify any GitHub Repos, Issues, Missive Conversations, or Projects. Please respond in the following format, newline-delimited with no other text: 

- Discussion on Project 1: Missive#fkdf993ek9k93k
- Discussion on Project 2: Missive#fkdf993ek9k93k
- Discussion on Project 3 in #studio: Discord#studio
`,
    },
  ];

  // we can send the big string to an LLM and ask it to look for the "needles" of various IDs for conversations, repos, and projects
  // And just ask it to return it in a standard JSON format
  // that we can pass down to the next function
  const response = await createChatCompletion(messages, [
    "missive",
    "repo",
    "project",
  ]);

  // Let's assume & hope the robot returns the format we requested:
  // A newline delimited list of each ID with a little label
  // Like:
  //  - Discussion on Project 1: Missive#fkdf993ek9k93k
  //  - Discussion on Project 2: Missive#fkdf993ek9k93k
  //  - Discussion on Project 3 in #studio: Discord#studio
  //  - Discussion on repo-name Issue 123: GitHub#repo-name/issue/123

  const parsedResponse = response.split("\n").map((line) => {
    const [label, id] = line.split(": ");
    const [type, value] = id.split("#");
    return { label, type, value, id };
  });

  logger.info(
    `Parsed ID extraction from memories: ${JSON.stringify(
      parsedResponse,
      null,
      2,
    )}`,
  );

  // make sure the parsedResponse has a length, if it doesn't, error out
  if (parsedResponse.length === 0) {
    logger.error(
      `No project slugs or IDs found in the memories ${JSON.stringify(
        response,
      )}`,
    );
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
    // const events = await listEventsBetweenDates(calendarId, dateFns.startOfWeek(new Date()), dateFns.endOfWeek(new Date()));
    // pull 1 week behind and 1 week ahead
    const events = await listEventsBetweenDates(
      calendarId,
      dateFns.subWeeks(new Date(), 1),
      dateFns.addWeeks(new Date(), 1),
    );

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
async function generateProjectSummary({
  project,
  projectMemoryMap,
  todoChanges,
  calendarEntries,
  memoriesMentioningProject,
}) {
  const { createChatCompletion } = require("../helpers");
  // Placeholder for project summary generation logic
  let messages = [];

  if (project && project.label) {
    messages.push({
      role: "user",
      content: `I want to generate a summary for project ${project.label}`,
    });
  }

  if (projectMemoryMap && projectMemoryMap[project.label]) {
    messages.push({
      role: "user",
      content: `Here are the memories for project ${
        project.label
      }: ${projectMemoryMap[project.label]
        .map((memory) => memory.content)
        .join("\n")}`,
    });
  }

  if (todoChanges && todoChanges.length > 0) {
    messages.push({
      role: "user",
      content: `Here are the todo changes for project ${
        project.label
      }: ${todoChanges.map((todo) => todo.content).join("\n")}`,
    });
  }

  if (memoriesMentioningProject && memoriesMentioningProject.length > 0) {
    messages.push({
      role: "user",
      content: `These memories reference the project: ${memoriesMentioningProject
        .map((memory) => memory.content)
        .join("\n")}`,
    });
  }

  if (calendarEntries && Object.keys(calendarEntries).length > 0) {
    messages.push({
      role: "user",
      content: `Here are the calendar entries for project ${
        project.label
      }: ${JSON.stringify(calendarEntries)}`,
    });
  }

  messages.push({
    role: "user",
    content: `Can you please generate a summary for project ${project.label}? Be as detailed as possible.`,
  });

  const completion = await createChatCompletion(messages);
  const aiResponse = completion//.choices[0].message.content;
  return aiResponse;
}

/**
 * Generates a meta-summary based on project summaries.
 * @param {Array} projectSummaries - The project summaries to base the meta-summary on.
 * @returns {Promise<String>} A promise that resolves to a string containing the meta-summary.
 */
async function generateMetaSummary({
  weekMemories,
  projectSummaries,
  todoChanges,
  calendarEntries,
}) {
  const { createChatCompletion } = require("../helpers");
  logger.info(
    `Generating meta-summary for weekMemories: ${weekMemories.length}`,
  );
  // make sure all the things exist

  // log out the first memory
  logger.info(`First memory: ${JSON.stringify(weekMemories[0])}`);

  // if(!projectSummaries || projectSummaries.length === 0) {
  //   throw new Error("No project summaries found, can't generate a meta-summary");
  // }

  // if(!todoChanges || todoChanges.length === 0) {
  //   throw new Error("No todo changes found, can't generate a meta-summary");
  // }

  // if(!calendarEntries || Object.keys(calendarEntries).length === 0) {
  //   throw new Error("No calendar entries found, can't generate a meta-summary");
  // }

  const metaSummaryCompletion = await createChatCompletion([
    // {
    //   role: "user",
    //   content: `I want to generate a meta-summary based on the project summaries: ${projectSummaries.join("\n")}`,
    // // },
    // {
    //   role: "user",
    //   content: `Here are the todo changes: ${todoChanges.map((todo) => todo.content).join("\n")}`,
    // },
    // {
    //   role: "user",
    //   content: `Here are the calendar entries: ${JSON.stringify(calendarEntries)}`,
    // },
    {
      role: "user",
      content: `Here are all the memories from this week: ${weekMemories
        .map((memory) => {
          return `${memory.created_at}: ${memory.value}`;
        })
        .join("\n")}`,
    },
    {
      role: "user",
      content: `Can you please generate a meta-summary of this week? Be as detailed as possible.`,
    },
  ]);

  // return metaSummaryCompletion;
  // extract the response text from the openai chat completion
  const responseText = metaSummarycompletion.choices[0].message.content;
  return responseText;
}

/**
 * Formats the fact-based summary through a weekly summary prompt/template.
 * @param {String} summary - The summary to format.
 * @returns {Promise<String>} A promise that resolves to a string containing the formatted summary.
 */
async function formatSummary(summary) {
  const formattedCompletion = await createChatCompletion([
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
 * @param {String} service - The service to post the message to - could be either `discord` or `missive` so far
 * @returns {Promise<void>}
 */
async function communicateSummary(message, service) {
  // Placeholder for communication logic
  if (service === "discord") {
    // Look up the ID of the weekly summary from the config
    // then send a message to that channel
    // figure out the correct Discord channel to post to
    // post to discord
  } else if (service === "api") {
    // AKA Missive
    //
    // Create a new conversation with a title like "Weekly Summary - Week of [date]"
    // post to missive
  } else if (service === "github") {
    // figure out any relevant repos / issues
    // and send response there
  }
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
