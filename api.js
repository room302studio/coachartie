const express = require("express");
const app = express();
const {
  getChannelMessageHistory,
  hasRecentMemoryOfResource,
  hasMemoryOfResource,
  getResourceMemories,
  storeUserMemory,
} = require("./src/remember.js");
const vision = require("./src/vision.js");
// const net = require('net');
const { createHmac } = require("crypto");
const logger = require("./src/logger.js")("api");
const { getMessage } = require("./src/missive.js");
require("dotenv").config();

const apiFront = "https://public.missiveapp.com/v1";
const apiKey = process.env.MISSIVE_API_KEY;
const port = process.env.EXPRESS_PORT;
const BOT_NAME = process.env.BOT_NAME;

app.use(express.json());

const server = app.listen(port, "0.0.0.0", () => {
  logger.info(`Server is running on port ${port}`);
});

server.on("error", (err) => {
  if (err.code === "EADDRINUSE") {
    logger.info(`Port ${port} is in use, trying with port ${++port}`);
    server.close();
    server.listen(port);
  }
});

async function listMessages(emailMessageId) {
  let url = `${apiFront}/conversations/${emailMessageId}/messages`;

  logger.info(`Fetching messages from ${url}`);

  const options = {
    method: "GET",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
  };

  const response = await fetch(url, options);
  const data = await response.json();

  // logger.info(`Data: ${JSON.stringify(data)}`);
  return data.messages;
}

function processWebhookPayload(payload) {
  const userMessage = payload.comment.body;
  const userName = payload.userName;
  const userEmail = payload.userEmail;
  const conversationId = payload.conversationId;
  const attachments = payload.attachments;
  const hasEmailMessages = payload.hasEmailMessages;
  const webhookTimestamp = payload.webhookTimestamp;
  const ruleName = payload.ruleName;
  const ruleType = payload.ruleType;

  const simplifiedPayload = {
    userMessage,
    userName,
    userEmail,
    conversationId,
    attachments,
    hasEmailMessages,
    webhookTimestamp,
    ruleName,
    ruleType,
  };

  if (hasEmailMessages) {
    simplifiedPayload.emailMessageCount = payload.emailMessageCount;

    if (payload.conversationContext) {
      simplifiedPayload.conversationContext = payload.conversationContext;
    }
  }

  if (payload.conversationLabels) {
    simplifiedPayload.conversationLabels = payload.conversationLabels;
  }

  if (payload.conversationSubject) {
    simplifiedPayload.conversationSubject = payload.conversationSubject;
  }

  return simplifiedPayload;
}

async function processMissiveRequest(body) {
  // Require the processMessageChain function from the chain module
  const { processMessageChain } = await require("./src/chain");

  // Initialize an empty array to store formatted messages
  let formattedMessages = [];

  // Extract the webhook description from the request body
  const webhookDescription = `${body?.rule?.description}`;

  // Extract the username from the comment author's email or use "API User" as a default
  const username = body.comment.author.email || "API User";

  // Extract the conversation ID from the request body
  const conversationId = body.conversation.id;

  // Process the webhook payload using the processWebhookPayload function
  const simplifiedPayload = processWebhookPayload(body);

  // Check if there are any attachments in the comment
  const attachment = body.comment.attachment;

  if (attachment) {
    // Extract the resource ID from the attachment
    const resourceId = attachment.id;

    // Check if there are any memories of the resource in the database
    const isInMemory = await hasMemoryOfResource(resourceId);

    if (!isInMemory) {
      // If there are no memories of the resource, fetch the attachment description using the vision API
      try {
        // Set the image URL for the vision API
        vision.setImageUrl(body.comment.attachment.url);

        // Fetch the attachment description using the vision API
        const attachmentDescription = await vision.fetchImageDescription();

        // Use the Missive conversationId as the channel
        // Store the attachment description as a memory in the database
        await storeUserMemory(
          { username, channel: conversationId, guild: "missive" },
          `Attachment ${body.comment.attachment.filename}: ${attachmentDescription}`,
          "attachment",
          resourceId
        );

        // Add the attachment description to the formatted messages array
        formattedMessages.push({
          role: "user",
          content: `Attachment ${body.comment.attachment.filename}: ${attachmentDescription}`,
        });
      } catch (error) {
        // Log any errors that occur during image processing
        logger.error(`Error processing image: ${error.message}`);
      }
    } else {
      try {
        // If there are memories of the resource, fetch them from the database
        const resourceMemories = await getResourceMemories(resourceId);

        // Add the resource memories to the formatted messages array
        formattedMessages.push(
          ...resourceMemories.map((m) => {
            return {
              role: "user",
              content: m.value,
            };
          })
        );
      } catch (error) {
        // Log any errors that occur during fetching resource memories
        logger.error(`Error fetching resource memories: ${error.message}`);
      }
    }
  } else {
    // Log if no attachment is found in the comment
    // logger.info(`No attachment found in body.comment`);
  }

  // Fetch the context messages for the conversation from the database
  const contextMessages = await getChannelMessageHistory(conversationId);

  // Add the context messages to the formatted messages array
  formattedMessages.push(
    ...contextMessages.map((m) => {
      const obj = {
        role: "user",
        content: `#### Contextual message in conversation:\n${m.content}`,
      };
      return obj;
    })
  );

  // Add the webhook description to the formatted messages array as a system message
  formattedMessages.push({
    role: "system",
    content: `Webhook description: ${webhookDescription}`,
  });

  // Add the webhook contents to the formatted messages array as a user message
  formattedMessages.push({
    role: "user",
    content: `During this conversation, I might reference some of this information: ${jsonToMarkdownList(
      body
    )}`,
  });

  // Remove any embedding objects from the formatted messages
  for (const message of formattedMessages) {
    if (message.embedding) {
      delete message.embedding;
    }
  }

  let processedMessage;

  try {
    // Construct the final message chain by combining the formatted messages and the user's message
    const allMessages = [
      ...formattedMessages,
      {
        role: "user",
        content: `<${username}> \n ${simplifiedPayload.userMessage}`,
      },
    ];

    // Process the message chain using the processMessageChain function
    processedMessage = await processMessageChain(allMessages, {
      username,
      channel: conversationId,
      guild: "missive",
    });
  } catch (error) {
    // Log any errors that occur during message chain processing
    logger.error(`Error processing message chain: ${error.message}`);
    res
      .status(500)
      .json({ error: `Error processing message chain: ${error.message}` });
  }

  // Extract the last message from the processed message chain
  const lastMessage = processedMessage[processedMessage.length - 1];

  // POST the response back to the Missive API using the conversation ID
  const responsePost = await fetch(`${apiFront}/posts/`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      posts: {
        conversation: conversationId,
        notification: {
          title: BOT_NAME,
          body: "",
        },
        username: BOT_NAME,
        markdown: lastMessage.content,
      },
    }),
  });

  // Log the response status and body from the Missive API
  logger.info(`Response post status: ${responsePost.status}`);
  logger.info(`Response post body: ${JSON.stringify(responsePost)}`);
}

app.post("/api/missive-reply", async (req, res) => {
  const passphrase = process.env.WEBHOOK_PASSPHRASE; // Assuming PASSPHRASE is the environment variable name
  // Generate HMAC hash of the request body to verify authenticity
  const hmac = createHmac("sha256", passphrase);
  const reqBodyString = JSON.stringify(req.body);
  hmac.update(reqBodyString);
  const hash = hmac.digest("hex");

  // log the headers
  logger.info("Request headers:" + JSON.stringify(req.headers));
  const signature = `${req.headers["x-hook-signature"]}`;
  // logger.info("HMAC signature:" + signature);
  // logger.info("Computed HMAC hash:" + hash);

  const hashString = `sha256=${hash}`;
  // Compare our hash with the signature provided in the request
  if (hashString !== signature) {
    logger.info("HMAC signature check failed");
    return res.status(401).send("Unauthorized request");
  } else {
    logger.info("HMAC signature check passed");
  }

  // missive spams us if we take longer than 15 seconds to respond
  // so here you go
  logger.info(`Sending 200 response`);

  res.status(200).end();

  processMissiveRequest(req.body)
    .then(() => {
      logger.info(`Message processed`);
    })
    .catch((error) => {
      logger.error(`Error processing message: ${error.message}`);
    });
});

app.post("/api/message", async (req, res) => {
  const { password, message, username } = req.body;
  const passphrase = process.env.WEBHOOK_PASSPHRASE;

  const { processMessageChain } = await require("./src/chain");

  // Verify the password
  if (password !== passphrase) {
    logger.error(`Password does not match passphrase`);
    return res.status(401).send("Unauthorized request");
  }

  try {
    // Process the message chain
    const processedMessage = await processMessageChain(
      [
        {
          role: "user",
          content: message,
        },
      ],
      { username }
    );

    console.log(`Processed message: ${JSON.stringify(processedMessage)}`);

    // const lastMessage = processedMessage[processedMessage.length - 1];
    const lastMessage = processedMessage.finalContent;

    console.log(`Last message: ${JSON.stringify(lastMessage)}`);
    res.status(200).json({ response: lastMessage });
  } catch (error) {
    logger.error(`Error processing message: ${error.message}`);
    res
      .status(500)
      .json({ error: `Error processing message: ${error.message}` });
  }
});

app.post("/api/webhook-prompt", async (req, res) => {
  const { getPromptsFromSupabase } = require("./helpers.js");
  const { processMessageChain } = await require("./src/chain.js");

  // this is will be an authorized call from pgcron to send a request to the robot as if a user sent, but specifiying a prompt from the prompts table to use

  const passphrase = process.env.WEBHOOK_PASSPHRASE; // Assuming PASSPHRASE is the environment variable name

  logger.info(JSON.stringify(req.body));

  // use basicauth to make sure passphrase in body matches passphrase in env
  let payloadPassword = req.body.password;
  if (payloadPassword !== passphrase) {
    logger.error(`Password does not match passphrase`);
    return res.status(401).send("Unauthorized request");
  }

  // send a 200 response
  res.status(200).end();

  // Send body.content to the robot as if it were a user message
  const message = req.body.content;
  const username = req.body.username || "PGCron Webhook";
  const promptSlug = req.body.promptSlug;

  // get the prompt from the prompt table
  const allPrompts = await getPromptsFromSupabase();

  logger.info(`All prompts: ${JSON.stringify(allPrompts)}`);

  // look for the prompt slug in allPrompts
  // let prompt = allPrompts.find((p) => p.slug === promptSlug);

  let prompt = allPrompts[promptSlug];

  logger.info(`Prompt: ${JSON.stringify(prompt)}`);

  // if prompt is null / undefined make it an empty string
  if (!prompt) {
    prompt = "";
  }

  const processedMessage = await processMessageChain(
    [
      {
        role: "user",
        // content: message,
        content: `${prompt.prompt_text} \n ${message}`,
      },
    ],
    { username }
  );

  logger.info(`Processed message: ${JSON.stringify(processedMessage)}`);
});

function jsonToMarkdownList(jsonObj, indentLevel = 0) {
  let str = "";
  const indentSpaces = " ".repeat(indentLevel * 2);

  for (const key in jsonObj) {
    const value = jsonObj[key];

    if (typeof value === "object" && value !== null) {
      str += `${indentSpaces}- **${key}**:\n${jsonToMarkdownList(
        value,
        indentLevel + 1
      )}`;
    } else {
      str += `${indentSpaces}- ${key}: ${value}\n`;
    }
  }

  return str;
}
