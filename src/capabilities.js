const prompts = require("../prompts");

const { CAPABILITY_PROMPT_INTRO } = prompts;

const capabilityRegex = /(\w+):(\w+)\(([^]*?)\)/; // captures newlines in the  third argument

// an example capability
const callSomething = "callSomething:callSomething()";

// 💪 Flexin' on 'em with our list of cool capabilities!
const capabilities = require("../capabilities/_manifest.js").capabilities;

// capability prompt
// to tell the robot all the capabilities it has and what they do
// Prepare information in capabilities array
const prepareCapabilities = capabilities.map((capability) => {
  // Map each method inside a capability
  const methods = capability.methods?.map((method) => {
    return `\n ${method.name}: ${method.description} call like: ${
      capability.slug
    }:${method.name}(${method.parameters.map((d) => d.name).join(",")})`;
  });

  // Return the capability information with its methods
  return `\n## ${capability.slug}: ${capability.description} 
${methods}`;
});

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
 * @param {string} capabilitySlug - The slug of the capability to call.
 * @param {string} methodName - The name of the method to call.
 * @param {Array} args - The arguments to pass to the method.
 * @returns {Promise<*>} - The response from the capability method.
 */
async function callCapabilityMethod(capabilitySlug, methodName, args) {
  console.log(
    `⚡️ Calling capability method: ${capabilitySlug}.${methodName} with args: ${args}`
  );

  try {
    const capability = require(`../capabilities/${capabilitySlug}`);
    const capabilityResponse = await capability.handleCapabilityMethod(
      methodName,
      args
    );
    console.log(`⚡️ Capability response: ${capabilityResponse}`);
    if (capabilityResponse.image) {
      console.log(`⚡️ Capability response is an image`);
      return capabilityResponse
    }
    return capabilityResponse;
  } catch (error) {
    console.error(error);
    return `Error: ${error.message}`;
  }
}

module.exports = {
  capabilityRegex,
  capabilities,
  capabilityPrompt,
  callCapabilityMethod,
};

