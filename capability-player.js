const readline = require('readline');
const { processCapability } = require('./src/chain');
const { destructureArgs } = require('./helpers');

// Create readline interface for command line input
const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

// Function to ask user for input
function askQuestion(query) {
  return new Promise(resolve => rl.question(query, resolve));
}

// Simulate processing a message as done in chain.js
async function processInputAsMessage(input) {
  const capabilityMatch = input.match(/(\w+):(\w+)\(([^)]*)\)/);
  if (!capabilityMatch) {
    console.log('Invalid format. Please use the format: capabilitySlug:methodName(args)');
    return;
  }

  const [, capSlug, capMethod, capArgsString] = capabilityMatch;

  // Initialize an empty messages array to simulate the message chain
  let messages = [];

  // Process the capability, passing capArgsString directly
  messages = await processCapability(messages, [null, capSlug, capMethod, capArgsString]);

  // Output the response
  const lastMessage = messages[messages.length - 1];
  console.log('Capability Response:', lastMessage.content);
}

// Main function to run the CLI
async function main() {
  console.log('Capability Player CLI');
  console.log('Type "exit" to quit.');

  while (true) {
    const input = await askQuestion('Enter capability and method (format: capabilitySlug:methodName(args)): ');

    if (input.toLowerCase() === 'exit') break;

    await processInputAsMessage(input);
  }

  rl.close(); // Close readline interface
}

main().catch(console.error);