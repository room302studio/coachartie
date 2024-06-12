const { getConfigFromSupabase } = require("./helpers-utility.js");
const logger = require("./src/logger.js")("helpers-prompt");
const {
  addUserMessages,
  addUserMemories,
  addRelevantMemories,
  addGeneralMemories,
} = require("./helpers-memory.js");
const { supabase } = require("./src/supabaseclient");
const { listTodos } = require("./capabilities/supabasetodo.js");
const { Chance } = require("chance");
const chance = new Chance();
const fs = require("fs");

/**
 * Loads the capability manifest from the specified file path.
 * @returns {Object|null} The capability manifest object, or null if an error occurred.
 */
function loadCapabilityManifest() {
  const manifestPath = "./capabilities/_manifest.json";
  try {
    const manifestData = fs.readFileSync(manifestPath, "utf8");
    const manifest = JSON.parse(manifestData);
    // log the number of capabilities and methods
    console.log(`Loaded ${Object.keys(manifest).length} capabilities`);
    return manifest;
  } catch (error) {
    logger.error(`Error loading capability manifest: ${JSON.stringify(error)}`);
    return null;
  }
}

/**
 * Assembles the message preamble for a given username.
 * @param {string} username - The username for which the message preamble is being assembled.
 * @returns {Promise<Array<string>>} - A promise that resolves to an array of messages representing the preamble.
 */
async function assembleMessagePreamble(username) {
  logger.info(`🔧 Assembling message preamble for <${username}> message`);
  const messages = [];
  addCurrentDateTime(messages);
  await addHexagramPrompt(messages);
  await addTodosToMessages(messages);
  await addUserMessages(username, messages);
  await addUserMemories(username, messages);
  await addRelevantMemories(username, messages);
  await addCapabilityPromptIntro(messages);
  await addCapabilityManifestMessage(messages);
  await addGeneralMemories(messages);
  await addSystemPrompt(messages);
  return messages;
}

async function addTodosToMessages(messages) {
  const todos = await listTodos();
  logger.info(`🔧 Adding todos to messages: ${todos.length}`);
  const todoString = JSON.stringify(todos);
  messages.push({
    role: "system",
    content: `Here are your todos: 
${todoString}`,
  });
}

/**
 * Adds the current date and time to the messages array.
 * @param {Array} messages - The array of messages.
 * @returns {void}
 */
function addCurrentDateTime(messages) {
  messages.push({
    role: "system",
    content: `Today is ${new Date().toLocaleDateString()} at ${new Date().toLocaleTimeString()}`,
  });
}

/**
 * Generates a hexagram.
 * @returns {string} - The generated hexagram.
 */
function generateHexagram() {
  const hexagramNumber = chance.integer({ min: 1, max: 64 });
  return `${hexagramNumber}. ${getHexName(hexagramNumber)}`;
}

/**
 * Gets the name of a hexagram.
 * @param {number} hexagramNumber - The number of the hexagram.
 * @returns {string} - The name of the hexagram.
 */
function getHexName(hexagramNumber) {
  const hexNameMap = getHexNameMap();
  return hexNameMap[hexagramNumber];
}

/**
 * Gets a map of hexagram numbers to names.
 * @returns {object} - The map of hexagram numbers to names.
 */
function getHexNameMap() {
  return {
    1: "The Creative",
    2: "The Receptive",
    3: "Difficulty at the Beginning",
    4: "Youthful Folly",
    5: "Waiting",
    6: "Conflict",
    7: "The Army",
    8: "Holding Together",
    9: "The Taming Power of the Small",
    10: "Treading",
    11: "Peace",
    12: "Standstill",
    13: "Fellowship with Men",
    14: "Possession in Great Measure",
    15: "Modesty",
    16: "Enthusiasm",
    17: "Following",
    18: "Work on What Has Been Spoiled",
    19: "Approach",
    20: "Contemplation",
    21: "Biting Through",
    22: "Grace",
    23: "Splitting Apart",
    24: "Return",
    25: "Innocence",
    26: "The Taming Power of the Great",
    27: "The Corners of the Mouth",
    28: "Preponderance of the Great",
    29: "The Abysmal",
    30: "The Clinging",
    31: "Influence",
    32: "Duration",
    33: "Retreat",
    34: "The Power of the Great",
    35: "Progress",
    36: "Darkening of the Light",
    37: "The Family",
    38: "Opposition",
    39: "Obstruction",
    40: "Deliverance",
    41: "Decrease",
    42: "Increase",
    43: "Breakthrough",
    44: "Coming to Meet",
    45: "Gathering Together",
    46: "Pushing Upward",
    47: "Oppression",
    48: "The Well",
    49: "Revolution",
    50: "The Cauldron",
    51: "The Arousing (Shock, Thunder)",
    52: "Keeping Still (Mountain)",
    53: "Development (Gradual Progress)",
    54: "The Marrying Maiden",
    55: "Abundance (Fullness)",
    56: "The Wanderer",
    57: "The Gentle (Wind)",
    58: "The Joyous (Lake)",
    59: "Dispersion (Dissolution)",
    60: "Limitation",
    61: "Inner Truth",
    62: "Preponderance of the Small",
    63: "After Completion",
    64: "Before Completion",
  };
}

/**
 * Adds a hexagram prompt to the messages array.
 * @param {Array} messages - The array of messages.
 * @returns {Promise<void>} - A promise that resolves when the hexagram prompt is added.
 */
async function addHexagramPrompt(messages) {
  if (chance.bool({ likelihood: 50 })) {
    const hexagram = generateHexagram();
    logger.info(`🔧 Adding hexagram prompt to message ${hexagram}`);
    const hexagramPrompt = `Let this hexagram from the I Ching guide this interaction: ${hexagram}`;
    messages.push({
      role: "system",
      content: hexagramPrompt,
    });
  }
}

/**
 * Adds a system prompt to the given array of messages.
 * @param {Array} messages - The array of messages to add the system prompt to.
 */
async function addSystemPrompt(messages) {
  const { PROMPT_SYSTEM } = await getPromptsFromSupabase();
  messages.push({
    role: "user",
    content: PROMPT_SYSTEM,
  });
}

/**
 * Adds a capability prompt introduction message to the given array of messages.
 * @param {Array} messages - The array of messages to add the capability prompt introduction to.
 */
async function addCapabilityPromptIntro(messages) {
  const { CAPABILITY_PROMPT_INTRO } = await getPromptsFromSupabase();

  messages.push({
    role: "user",
    content: CAPABILITY_PROMPT_INTRO,
  });
}

/**
 * Formats the capability manifest into a structured and readable format.
 * @param {Object} manifest - The capability manifest object.
 * @returns {string} - The capability manifest in a structured and readable format.
 */
function formatCapabilityManifest(manifest) {
  let formattedManifest = "";

  for (const category in manifest) {
    formattedManifest += `## ${category.toUpperCase()} CAPABILITIES\n\n`;

    for (const capability of manifest[category]) {
      formattedManifest += `### ${capability.name}\n`;
      formattedManifest += `${capability.description}\n\n`;

      if (capability.parameters) {
        formattedManifest += "**Parameters:**\n\n";
        for (const parameter of capability.parameters) {
          formattedManifest += `- **${parameter.name}**: ${parameter.description}\n`;
        }
        formattedManifest += "\n";
      }

      if (capability.examples) {
        formattedManifest += "**Examples:**\n\n";
        for (const example of capability.examples) {
          formattedManifest += `${example}\n\n`;
        }
        formattedManifest += "\n";
      }
    }

    formattedManifest += "---\n\n"; // Separator between categories
  }

  return formattedManifest;
}

/**
 * Adds a capability manifest message to the given array of messages.
 * @param {Array} messages - The array of messages to add the capability manifest message to.
 * @returns {Array} - The updated array of messages.
 */
async function addCapabilityManifestMessage(messages) {
  const { CHAT_MODEL } = await getConfigFromSupabase();
  const manifest = loadCapabilityManifest();

  // if there is no manifest, big error time
  if (!manifest) {
    logger.error("No capability manifest found");
    return messages;
  }

  if (CHAT_MODEL === "claude") {
    const xmlManifest = convertCapabilityManifestToXML(manifest);
    messages.push({
      role: "user",
      content: `## CAPABILITY MANIFEST\n\n${xmlManifest}`,
    });
  } else {
    if (manifest) {
      messages.push({
        role: "user",
        content: `## CAPABILITY MANIFEST\n\n${formatCapabilityManifest(
          manifest
        )}`,
      });
    }
  }
  return messages;
}

/**
 * Retrieves prompts from Supabase.
 * @returns {Promise<Object>} An object containing different prompts.
 * @example {
 *  PROMPT_REMEMBER: "In order to remember, you must first forget.",
 *  PROMPT_CAPABILITY_REMEMBER: "I remember that I can",
 *
 */
async function getPromptsFromSupabase() {
  const { data, error } = await supabase.from("prompts").select("*");
  const promptArray = data;
  const promptKeys = promptArray.map((prompt) => prompt.prompt_name);
  const promptValues = promptArray.map((prompt) => prompt.prompt_text);
  // return an object with all the keys and values
  const prompts = Object.fromEntries(
    promptKeys.map((_, i) => [promptKeys[i], promptValues[i]])
  );
  // logger.info(`Prompts: ${JSON.stringify(prompts, null, 2)}`);
  return prompts;
}

module.exports = {
  assembleMessagePreamble,
  addCurrentDateTime,
  addHexagramPrompt,
  addSystemPrompt,
  addCapabilityPromptIntro,
  addCapabilityManifestMessage,
  getPromptsFromSupabase,
};
