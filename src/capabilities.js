const fs = require("fs");
const path = require("path");
const { getPromptsFromSupabase, capabilityRegex } = require("../helpers");
const winston = require("winston");

const logger = require("../src/logger.js")("capabilities");

// an example capability
const callSomething = "callSomething:callSomething()";

const capabilityFile = fs.readFileSync(
  path.join(__dirname, "../capabilities/_manifest.json"),
);

// parse the json
const capabilities = JSON.parse(capabilityFile);

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
async function callCapabilityMethod(capabilitySlug, methodName, args, messages) {
  try {
    const capability = require(`../capabilities/${capabilitySlug}`);
    const capabilityResponse = await capability.handleCapabilityMethod(methodName, args, messages);

    // Ensure there's a response
    if (!capabilityResponse) {
      throw new Error(`Capability ${capabilitySlug} did not return a response.`);
    }

    // Return a success response
    return { success: true, data: capabilityResponse };
  } catch (error) {
    logger.info(`Error running ${capabilitySlug}.${methodName}: ${error}`);
    // Return an error response
    return { success: false, error: error.message };
  }
}

module.exports = {
  capabilityRegex,
  capabilities,
  callCapabilityMethod,
};
