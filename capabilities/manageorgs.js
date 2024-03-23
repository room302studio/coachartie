const { parseJSONArg } = require("../helpers");
const { createSharedLabel, createPost } = require("../src/missive");
const { createClient } = require("@supabase/supabase-js");
require("dotenv").config();

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_API_KEY,
  { db: { schema: "tachio" } },
);

const ORG_TABLE_NAME = "orgs";
const EMAIL_TABLE_NAME = "emails";
const ORG_EMAIL_TABLE_NAME = "org_emails";

/**
 * Creates a new organization, label and post
 *
 * @param {string} name - The name of the organization.
 * @param {string} shortname - The short name of the organization. If not provided, the name is used and spaces are replaced with hyphens.
 * @param {Array} aliases - The aliases of the organization.
 * @param {string} summary - The summary of the organization.
 * @param {string} note - The note for the organization.
 * @param {Date} firstContact - The date of the first contact with the organization. If not provided, the current date is used.
 * @param {string} primaryEmailAddress - The primary email address of the organization.
 * @param {Array} emailAddresses - The email addresses of the organization.
 *
 * @returns {Promise<string>} A promise that resolves to a string message indicating the result of the operation.
 *
 * @throws {Error} If there is an error with the Supabase operations.
 */
async function createOrg({
                           name,
                           shortname,
                           aliases,
                           summary,
                           note,
                           firstContact,
                           primaryEmailAddress,
                           emailAddresses,
                         }) {
  if (!name) throw new Error("Missing required fields");

  const newLabel = await createSharedLabel({
    name,
    shareWithOrganization: true,
    organization: process.env.MISSIVE_ORGANIZATION,
  });
  const labelId = newLabel.shared_labels[0].id

  const newPost = await createPost({
    addSharedLabels: [labelId, process.env.MISSIVE_SHARED_LABEL],
    conversationSubject: name,
    username: "Tachio",
    usernameIcon: process.env.TACHIO_ICON,
    organization: process.env.MISSIVE_ORGANIZATION,
    notificationTitle: "New org",
    notificationBody: name,
    text: name,
  })

  let newlyAddedEmails = []
  if (primaryEmailAddress || emailAddresses) {
    const newEmailAddresses = [primaryEmailAddress, ...(emailAddresses || [])].map(emailAddress => ({ email_address: emailAddress }))
    const { data, error } = await supabase
      .from(EMAIL_TABLE_NAME)
      .upsert(newEmailAddresses, { onConflict: 'email_address', ignoreDuplicates: false })
      .select("id, email_address");
    if (error) throw new Error(error.message);
    newlyAddedEmails = data
  }

  const { data, error } = await supabase.from(ORG_TABLE_NAME).insert([
    {
      name,
      shortname: shortname || name.replace(/\s/g, '-'),
      aliases,
      summary,
      note,
      missive_conversation_id: newPost.posts.conversation,
      missive_label_id: labelId,
      first_contact: firstContact || new Date(),
      primary_email_address: primaryEmailAddress,
    },
  ]).select("id");
  if (error) throw new Error(error.message);

  const orgEmails = newlyAddedEmails.filter(email => email.email_address !== primaryEmailAddress).map(email => ({
    email_id: email.id,
    org_id: data[0].id,
  }))
  if (orgEmails.length > 0) {
    const { error: orgEmailError } = await supabase.from(ORG_EMAIL_TABLE_NAME).insert(orgEmails)
    if (orgEmailError) throw new Error(orgEmailError.message);
  }
  return `Successfully added org: ${name}`;
}


/**
 * Updates an existing organization in the database and sends a notification.
 *
 * @param {string} name - The current name of the organization.
 * @param {string} newName - The new name of the organization.
 * @param {Array} newAliases - The new aliases of the organization.
 * @param {Date} newFirstContact - The new date of the first contact with the organization.
 *
 * @returns {Promise<string>} A promise that resolves to a string message indicating the result of the operation.
 *
 * @throws {Error} If there is an error with the Supabase operations.
 */
async function updateOrg({ name, newName, newAliases, newFirstContact }) {
  if (!newName && !newAliases && !newFirstContact) return "No changes made"

  const { data: [orgBefore], error: errorGetOrg } = await supabase
    .from(ORG_TABLE_NAME)
    .select('aliases, first_contact, missive_conversation_id')
    .match({ name })
  if (errorGetOrg) throw new Error(errorGetOrg.message);
  if (
    (!newName || newName === name) &&
    (!newAliases || JSON.stringify(newAliases) === JSON.stringify(orgBefore.aliases)) &&
    (!newFirstContact || newFirstContact === orgBefore.first_contact)
  ) return "No changes made";

  const { error } = await supabase
    .from(ORG_TABLE_NAME)
    .update({ newName, aliases: newAliases, first_contact: newFirstContact })
    .match({ name });
  if (error) throw new Error(error.message);

  const updateNotificationParts = [];
  if (newName) {
    name = newName
    updateNotificationParts.push(`- Org updated: ${orgBefore.name} changed to ${newName}`);
  }
  if (newAliases) {
    updateNotificationParts.push(`- ${name} alias added: ${newAliases}`);
    updateNotificationParts.push(`- ${name} alias removed: ${orgBefore.aliases}`);
  }
  if (newFirstContact) {
    updateNotificationParts.push(`- First contact with ${name} on ${newFirstContact}`);
  }
  const updateNotificationMarkdown = updateNotificationParts.join('\n');
  await createPost({
    notificationTitle: "Update org",
    notificationBody: "Update org",
    markdown: updateNotificationMarkdown,
    conversation: orgBefore.missive_conversation_id,
  })
  return updateNotificationMarkdown;
}

module.exports = {
  handleCapabilityMethod: async (method, args) => {
    console.log(`⚡️ Calling capability method: supabaseorg.${method}`);
    const arg = parseJSONArg(args)
    if (method === "createOrg") {
      return await createOrg(arg);
    } else if (method === "updateOrg") {
      return await updateOrg(arg);
    } else {
      throw new Error(`Invalid method: ${method}`);
    }
  },
  ORG_TABLE_NAME
};
