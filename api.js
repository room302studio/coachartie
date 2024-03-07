const express = require("express");
const app = express();
const { processMessageChain } = require("./src/chain");
const { getChannelMessageHistory } = require("./src/remember.js");
// const net = require('net');
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
  const body = req.body;
  const webhookDescription = `${body?.rule?.description}`;
  // const message = req.body.message;
  const username = req.body.username || "API User";
  const conversationId = req.body.conversation.id;

  // We need to store every message we receive along with the conversation ID
  // So that when we see another webhook with this conversationId
  // we can pull all the previous messages for context
  await storeUserMessage(
    { username, channel: conversationId, guild: "missive" },
    req.body.message
  );

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

  const contextMessages = await getChannelMessageHistory(conversationId);

  // We need to take the list of conversation messages from missive and turn them into a format that works for a message chain

  const formattedMessages = contextMessages.map((m) => {
    return {
      role: "user",
      content: m.value,
    };
  });

  formattedMessages.push({
    role: "user",
    content: `New data received from webhook: ${webhookDescription} \n ${req.body.message}`,
  });

  const processedMessage = await processMessageChain(
    [
      {
        role: "user",
        content: `New user interaction through webhook: ${webhookDescription} \n ${userMessage}`,
      },
    ],
    username
  );

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
        // body: processedMessage,
        notification: {
          title: "Coach Artie",
          // body: lastMessage.content,
          // body: "Hello from Coach Artie!",
          body: lastMessage.content,
        },
        text: lastMessage.content,
        username: "Coach Artie",
      },
    }),
  });

  // if the response post was successful, we can return a 200 response, otherwise we send back the error
  res.status(200).end();

  // if (responsePost.status === 200) {
  //   res.status(200).end();
  // } else {
  //   // we need to parse the error and send it back
  //   const error = await responsePost.json();
  //   res
  //     .status(500)
  //     .send(`Error sending response to Missive: ${JSON.stringify(error)}`)
  //     .end();
  // }
});
