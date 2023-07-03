/* an extraordinarily basic express web interface that provides access to the artie.log file */
const express = require('express');
const app = express();
const fs = require('fs');
const path = require('path');

// 🌿 dotenv: a lifeline for using environment variables
const dotenv = require("dotenv");
dotenv.config();

const port = process.env.PORT || 8080;

app.get('/', (req, res) => {
  // res.sendFile(path.join(__dirname, 'artie.log'));
  /* add a basic web page skeleton with tachyons and the contents of the log file in a div */
  fs.readFile(path.join(__dirname, 'artie.log'), 'utf8', (err, data) => {
    if (err) {
      console.error(err);
      res.status(500).send('Something went wrong');
    } else {
      res.send(`
        <html>
          <head>
            <title>Artie Log</title>
            <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/tachyons/4.11.1/tachyons.min.css">
          </head>
          <body class="pa5 sans-serif">
            <h1>Artie Log</h1>
            <div class="mw9 center ph3-ns">
              <div class="cf ph2-ns">
                <div class="fl w-100 w-50-ns pa2">
                    <pre>${data}</pre>
                </div>
              </div>
            </div>
          </body>
        </html>
      `);
    }
  })
})

app.listen(port, () => {
  console.log(`Example app listening at http://localhost:${port}`)
})
