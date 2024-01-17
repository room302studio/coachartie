const prompts = require("../prompts");
const fs = require("fs");
const path = require("path");
const { CAPABILITY_PROMPT_INTRO } = prompts;
const winston = require("winston");

const logger = require("../src/logger.js")("capabilities");

const capabilityRegex = /(\w+):(\w+)\(([^]*?)\)/; // captures newlines in the  third argument

// an example capability
const callSomething = "callSomething:callSomething()";

const capabilityFile = fs.readFileSync(
  path.join(__dirname, "../capabilities/_manifest.json"),
);

// parse the json
const capabilities = JSON.parse(capabilityFile);

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
async function callCapabilityMethod(
  capabilitySlug,
  methodName,
  args,
  messages,
) {
  logger.info(
    `⚡️ Calling capability method: ${capabilitySlug}.${methodName} with args: ${args}`,
  );

  try {
    // get the capability from the capabilities folder
    const capability = require(`../capabilities/${capabilitySlug}`);

    // every capability exports a handleCapabilityMethod method
    // which we will call
    // call the capability method
    const capabilityResponse = await capability.handleCapabilityMethod(
      methodName,
      args,
      messages,
    );
    if (!capabilityResponse) {
      throw new Error(
        `Capability ${capabilitySlug} did not return a response.`,
      );
    }

    if (capabilityResponse.image) {
      logger.info(`⚡️ Capability response is an image`);
      return capabilityResponse;
    }
    return capabilityResponse;
  } catch (error) {
    logger.error(error);
    return `Error: ${error.message}`;
  }
}

module.exports = {
  capabilityRegex,
  capabilities,
  capabilityPrompt,
  callCapabilityMethod,
};
