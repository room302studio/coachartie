const {
  countMessageTokens,
  doesMessageContainCapability,
  generateAiCompletionParams,
  displayTypingIndicator,
  generateAiCompletion,
  splitAndSendMessage,
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
const chalk = require("chalk");
const boxen = require("boxen");

async function getCapabilityResponse(capSlug, capMethod, capArgs, message) {
  let capabilityResponse;
  try {
    console.log(chalk.green(boxen(`Calling Capability: ${capSlug}:${capMethod}`, {padding: 1})));
    message.channel.send(`Attempting to call capability ${capSlug}:${capMethod}...`);
    // Step 1: Call the capability method and retrieve the response
    capabilityResponse = await callCapabilityMethod(
      capSlug,
      capMethod,
      capArgs
    );
    console.log(chalk.green(boxen(`Capability Responded: ${capSlug}:${capMethod}`, {padding: 1})));
    message.channel.send(`Capability ${capSlug}:${capMethod} responded with: ${capabilityResponse}`);
  } catch (e) {
    console.error(e);
    // Step 2: Handle errors and provide a default error response
    capabilityResponse = "Capability error: " + e;
    console.log(chalk.red(boxen(`Error: ${e}`, {padding: 1})));
    message.channel.send(capabilityResponse);
  }

  console.log(chalk.yellow(boxen(`Trimming Response: ${capabilityResponse.slice(0, 20)}...`, {padding: 1})));
  message.channel.send(`Trimming capability response if needed to fit within the token limit...`);
  // Step 3: Trim the capability response if needed to fit within the token limit
  return trimResponseIfNeeded(capabilityResponse);
}

async function processCapability(messages, capabilityMatch, message) {
  // Get the capability arguments from the regex
  const [_, capSlug, capMethod, capArgs] = capabilityMatch;
  // Calculate the current token count in the message chain
  const currentTokenCount = countMessageTokens(messages);

  // Check if the message chain is about to exceed the token limit
  if (currentTokenCount >= TOKEN_LIMIT - WARNING_BUFFER) {
    console.log(chalk.yellow(boxen(`Token Limit Warning: Current Tokens - ${currentTokenCount}`, {padding: 1})));
    message.channel.send(`Token limit is about to be exceeded. Adding warning...`);
    messages.push(createTokenLimitWarning());
  }

  console.log(chalk.green(boxen(`Processing Capability: ${capSlug}:${capMethod}`, {padding: 1})));
  message.channel.send(`Processing capability ${capSlug}:${capMethod}...`);
  // Process the capability and add the system response
  const capabilityResponse = await getCapabilityResponse(
    capSlug,
    capMethod,
    capArgs,
    message
  );

  messages.push({
    role: "system",
    content: `Capability ${capSlug}:${capMethod} responded with: ${capabilityResponse}`,
  });

  return messages;
}

/**
 * 📝 processMessageChain: a function for processing message chains
 * The purpose of this function is to take a message chain, and process it based on certain parameters.
 * If the token count of the message is about to exceed a set limit, a "system message" is added at the bot's position reminding it to keep within the limits.
 * If a capability method is found in the last message, the method is called, and then the response is trimmed down to meet the token limit.
 * The function also generates values for temperature and presence penalties.
 * Finally, all the processed messages are returned along with the mentioned AI Completion parameters.
 *
 * @param {Object} message - The discord message context the bot is working with
 * @param {Array} messages - An array of message objects in the chain
 * @param {String} username - The username of the receiver of the message, used to assemble the preamble
 * @return {Array} - All processed messages along with AI Completion parameters
 */
async function processMessageChain(message, messages, username) {
  // Check if the messages array is empty
  if (!messages.length) {
    console.log(chalk.yellow(boxen('Empty Message Chain', {padding: 1})));
    return [];
  }

  // Display typing indicator
  const typingInterval = displayTypingIndicator(message);

  // Get the last message in the chain
  let lastMessage = messages[messages.length - 1].content;

  // Process the message chain as long as the last message contains a capability call
  do {
    console.log(chalk.green(boxen(`Processing Message Chain: ${lastMessage.slice(0, 20)}...`, {padding: 1})));
    message.channel.send(`Processing message chain...`);
    // Process the message
    messages = await processMessage(message, messages, lastMessage, username);

    // Update the last message
    lastMessage = messages[messages.length - 1].content;
  } while (
    doesMessageContainCapability(lastMessage) &&
    !isExceedingTokenLimit(messages)
  );

  message.channel.send(`Splitting and sending the AI response back to the user...`);
  // Split and send the AI response back to the user through discord
  await splitAndSendMessage(lastMessage, message);

  // Clear the typing indicator
  clearInterval(typingInterval);

  // Return the updated message chain
  return messages;
}

/**
 * 📝 processMessage: a function for processing messages
 * The purpose of this function is to take a message, and process it based on certain parameters.
 * If the message contains a capability call, the capability is processed.
 * The function also generates values for temperature and presence penalties.
 * Finally, all the processed messages are returned along with AI Completion parameters.
 * @param {Object} message - The discord message context the bot is working with
 * @param {Array} messages - An array of message objects in the chain
 * @param {String} lastMessage - The last message in the chain
 * @return {Array} - All processed messages along with AI Completion parameters
 * @param {String} username - The username of the receiver of the message, used to assemble the preamble
 * @return {Array} - All processed messages along with AI Completion parameters
 * @param {Object} message - The discord message context the bot is working with
 * @return {Array} - All processed messages along with AI Completion parameters
 */
async function processMessage(message, messages, lastMessage, username) {
  // Check if the last message contains a capability call
  if (doesMessageContainCapability(lastMessage)) {
    // send the channel a message saying we are processing a capability
    message.channel.send("Processing capability...");

    // If it does...
    // Extract the capability information from the last message
    const capabilityMatch = lastMessage.match(capabilityRegex);

    try {
      // Process the capability
      message.channel.send(`Processing capability ${capabilityMatch[1]}...`);
      messages = await processCapability(messages, capabilityMatch, message);
    } catch (error) {
      messages.push({
        role: "system",
        content: `Error processing capability: ${error}`,
      });
    }
  }

  message.channel.send(`Getting the last user message from the chain...`);
  // get the last message from a user in the chain
  const lastUserMessage = messages.find((m) => m.role === "user");
  // That user message will be the prompt for the AI
  const prompt = lastUserMessage.content;

  message.channel.send(`Storing the user message in the database...`);
  // Store the user message in the database
  storeUserMessage(username, prompt);

  message.channel.send(`Generating AI response based on the messages...`);
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

  message.channel.send(`Adding the AI response to the message chain...`);
  // add the AI response to the message chain
  messages.push({
    role: "assistant",
    content: aiResponse,
  });

  message.channel.send(`Making a memory about the interaction and storing it in the database...`);
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

