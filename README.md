# Coach Artie Discord Bot

Hello and welcome to the repository of Coach Artie, the hyper-intelligent AI assistant for the [Room 302 Studio](https://www.room302.studio/). This repository specifically contains the code for the integration of Coach Artie with Discord.

## About Coach Artie

Coach Artie is an advanced AI assistant that facilitates collaboration, helps answer questions, and sources resources to support the members of Room 302 Studio - a creative space dedicated to cultivating innovative projects and ideas. Created by EJ, Ian and Curran of Room 302 with a deep care for the emotional state of the studio members, Coach Artie's goal is promoting a growth-conscious and explorative learning environment. 

## Features

1. **Information Storage:** Coach Artie can remember key details from past interactions, providing a personalized support experience.
2. **Versatile Capabilities:** from fetching URL summaries, integrating with Google Drive, to generating pytorch-friendly code snippets, Coach Artie showcases a wide array of skills.
3. **Ease of Communication:** by joining your Discord server, Coach Artie can seamlessly engage with the studio members in real-time.

## Code Overview

The codebase is primarily divided into three main files: `discord.js`, `capabilities.js`, and `chain.js`.

`discord.js` is responsible for setting up the Discord bot client, handling message creation events, and sending messages or embed messages to the Discord server. It also includes functions to detect if the bot was mentioned or if the channel name includes a bot.

`capabilities.js` contains the definitions of the bot's capabilities. It includes a regex for identifying capability calls, a function for calling capability methods, and a prompt for informing the bot about its capabilities.

`chain.js` is responsible for processing message chains. It includes functions for processing messages, processing capabilities, and getting capability responses. It also handles token limits and generates AI responses based on the result of the capability processing.

## Getting Started

This section is a placeholder for instructions on how to get a copy of the project running on your local machine for development and testing purposes. 

## Contributing

Feel open to contribute and make a pull request. If you have any questions, feel welcome to raise an issue or contact the maintainers.

