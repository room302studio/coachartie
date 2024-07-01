const fs = require("fs");
const path = require("path");
const { getPromptsFromSupabase, capabilityRegexSingle } = require("../helpers");

const logger = require("../src/logger.js")("capabilities");

// an example capability
const callSomething = "callSomething:callSomething()";

const capabilityFile = fs.readFileSync(
  path.join(__dirname, "../capabilities/_manifest.json")
);

// parse the json
const capabilities = JSON.parse(capabilityFile);
// count the number of capabilities
const capabilityCount = Object.keys(capabilities).length;
logger.info(`Loaded ${capabilityCount} capabilities`);

(async () => {
  const { CAPABILITY_PROMPT_INTRO } = await getPromptsFromSupabase();

  // capability prompt
  // to tell the robot all the capabilities it has and what they do
  // Prepare information in capabilities array
  const prepareCapabilities = [];
  for (const capabilitySlug in capabilities) {
    const capability = capabilities[capabilitySlug];
    const methods = capability.methods?.map((method) => {
      return `\n ${method.name}: ${method.description} call like: ${
        capability.slug
      }:${method.name}(${method.parameters.map((d) => d.name).join(",")})`;
    });

    const capabilityInfo = `\n## ${capability.slug}: ${capability.description} 
${methods}`;

    prepareCapabilities.push(capabilityInfo);
  }

  // Combine everything to build the prompt message
  const capabilityPrompt = `
${CAPABILITY_PROMPT_INTRO}

These are all of your capabilities:
${prepareCapabilities.join("\n")}
`;
})();

/**
 * Function for calling capability methods.
 * It logs the method call and its response, and returns the response.
 * If the response is an instance of Buffer, it returns an object with type 'image' and the Buffer as data.
 * If an error occurs, it logs the error and returns a string with the error message.
 * Capabilities must have a handleCapabilityMethod method that takes the method name, arguments, (and messages, if needed) as arguments.
 * @param {string} capabilitySlug - The slug of the capability to call.
 * @param {string} methodName - The name of the method to call.
 * @param {Array} args - The arguments to pass to the method.
 * @param {Array} messages - All of the conversation messages so far
 * @returns {Promise<*>} - The response from the capability method.
 */
async function callCapabilityMethod(capSlug, capMethod, capArgs, messages) {
  logger.info(
    `Attempting to call capability: ${capSlug}:${capMethod}(${capArgs})`
  );
  logger.info(`Messages array length: ${messages?.length || "undefined"}`);

  try {
    const capability = require(`../capabilities/${capSlug}`);
    logger.info(
      `Imported capability: ${JSON.stringify(Object.keys(capability))}`
    );

    if (typeof capability.handleCapabilityMethod !== "function") {
      logger.error(
        `handleCapabilityMethod is not a function in capability ${capSlug}`
      );
      throw new Error(`Invalid capability structure for ${capSlug}`);
    }

    logger.info(`Calling handleCapabilityMethod for ${capSlug}:${capMethod}`);
    logger.info(
      `Params being passed: method=${capMethod}, args=${JSON.stringify(
        capArgs
      )}, messages length=${messages?.length}`
    );

    const originalUserPrompt =
      messages.find((msg) => msg.role === "user")?.content || "";

    // Explicitly spread the arguments to ensure they're all passed
    const result = await capability.handleCapabilityMethod(
      capMethod,
      capArgs,
      originalUserPrompt
    );

    logger.info(
      `Result from ${capSlug}:${capMethod}: ${JSON.stringify(result)}`
    );
    return { success: true, data: result };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    logger.error(
      `Error calling capability ${capSlug}:${capMethod}: ${errorMessage}`
    );
    logger.error(
      `Full error: ${JSON.stringify(error, Object.getOwnPropertyNames(error))}`
    );
    return { success: false, error: errorMessage };
  }
}

module.exports = {
  capabilities,
  callCapabilityMethod,
};
