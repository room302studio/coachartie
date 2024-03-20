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
    console.log(`⚡️ Calling capability method: supabasepartner.${method}`);

    if (method === "createPartner") {
      const [name, aliases, shortname, startDate] = destructureArgs(args);
      return await createPartner(name, aliases, shortname, startDate);
    } else if (method === "updatePartner") {
      const [partnerId, newName, newAliases, newStartDate] = destructureArgs(args);
      return await updatePartner(partnerId, newName, newAliases, newStartDate);
    } else {
      throw new Error(`Invalid method: ${method}`);
    }
  },
};
