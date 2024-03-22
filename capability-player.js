const readline = require("readline");
const fs = require("fs");
const path = require("path");
// Process the capability, passing capArgsString directly
// const { processAndLogCapabilityResponse } = require("./src/chain");

// console.log('--------')
// console.log("processAndLogCapabilityResponse", processAndLogCapabilityResponse);

// Load and parse the capability manifest
const capabilityManifestPath = path.join(
  __dirname,
  "capabilities",
  "_manifest.json",
);
const capabilityManifest = JSON.parse(
  fs.readFileSync(capabilityManifestPath, "utf8"),
);

// Create readline interface for command line input
const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
});

let lastCommand = null;

// Function to display capabilities and their methods
function displayCapabilities() {
  console.log("Available capabilities and their methods:");
  Object.entries(capabilityManifest).forEach(([capability, methods]) => {
    console.log(`\nCapability: ${capability}`);
    methods.forEach((method) => {
      console.log(`  Method: ${method.name}`);
      console.log(`    Description: ${method.description}`);
      if (method.parameters) {
        console.log("    Parameters:");
        method.parameters.forEach((param) => {
          console.log(`      - ${param.name}: ${param.description}`);
        });
      }
      if (method.exceptions) {
        console.log("    Exceptions:");
        method.exceptions.forEach((exception) => {
          console.log(`      - ${exception}`);
        });
      }
    });
  });
  console.log(
    "\nType the capability and method you want to use in the format: capability:methodName(args)",
  );
}

// Function to ask user for input
function askQuestion(query) {
  return new Promise((resolve) => rl.question(query, resolve));
}

// Simulate processing a message as done in chain.js
async function processInputAsMessage(input) {
  const capabilityMatch = input.match(/(\w+):(\w+)\(([^)]*)\)/);
  lastCommand = input;
  if (!capabilityMatch) {
    console.log(
      "Invalid format. Please use the format: capabilitySlug:methodName(args)",
    );
    return;
  }

  const [, capSlug, capMethod, capArgsString] = capabilityMatch;

  delete require.cache[require.resolve("./src/chain")];

  // Re-require the chain module to get the latest version
  const chain = require("./src/chain");

  // Initialize an empty messages array to simulate the message chain
  let messages = [];

  const { processAndLogCapabilityResponse } = await chain;

  // console.log("processAndLogCapabilityResponse", processAndLogCapabilityResponse);

  messages = await processAndLogCapabilityResponse(messages, [
    null,
    capSlug,
    capMethod,
    capArgsString,
  ]);

  // Output the response
  const lastMessage = messages[messages.length - 1];
  // console.log("Capability Response:", lastMessage);
}
// Main function to run the CLI
async function main() {
  console.log("Capability Player CLI");
  console.log('Type "exit" to quit.');

  displayCapabilities();

  while (true) {
    let query =
      '\nEnter capability and method (format: capability:methodName(args)), or type "rerun" to execute the last command: ';
    if (lastCommand) {
      query += `\nLast command was: "${lastCommand}". `;
    }
    query += '\nYour choice (or type "exit" to quit): ';

    const input = await askQuestion(query);

    if (input.toLowerCase() === "exit") break;
    if (input.toLowerCase() === "rerun" && lastCommand) {
      console.log(`Re-running: ${lastCommand}`);
      await processInputAsMessage(lastCommand);
    } else if (input.trim()) {
      await processInputAsMessage(input);
    }
  }

  rl.close(); // Close readline interface
}

main().catch(console.error);
