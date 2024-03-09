const express = require("express");
const app = express();
const { processMessageChain } = require("./src/chain");
const {
  getChannelMessageHistory,
  hasRecentMemoryOfResource
} = require("./src/remember.js");
// const net = require('net');
const { createHmac } = require("crypto");
const logger = require("./src/logger.js")("api");
require("dotenv").config();

const apiFront = "https://public.missiveapp.com/v1";
const apiKey = process.env.MISSIVE_API_KEY;

const port = process.env.EXPRESS_PORT;

app.use(express.json());

// const basicAuth = require("express-basic-auth");
// app.use(
//   basicAuth({
//     users: { admin: "supersecret" },
//     challenge: true,
//   })
// );

/* Basic, simple Coach Artie messaging */

app.post("/api/message", async (req, res) => {
  const message = req.body.message;
  const username = req.body.username || "API User";

  const processedMessage = await processMessageChain(
    [
      {
        role: "user",
        content: message,
      },
    ],
    username,
  );

  res.json({ response: processedMessage });
});

app.post("/api/message-image", async (req, res) => {
  const message = req.body.message;
  const image = req.body.image;
  const username = req.body.username || "API User";

  const processedMessage = await processMessageChain(
    [
      {
        role: "user",
        content: message,
        image: image,
      },
    ],
    { username },
  );

  res.json({ response: processedMessage });
});

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

/* These are endpoints to interact with Missive- we will have one endpoint that simply "receives" information, parses it and adds it to memory 

Then we will also have a second endpoint that does all of the above, and then gets the message ID and uses POST to send the response to the location the webhook came from */

// app.post("/api/missive-read", async (req, res) => {
//   const username = req.body.username || "API User";

//   const body = req.body;
//   const webhookDescription = `${body?.rule?.description}`;

//   await processMessageChain(
//     [
//       {
//         role: "user",
//         content: `New data received from webhook: ${webhookDescription} \n ${req.body.message}`,
//       },
//     ],
//     username
//   );

//   // res.json({ response: processedMessage });
//   // just give a 200 response
//   res.status(200).end();
// });

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

  logger.info(`Data: ${JSON.stringify(data)}`);
  return data;
}

app.post("/api/missive-reply", async (req, res) => {
  const passphrase = process.env.WEBHOOK_PASSPHRASE; // Assuming PASSPHRASE is the environment variable name
  const body = req.body;
  const webhookDescription = `${body?.rule?.description}`;
  const username = body.comment.author.email || "API User";
  const conversationId = body.conversation.id;

  // Generate HMAC hash of the request body to verify authenticity
  const hmac = createHmac("sha256", passphrase);
  const reqBodyString = JSON.stringify(req.body);
  hmac.update(reqBodyString);
  const hash = hmac.digest("hex");

  // log the headers
  logger.info("Request headers:" + JSON.stringify(req.headers));

  const signature = `${req.headers["x-hook-signature"]}`;

  logger.info("HMAC signature:" + signature);
  logger.info("Computed HMAC hash:" + hash);

  const hashString = `sha256=${hash}`;

  // Compare our hash with the signature provided in the request
  if (hashString !== signature) {
    logger.info("HMAC signature check failed");
    return res.status(401).send("Unauthorized request");
  } else {
    logger.info("HMAC signature check passed");
  }

  // the user message might be in body.comment.message
  // or it might be in body.comment.body
  let userMessage;
  if (body.comment.message) {
    userMessage = body.comment.message;
  } else if (body.comment.body) {
    userMessage = body.comment.body;
  } else {
    userMessage = JSON.stringify(body);
  }

  // we also need to check if there is an attachment, and if there is, we need to process it and turn it into text

  logger.info(`Looking for messages in conversation ${conversationId}`);
  const conversationMessages = await listMessages(conversationId);
  logger.info(`${conversationMessages.length} messages found in conversation ${conversationId}`);

  logger.info(`${conversationMessages.length} messages found in conversation ${conversationId}`);

  /*       "attachments": [
        {
          "id": "81eed561-4908-4738-9a9f-2da886b1de43",
          "filename": "inline-image.png",
          "extension": "png",
          "url": "https://...",
          "media_type": "image",
          "sub_type": "png",
          "size": 114615,
          "width": 668,
          "height": 996
        }
      ] */

  let formattedMessages = []; // the array of messages we will send to processMessageChain


  // check for any attachments in any of the conversation messages also
  // and if there are any memories of them, add them to the formattedMessages array
  conversationMessages.forEach((message) => {
    logger.info(`Checking message ${message.id} for attachments`);
    const attachments = message.attachments;
    if (attachments) {
      attachments.forEach(async (attachment) => {
        const resourceId = attachment.id;
        const isInMemory = await hasRecentMemoryOfResource(resourceId); // check if we have ANY memory of this resource
        if (isInMemory) {
          logger.info(`Memory of resource ${resourceId} found, adding to formattedMessages`);
          // if it is in the memory, let's grab all of the memories of it and add them to the formattedMessages array
          const resourceMemories = await getResourceMemories(resourceId);
          logger.info(`${resourceMemories.length} memories found for resource ${resourceId}`);
          formattedMessages.push(...resourceMemories.map((m) => {
            return {
              role: "system",
              content: m.value,
            };
          }));
        }
      });
    }
  })


  // there might be an attachment in body.comment.attchment
  const attachment = body.comment.attachment
  if (attachment) {
    logger.info(`Attachment found: ${JSON.stringify(body.comment.attachment)}`);


    const resourceId = attachment.id;

    const isInMemory = await hasMemoryOfResource(resourceId); // check if we have ANY memory of this resource

    logger.info(`isInMemory: ${isInMemory} resourceId: ${resourceId}`)

    if(!isInMemory) {
      logger.info(`No memory of resource ${resourceId} found, fetching description`);
      // we don't have any memory of this resource, so we need to store it
      // we need to use the vision API to get a description of the image
      const attachmentDescription = await fetchImageDescription(
        body.comment.attachment.url,
      );

      logger.info(`Attachment description: ${attachmentDescription}`);

      // form a memory of the resource
      await storeUserMemory(
        { username, channel: conversationId, guild: "missive" },
        attachmentDescription,
        "attachment",
        resourceId
      );

      // add the description of the attachment to the formattedMessages array
      formattedMessages.push({
        role: "system",
        content: `The user sent an attachment along with the message: ${attachmentDescription}`,
      });
    }

    // if it is in the memory, let's grab all of the memories of it and add them to the formattedMessages array
    const resourceMemories = await getResourceMemories(resourceId);
    logger.info(`${resourceMemories.length} memories found for resource ${resourceId}`);
    formattedMessages.push(...resourceMemories.map((m) => {
      return {
        role: "system",
        content: m.value,
      };
    }));

  }
  const contextMessages = await getChannelMessageHistory(conversationId);
  logger.info(`${contextMessages.length} context messages found in conversation ${conversationId}`);

  formattedMessages = contextMessages.map((m) => {
    return {
      role: "user",
      content: m.value,
    };
  });

  // make the last message the user message
  formattedMessages.push({
    role: "user",
    content: `${webhookDescription}: <${username}> \n ${userMessage}`,
  });

  logger.info("Formatted messages", JSON.stringify(formattedMessages));

  let processedMessage;

  try {
    processedMessage = await processMessageChain(
      [
        {
          role: "user",
          content: `New user interaction through webhook: ${webhookDescription} \n ${userMessage}`,
        },
      ],
      { username, channel: conversationId, guild: "missive" },
    );
  } catch (error) {
    res
      .status(500)
      .json({ error: `Error processing message chain: ${error.message}` });
  }

  const lastMessage = processedMessage[processedMessage.length - 1];

  console.log("lastMessage", lastMessage);

  // Now we need to POST the response back to the Missive API using the conversationId
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
          title: "Coach Artie",
          body: lastMessage.content,
        },
        text: lastMessage.content,
        username: "Coach Artie",
      },
    }),
  });

  // if the response post was successful, we can return a 200 response, otherwise we send back the error in the place it happened
  res.status(200).end();
});
