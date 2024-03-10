const express = require("express");
const app = express();
const { processMessageChain } = require("./src/chain");
const {
  getChannelMessageHistory,
  hasRecentMemoryOfResource,
  hasMemoryOfResource,
} = require("./src/remember.js");
const vision = require("./vision.js");
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
  /* 
  {"messages":[{"id":"72f9162e-22cd-4f11-ae91-0b2223f688b1","subject":"[FYI] HubSpot is launching a new pricing model","preview":"Please read to learn what this means for your account as an existing customer.","type":"email","delivered_at":1709661736,"updated_at":1709661751,"created_at":1709661751,"email_message_id":"<1709661726112.203e1867-4f38-4c3e-b30f-18a4cca232e1@bf1.hubspot.com>","in_reply_to":[],"references":[],"from_field":{"name":"The HubSpot Team","address":"pricing@hubspot.com"},"to_fields":[{"name":null,"address":"ejfox@room302.studio"}],"cc_fields":[],"bcc_fields":[],"reply_to_fields":[{"name":null,"address":"pricing@hubspot.com"}],"attachments":[],"author":null}]}
  */
  return data.messages;
}

app.post("/api/missive-reply", async (req, res) => {
  const passphrase = process.env.WEBHOOK_PASSPHRASE; // Assuming PASSPHRASE is the environment variable name
  const body = req.body;
  // the webhook description explains why the webhook was triggered
  const webhookDescription = `${body?.rule?.description}`;
  const username = body.comment.author.email || "API User";
  // the conversationID is the ID of the conversation that the webhook was triggered from and is used to look up other messages in the conversation outside of the webhook
  const conversationId = body.conversation.id;

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

  logger.info(`Body: ${JSON.stringify(body)}`);

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

  logger.info(
    `${conversationMessages.length} messages found in conversation ${conversationId}`,
  );
  logger.info(`Conversation messages: ${JSON.stringify(conversationMessages)}`);
  logger.info(
    `${conversationMessages.length} messages found in conversation ${conversationId}`,
  );

  let formattedMessages = []; // the array of messages we will send to processMessageChain

  // check for any attachments in any of the conversation messages also
  // and if there are any memories of them, add them to the formattedMessages array
  conversationMessages.forEach((message) => {
    logger.info(`Checking message ${message.id} for attachments`);
    const attachments = message.attachment;
    // log the keys available in message
    logger.info(`Message keys: ${Object.keys(message)}`);
    logger.info(`Attachments: ${JSON.stringify(attachments)}`);
    if (attachments) {
      attachments.forEach(async (attachment) => {
        const resourceId = attachment.id;
        logger.info(`Checking for memories of resource ${resourceId}`);
        const isInMemory = await hasRecentMemoryOfResource(resourceId); // check if we have ANY memory of this resource
        if (isInMemory) {
          logger.info(
            `Memory of resource ${resourceId} found, adding to formattedMessages`,
          );
          // if it is in the memory, let's grab all of the memories of it and add them to the formattedMessages array
          const resourceMemories = await getResourceMemories(resourceId);
          logger.info(
            `${resourceMemories.length} memories found for resource ${resourceId}`,
          );
          formattedMessages.push(
            ...resourceMemories.map((m) => {
              return {
                role: "system",
                content: m.value,
              };
            }),
          );
        } else {
          logger.info(`No memory of resource ${resourceId} found`);
          // TODO: MAKE A MEMORY OF IT THEN!
        }
      });
    }
  });

  // there might be an attachment in body.comment.attchment
  const attachment = body.comment.attachment;
  // logger.info(`Attachment: ${JSON.stringify(attachment)}`);

  if (attachment) {
    logger.info(`Attachment found: ${JSON.stringify(attachment)}`);

    const resourceId = attachment.id;

    logger.info(`Checking for memories of resource ${resourceId}`);
    const isInMemory = await hasMemoryOfResource(resourceId); // check if we have ANY memory of this resource

    logger.info(`isInMemory: ${isInMemory} resourceId: ${resourceId}`);

    if (!isInMemory) {
      logger.info(
        `No memory of resource ${resourceId} found, fetching description ${attachment.url}`,
      );
      // we don't have any memory of this resource, so we need to store it
      // we need to use the vision API to get a description of the image
      try {
        vision.setImageUrl(body.comment.attachment.url);
        const attachmentDescription = await vision.fetchImageDescription();

        logger.info(`Attachment description: ${attachmentDescription}`);

        // form a memory of the resource
        await storeUserMemory(
          { username, channel: conversationId, guild: "missive" },
          attachmentDescription,
          "attachment",
          resourceId,
        );

        // add the description of the attachment to the formattedMessages array
        formattedMessages.push({
          role: "system",
          content: `The user sent an attachment along with the message: ${attachmentDescription}`,
        });
      } catch (error) {
        logger.error(`Error processing image: ${error.message}`);
      }
    } else {
      logger.info(
        `Memory of resource ${resourceId} found, adding to formattedMessages`,
      );
    }

    try {
      // if it is in the memory, let's grab all of the memories of it and add them to the formattedMessages array
      const resourceMemories = await getResourceMemories(resourceId);
      logger.info(
        `${resourceMemories.length} memories found for resource ${resourceId}`,
      );
      formattedMessages.push(
        ...resourceMemories.map((m) => {
          return {
            role: "system",
            content: m.value,
          };
        }),
      );
    } catch (error) {
      logger.error(`Error fetching resource memories: ${error.message}`);
    }

    try {
      // if it is in the memory, let's grab all of the memories of it and add them to the formattedMessages array
      const resourceMemories = await getResourceMemories(resourceId);
      logger.info(
        `${resourceMemories.length} memories found for resource ${resourceId}`,
      );
      formattedMessages.push(
        ...resourceMemories.map((m) => {
          return {
            role: "system",
            content: m.value,
          };
        }),
      );
    } catch (error) {
      logger.error(`Error fetching resource memories: ${error.message}`);
    }
  } else {
    logger.info(`No attachment found in body.comment`);
  }
  const contextMessages = await getChannelMessageHistory(conversationId);
  logger.info(
    `${contextMessages.length} context messages found in conversation ${conversationId}`,
  );

  formattedMessages.push({
    role: "user",
    content: `${webhookDescription}: <${username}> \n ${userMessage}`,
  });

  // make the last message the user message
  formattedMessages.push({
    role: "user",
    content: `${webhookDescription}: <${username}> \n ${userMessage}`,
  });

  logger.info(`Formatted messages: ${JSON.stringify(formattedMessages)}`);

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

  logger.info(`Response post status: ${responsePost.status}`);
  logger.info(`Response post body: ${JSON.stringify(responsePost)}`);

  // if the response post was successful, we can return a 200 response, otherwise we send back the error in the place it happened
  res.status(200).end();
});
