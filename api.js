const express = require('express');
const app = express();
const { processMessageChain } = require("./src/chain")
// const net = require('net');

app.use(express.json());

const basicAuth = require('express-basic-auth');
app.use(basicAuth({
    users: { 'admin': 'supersecret' },
    challenge: true
}));

app.post('/api/message', async (req, res) => {
  const message = req.body.message;
  const username = req.body.username || 'API User';

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

app.post('/api/message-image', async (req, res) => {
  const message = req.body.message;
  const image = req.body.image;
  const username = req.body.username || 'API User';

  const processedMessage = await processMessageChain(
    [
      {
        role: "user",
        content: message,
        image: image
      },
    ],
    username
  );

  res.json({ response: processedMessage });
});

let port = 8080;
const server = app.listen(port, '0.0.0.0', () => {
  console.log(`Server is running on port ${port}`);
});

server.on('error', (err) => {
  if (err.code === 'EADDRINUSE') {
    console.log(`Port ${port} is in use, trying with port ${++port}`);
    server.close();
    server.listen(port);
  }
});
