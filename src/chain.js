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

async function getCapabilityResponse(capSlug, capMethod, capArgs) {
  let capabilityResponse;
  try {
    // Step 1: Call the capability method and retrieve the response
    capabilityResponse = await callCapabilityMethod(
      capSlug,
      capMethod,
      capArgs
    );
  } catch (e) {
    console.error(e);
    // Step 2: Handle errors and provide a default error response
    capabilityResponse = "Capability error: " + e;
  }

  // Step 3: Trim the capability response if needed to fit within the token limit
  return trimResponseIfNeeded(capabilityResponse);
}

async function processCapability(messages, capabilityMatch) {
  // Get the capability arguments from the regex
  const [_, capSlug, capMethod, capArgs] = capabilityMatch;
  // Calculate the current token count in the message chain
  const currentTokenCount = countMessageTokens(messages);

  // Check if the message chain is about to exceed the token limit
  if (currentTokenCount >= TOKEN_LIMIT - WARNING_BUFFER) {
    messages.push(createTokenLimitWarning());
  }

  // Process the capability and add the system response
  const capabilityResponse = await getCapabilityResponse(
    capSlug,
    capMethod,
    capArgs
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
    console.log("🤖 Processing empty message chain...");
    return [];
  }

  // Display typing indicator
  const typingInterval = displayTypingIndicator(message);

  // Get the last message in the chain
  let lastMessage = messages[messages.length - 1].content;

  // Process the message chain as long as the last message contains a capability call
  do {
    // Process the message
    messages = await processMessage(message, messages, lastMessage, username);

    // Update the last message
    lastMessage = messages[messages.length - 1].content;
  } while (
    doesMessageContainCapability(lastMessage) &&
    !isExceedingTokenLimit(messages)
  );

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
      messages = await processCapability(messages, capabilityMatch);
    } catch (error) {
      messages.push({
        role: "system",
        content: `Error processing capability: ${error}`,
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
  generateAndStoreRememberCompletion(prompt, aiResponse, username);

  // Return the updated messages
  return messages;
}

module.exports = {
  processMessageChain,
  processMessage,
  processCapability,
};
