const { supabase, destructureArgs } = require("../helpers");
const { createSharedLabel, createPost } = require("../src/missive");
require("dotenv").config();

const PARTNER_TABLE_NAME = "partners";

// TODO: Add function documentation
async function createPartner(name, aliases, shortname, startDate) {
  // TODO: is name unique?
  const newLabel = await createSharedLabel(name, process.env.MISSIVE_ORGANIZATION);
  const sharedLabelId = newLabel.map(label => label.id)
  const newPost = await createPost(name, "PDW", process.env.PDW_USER_ICON, process.env.MISSIVE_ORGANIZATION, sharedLabelId, "New partner", name)
  const { data, error } = await supabase.from(PARTNER_TABLE_NAME).insert([
    {
      name,
      aliases,
      shortname,
      start_date: startDate,
      conversation_id: newPost[0].conversation_id,
    },
  ]);

  if (error) throw new Error(error.message);
  return `Successfully added partner: ${name}`;
}
