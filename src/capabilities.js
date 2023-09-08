const prompts = require("../prompts");

const { CAPABILITY_PROMPT_INTRO } = prompts;

const capabilityRegex = /(\w+):(\w+)\(([^]*?)\)/; // captures newlines in the  third argument

// an example capability
const callSomething = "callSomething:callSomething()"

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

// 📝 callCapabilityMethod: a function for calling capability methods
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
