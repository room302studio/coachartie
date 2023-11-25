const chalk = require("chalk");


const {
  countMessageTokens,
  doesMessageContainCapability,
  generateAiCompletionParams,
  generateAiCompletion,
  trimResponseIfNeeded,
  TOKEN_LIMIT,
  WARNING_BUFFER,
  isExceedingTokenLimit
} = require("../helpers.js");
const { generateAndStoreRememberCompletion } = require("./memory.js");
const { 
  capabilityRegex, 
  callCapabilityMethod
} = require("./capabilities.js");
const { storeUserMessage } = require("../capabilities/remember");

/**
 * getCapabilityResponse is a function that calls a capability method and retrieves the response.
 * If an error occurs during the call, it handles the error and provides a default error response.
 * The capability response is then trimmed if needed to fit within the token limit.
 * @param {string} capSlug - The capability slug
 * @param {string} capMethod - The capability method
 * @param {string} capArgs - The capability arguments
 * @returns {string} - The trimmed capability response
 */
async function getCapabilityResponse(capSlug, capMethod, capArgs) {
  let capabilityResponse;
  try {
    console.log(chalk.green('Calling Capability: ' + capSlug + ':' + capMethod));
    // Step 1: Call the capability method and retrieve the response
    // the response will either be a string of text or a Buffer of an image
    capabilityResponse = await callCapabilityMethod(
      capSlug,
      capMethod,
      capArgs
    );
    console.log(chalk.green('Capability Responded: ' + capSlug + ':' + capMethod));
  } catch (e) {
    console.error(e);
    // Step 2: Handle errors and provide a default error response
    capabilityResponse = "Capability error: " + e;
    console.log(chalk.red('Error: ' + e));
  }

  console.log(chalk.yellow('Trimming Response: ' + capabilityResponse.slice(0, 20) + '...'));
  // Step 3: Trim the capability response if needed to fit within the token limit
  return trimResponseIfNeeded(capabilityResponse);
}

/**
 * processCapability is a function that processes a capability and adds the system response.
 * It first gets the capability arguments from the regex and calculates the current token count in the message chain.
 * If the message chain is about to exceed the token limit, it adds a warning.
 * Then it processes the capability and adds the system response.
 * @param {Array} messages - The array of messages
 * @param {Array} capabilityMatch - The capability match array
 * @returns {Array} - The updated array of messages
 */
async function processCapability(messages, capabilityMatch) {
  // Get the capability arguments from the regex
  const [_, capSlug, capMethod, capArgs] = capabilityMatch;
  // Calculate the current token count in the message chain
  const currentTokenCount = countMessageTokens(messages);

  // Check if the message chain is about to exceed the token limit
  if (currentTokenCount >= TOKEN_LIMIT - WARNING_BUFFER) {
    console.log(chalk.yellow('Token Limit Warning: Current Tokens - ' + currentTokenCount));
    messages.push(createTokenLimitWarning());
  }

  console.log(chalk.green('Processing Capability: ' + capSlug + ':' + capMethod));
  // Process the capability and add the system response
  const capabilityResponse = await getCapabilityResponse(
    capSlug,
    capMethod,
    capArgs
  );

  const message = {
    role: "system",
    content: 'Capability ' + capSlug + ':' + capMethod + ' responded with: ' + capabilityResponse,
  }

  // if the capabilityResponse is a Buffer/image we need to make the content empty and add the buffer as an `image` property
  // first we check if the capabilityResponse is a Buffer
  if (capabilityResponse instanceof Buffer) {
    // if it is, we set the content to empty
    message.content = "";
    // and we add the image property
    message.image = capabilityResponse;
  }

  messages.push(message);

  return messages;
}

/**
 * processMessageChain is a function that processes a message chain.
 * It first checks if the messages array is empty. If it is, it returns an empty array.
 * Then it gets the last message in the chain.
 * It processes the message chain as long as the last message contains a capability call.
 * After processing, it returns the updated message chain.
 * @param {Array} messages - The array of messages
 * @param {string} username - The username
 * @returns {Array} - The updated array of messages
 */
async function processMessageChain(messages, username) {
  // Check if the messages array is empty
  if (!messages.length) {
    console.log(chalk.yellow('Empty Message Chain'));
    return [];
  }

  // Get the last message in the chain
  let lastMessage = messages[messages.length - 1].content;

  // Process the message chain as long as the last message contains a capability call
  do {
    console.log(chalk.green('Processing Message Chain: ' + lastMessage.slice(0, 20) + '...'));
    // Process the message
    messages = await processMessage(messages, lastMessage, username);

    // Update the last message
    lastMessage = messages[messages.length - 1].content;
  } while (
    doesMessageContainCapability(lastMessage) &&
    !isExceedingTokenLimit(messages)
  );

  // Return the updated message chain
  return messages;
}

/**
 * processMessage is a function that processes a message.
 * It first checks if the last message contains a capability call. If it does, it extracts the capability information from the last message and processes the capability.
 * Then it gets the last user message from the chain and stores the user message in the database.
 * It generates an AI response based on the messages and adds the AI response to the message chain.
 * Finally, it makes a memory about the interaction and stores it in the database, and returns the updated messages.
 * @param {Array} messages - The array of messages
 * @param {string} lastMessage - The last message in the chain
 * @param {string} username - The username
 * @returns {Array} - The updated array of messages
 */
async function processMessage(messages, lastMessage, username) {
  // Check if the last message contains a capability call
  if (doesMessageContainCapability(lastMessage)) {
    // If it does...
    // Extract the capability information from the last message
    const capabilityMatch = lastMessage.match(capabilityRegex);

    try {
      // Process the capability
      messages = await processCapability(messages, capabilityMatch);
    } catch (error) {
      messages.push({
        role: "system",
        content: 'Error processing capability: ' + error,
      });
    }
  }

  // get the last message from a user in the chain
  const lastUserMessage = messages.find((m) => m.role === "user");
  // That user message will be the prompt for the AI
  const prompt = lastUserMessage.content;

  // Store the user message in the database
  storeUserMessage(username, prompt);

  // Generate AI response based on the messages, and generating the AI Completion parameters
  // Randomized AI params for each message
  const { temperature, frequency_penalty } = generateAiCompletionParams();

  // Generate the AI response based on the result of the capability processing
  const { aiResponse } = await generateAiCompletion(
    prompt,
    username,
    messages,
    {
      temperature,
      frequency_penalty,
    }
  );

  // add the AI response to the message chain
  messages.push({
    role: "assistant",
    content: aiResponse,
  });

  // Make a memory about the interaction and store THAT in the database
  // Now passing the entire message chain to the function
  generateAndStoreRememberCompletion(prompt, aiResponse, username, messages);

  // Return the updated messages
  return messages;
}

module.exports = {
  processMessageChain,
  processMessage,
  processCapability,
};
