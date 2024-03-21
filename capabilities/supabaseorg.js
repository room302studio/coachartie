const { destructureArgs, parseJSONArg } = require("../helpers");
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

// TODO: Add function documentation
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
    text: "New org",
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

  return `Successfully added partner: ${name}`;
}


// TODO: Add function documentation
async function updatePartner(partnerId, newName, newAliases, newStartDate) {
  // TODO: undefined value should has no effect
  const { data, error } = await supabase
    .from(PARTNER_TABLE_NAME)
    .update({ name: newName, aliases: newAliases, start_date: newStartDate })
    .match({ id: partnerId });

  if (error) throw new Error(error.message);
  return data[0];
}


module.exports = {
  handleCapabilityMethod: async (method, args) => {
    console.log(`⚡️ Calling capability method: supabaseorg.${method}`);

    if (method === "createOrg") {
      return await createOrg(parseJSONArg(args));
    } else if (method === "updatePartner") {
      const [partnerId, newName, newAliases, newStartDate] = destructureArgs(args);
      return await updatePartner(partnerId, newName, newAliases, newStartDate);
    } else {
      throw new Error(`Invalid method: ${method}`);
    }
  },
};
