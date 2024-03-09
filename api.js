const express = require("express");
const app = express();
const { processMessageChain } = require("./src/chain");
const {
  getChannelMessageHistory,
  storeUserMessage,
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
    username
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
    { username }
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

  const options = {
    method: "GET",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
  };

  const response = await fetch(url, options);
  const data = await response.json();
  // add a 1ms delay to avoid rate limiting
  await new Promise((resolve) => setTimeout(resolve, 1000));
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

  const conversationMessages = await listMessages(conversationId);

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

  const allImageAttachments = conversationMessages.messages
    .map((m) => m.attachments)
    .flat()
    // then we filter to extensions that vision can handle
    .filter((a) => ["png", "jpg", "jpeg", "pdf"].includes(a.extension));

  logger.info(`Found ${allImageAttachments.length} image attachments`);

  // TODO: Do this for audio, and pass the audio to the speech-to-text API

  // now we loop through the image attachments and turn them into text with ./src/vision.js
  // TODO: We should cache these somewhere, so we don't have to process them every time
  // We could also store the description as a memory tied to the resource ID, and look up all memories regarding that resource ID when we get new messages
  const imageTexts = await Promise.all(
    allImageAttachments.map(async (a) => {
      logger.info(`Processing image attachment ${a.id}`);
      const imageDescription = await fetchImageDescription(a.url);
      logger.info(`Image attachment ${a.id} description: ${imageDescription}`);

      // return imageDescription;
      // we need to return the ID of the image along with the description
      return `Attachment ${a.id}: ${imageDescription}`;
    })
  );

  let formattedMessages = []; // the array of messages we will send to processMessageChain

  // now we add the image IDs and their descriptions to the formattedMessages array
  formattedMessages = imageTexts.map((t) => {
    return {
      role: "user",
      content: t,
    };
  });

  const contextMessages = await getChannelMessageHistory(conversationId);

  formattedMessages = contextMessages.map((m) => {
    return {
      role: "user",
      content: m.value,
    };
  });

  // TODO: Check if any of the messages have attachments, and if they do, we need to run them through GPT-4 vision and turn them into text

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
      { username, channel: conversationId, guild: "missive" }
    );
  } catch (error) {
    res
      .status(500)
      .json({ error: "Internal Server Error: Error processing message" });
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
