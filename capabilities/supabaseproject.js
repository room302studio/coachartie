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
