const { parseJSONArg } = require("../helpers");
const { createSharedLabel, createPost } = require("../src/missive");
const { createClient } = require("@supabase/supabase-js");
const { ORG_TABLE_NAME } = require("./supabaseorg");
require("dotenv").config();

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_API_KEY,
  { db: { schema: "tachio" } },
);

const PROJECT_TABLE_NAME = "projects";

async function createProject({
                               orgName,
                               projectName,
                               shortname,
                               aliases,
                               summary,
                               note,
                               status,
                               startDate,
                               endDate,
                             }) {
  if (!orgName || !projectName) throw new Error("Missing required fields");

  const { data: [org], error } = await supabase
    .from(ORG_TABLE_NAME)
    .select("id, missive_label_id")
    .match({ name: orgName })
  if (error) throw new Error(error.message);
  if (!org) throw new Error(`Org not found: ${orgName}`);

  const newLabel = await createSharedLabel({
    name: projectName,
    parent: org.missive_label_id,
    organization: process.env.MISSIVE_ORGANIZATION,
  });
  const labelId = newLabel.shared_labels[0].id

  const newPost = await createPost({
    addSharedLabels: [labelId, process.env.MISSIVE_SHARED_LABEL],
    conversationSubject: projectName,
    username: "Tachio",
    usernameIcon: process.env.TACHIO_ICON,
    organization: process.env.MISSIVE_ORGANIZATION,
    notificationTitle: "New project created",
    notificationBody: projectName,
    text: projectName,
  })
  const conversationId = newPost.posts.conversation

  const { error: errAddProject } = await supabase.from(PROJECT_TABLE_NAME).insert([
    {
      name: projectName,
      org_id: org.id,
      shortname: shortname || projectName.replace(/\s/g, '-'),
      aliases,
      summary,
      note,
      status: status || 'active',
      missive_conversation_id: conversationId,
      missive_label_id: labelId,
      start_date: startDate || new Date(),
      end_date: endDate,
    },
  ]);
  if (errAddProject) throw new Error(errAddProject.message);
  return `Successfully added project: ${projectName}`;
}

async function updateProject({
                               projectName,
                               newProjectName,
                               newOrgId,
                               newAliases,
                               newStatus,
                               newStartDate,
                               newEndDate,
                             }) {
  if (!newProjectName && !newOrgId && !newAliases && !newStatus && !newStartDate && !newEndDate) return "No changes made"

  const { data: [projectBefore], error } = await supabase
    .from(PROJECT_TABLE_NAME)
    .select('org_id, aliases, status, start_date, end_date')
    .match({ name: projectName })
  if (error) throw new Error(error.message);
  if (
    (!newProjectName || newProjectName === projectName) &&
    (!newOrgId || newOrgId === projectBefore.org_id) &&
    (!newAliases || JSON.stringify(newAliases) === JSON.stringify(projectBefore.aliases)) &&
    (!newStatus || newStatus === projectBefore.status) &&
    (!newStartDate || newStartDate === projectBefore.start_date) &&
    (!newEndDate || newEndDate === projectBefore.end_date)
  ) return "No changes made";

  const { error: errUpdateProject } = await supabase
    .from(PROJECT_TABLE_NAME)
    .update({
      name: newProjectName,
      org_id: newOrgId,
      aliases: newAliases,
      status: newStatus,
      start_date: newStartDate,
      end_date: newEndDate,
    })
    .match({ name: projectName });
  if (errUpdateProject) throw new Error(errUpdateProject.message);
  return `Successfully updated project: ${projectName}`;
}

async function updateProjectStatus({ name, shortname, alias, endDate, newStatus }) {
  if (!name && !shortname && !alias) throw new Error("Missing required fields");

  let newValue = { status: newStatus }
  if (endDate) newValue.end_date = endDate
  let query = supabase
    .from(PROJECT_TABLE_NAME)
    .update(newValue)
  if (name) query = query.eq('name', name);
  if (shortname) query = query.eq('shortname', shortname);
  if (alias) query = query.contains('aliases', [alias]);

  const { error } = await query;

  if (error) throw new Error(error.message);
  return `Successfully ${newStatus} project: ${name || shortname || alias}`
}

module.exports = {
  handleCapabilityMethod: async (method, args) => {
    console.log(`⚡️ Calling capability method: supabaseproject.${method}`);
    const arg = parseJSONArg(args)
    if (method === "createProject") {
      return await createProject(arg);
    } else if (method === "updateProject") {
      return await updateProject(arg);
    } else if (method === "completeProject") {
      arg.newStatus = "completed";
      return await updateProjectStatus(arg);
    } else if (method === "archiveProject") {
      arg.newStatus = "archived";
      delete arg.endDate
      return await updateProjectStatus(arg);
    } else {
      throw new Error(`Invalid method: ${method}`);
    }
  },
};
