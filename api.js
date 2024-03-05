const express = require("express");
const app = express();
const { processMessageChain } = require("./src/chain");
// const net = require('net');
const logger = require("./src/logger.js")("api");
require("dotenv").config();

const apiFront = "https://public.missiveapp.com/v1";
const apiKey = process.env.MISSIVE_API_KEY;
const port = process.env.EXPRESS_PORT;
const BOT_NAME = process.env.BOT_NAME;

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

app.post("/api/missive-reply", async (req, res) => {
  const body = req.body;
  const webhookDescription = `${body?.rule?.description}`;
  // const message = req.body.message;
  const username = req.body.username || "API User";
  const conversationId = req.body.conversation.id;

  const processedMessage = await processMessageChain(
    [
      {
        role: "user",
        content: `New data received from webhook: ${webhookDescription} \n ${req.body.message}`,
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
          // title: "Coach Artie",
          title: BOT_NAME,
          // body: lastMessage.content,
          // body: "Hello from Coach Artie!",
          body: lastMessage.content,
        },
        text: lastMessage.content,
        // username: "Coach Artie",
        username: BOT_NAME,
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
