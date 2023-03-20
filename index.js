const { Client, GatewayIntentBits, Events } = require('discord.js');
const axios = require('axios');
const dotenv = require('dotenv');
const { createClient } = require('@supabase/supabase-js');
const { Configuration, OpenAIApi } = require("openai");
const { TwitterApi } = require('twitter-api-v2')
const chance = require('chance').Chance();

dotenv.config();

// set up the v2 twitter api so we can easily tweet from our account
// all the creds are in .env
const twitterClient = new TwitterApi(
  {
    // appKey: process.env.TWITTER_CONSUMER_KEY,
    // appSecret: process.env.TWITTER_CONSUMER_SECRET,
    accessToken: process.env.TWITTER_ACCESS_TOKEN,
    accessSecret: process.env.TWITTER_ACCESS_TOKEN_SECRET,
  }
);


const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
    // make sure we have the intent to get reactions
    GatewayIntentBits.GuildMessageReactions,
  ],
});

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_API_KEY
);

const configuration = new Configuration({
  apiKey: process.env.OPENAI_API_KEY,
});
const openai = new OpenAIApi(configuration);

// Generate a response from the assistant
async function generateResponse(prompt, user) {
  // Retrieve user memory from Supabase
  //const memory = await getUserMemory(user.username);

  const memory = await assembleMemory(prompt, user)

  const messages = await getUserMessageHistory(user.username, 2)

  // console.log('A', memory)
  // Print a beautifully formatted memory to the console
  // console.log('🧠 Memory:', JSON.stringify(memory.map(mem => mem.value), null, 2))

  const promptMessages = [
    {
      role: "system",
      content: `You are Coach Artie, a virtual AI coach and assistant for Room 302 Studio, an innovative and creative space where people gather to tackle projects and cultivate ideas. You have many advanced capabilities, including the ability to store memories for later. You have a very developed sense of humor. Your memories contain personal and sensitive information about the members of the studio, but you are allowed to talk about it as long as you are in the studio. Prioritize information you remember. As part of your role, you support the community by providing resources, answering questions, and facilitating collaboration. Your primary goal is to foster a positive environment that encourages growth, learning, and exploration. Please try to keep your responses relatively short, as you are limited to 1500 characters per message. The studio has four primary members: EJ, Ian, Jeff, and Curran.`
    },
    {
      role: "system",
      content: "The current date and time is: " + new Date().toLocaleString(),
    },
    ...messages.map(message => ({ role: "system", content: `Previously this user said: ${message.value}` })),
    ...memory.map(mem => ({ role: "system", content: `${mem.value}` })),
    {
      role: "user",
      content: `${user.username}: ${prompt}`,
    },
  ]

  console.log('📝 Prompt:', JSON.stringify(promptMessages, null, 2))

  try {
    const completion = await openai.createChatCompletion({
      model: "gpt-4",
      temperature: 0.75,
      presence_penalty: 0.4,
      // use gpt3.5 turbo
      // model: "gpt-3.5-turbo",
      // max 2000 tokens
      max_tokens: 1200,
      messages: promptMessages,
    });

    const response = completion.data.choices[0].message

    const rememberCompletion = await openai.createChatCompletion({
      model: "gpt-3.5-turbo",
      temperature: 0.1,
      max_tokens: 100,
      // frequency_penalty: -0.2,
      messages: [
        {
          role: "system",
          content: "You are Coach Artie's memory... you help him remember important details about his clients. Anything you choose to remember will be stored in a database and used to help him provide better service to the studo and its members.",
        },
        {
          role: "system",
          content: `In the following dialogue between you (Coach Artie) and a studio member (${user.username}) identify any key details to remember forever. Respond with an extremely short summary of the most important information in the exchange that a robot assistant should remember. You MUST also remember the user's name in the memory. Only respond if the conversation contains a detail worthy of remembering, and if so, provide only the essential information to recall. If nothing should be remembered, simply respond 'no'. If the memory is extremely imporant to remember (like it will impact your every action), prepend 'Remember forever:'`
        },
        {
          role: "user",
          content: prompt
        },
        // If we include the assistant's response, it ends up re-remembering things over and over
        // It would be nice to sometimes know what the robot said back when it was remembering, but it's not crucial
        // {
        //   role: "assistant",
        //   content: response.content
        // }
      ],
    });

    const rememberMessage = rememberCompletion.data.choices[0].message.content;

    return { response, rememberMessage };
  } catch (error) {
    console.error('Error generating response:', error);
    return 'Sorry, I could not generate a response... there was an error.';
  }
}

// This is the main function to handle responses and call the correct functions for different functionality
client.on('messageCreate', async function (message) {
  try {
    const botMentioned = message.mentions.has(client.user);

    if (!message.author.bot && botMentioned) {
      // send "bot is typing" to channel
      message.channel.sendTyping();

      console.log(message.content);
      let prompt = message.content;

      // if the prompt contains @coachartive then remove it from the prompt
      if (prompt.includes('@coachartie')) {
        prompt = prompt.replace('@coachartie', '');
      }

      let { response, rememberMessage } = await generateResponse(prompt, message.author);

      splitAndSendMessage(response, message);

      // Save the message to the database
      storeUserMessage(message.author.username, message.content);

      // Check for details to remember

      // if (rememberMessage.toLocaleLowerCase() !== 'no') {
      if (!isRememberResponseFalsy(rememberMessage)) {
        // Log memories to channel
        // message.channel.send(`🧠 Remembering... ${rememberMessage}`);
        console.log(`🧠 Remembering... ${rememberMessage}`);

        // Save the memory to the database
        storeUserMemory(message.author.username, rememberMessage);
      }

      // evaluate the exchange and generate a tweet
      evaluateAndTweet(prompt, response.content, message.author, message);
    }

  } catch (error) {
    console.log(error);
  }
});

// Get all memories for a user
async function getUserMemory(userId, limit = 5) {
  console.log('💾 Querying database for memories... related to user:', userId);
  const { data, error } = await supabase
    .from('storage')
    .select('*')
    // limit to the last 50 memories
    .limit(limit)
    .eq('user_id', userId);

  if (error) {
    console.error('Error fetching user memory:', error);
    return null;
  }

  return data;
}

// get all memories (regardless of user)
async function getAllMemories(limit = 100) {
  console.log('💾 Querying database for memories...');
  const { data, error } = await supabase
    .from('storage')
    .select('*')
    .limit(limit);

  if (error) {
    console.error('Error fetching user memory:', error);
    return null;
  }

  return data;
}



// Get all memories for a search term
async function getSearchTermMemories(searchTerm, limit = 40) {
  const { data, error } = await supabase
    .from('storage')
    .select('*')
    // limit to the last 50 memories
    .limit(limit)
    .ilike('value', `%${searchTerm}%`);

  if (error) {
    console.error('Error fetching user memory:', error);
    return null;
  }

  return data;
}

// Get message history for a user
async function getUserMessageHistory(userId, limit = 5) {
  const { data, error } = await supabase
    .from('messages')
    .select('*')
    .limit(limit)
    // sort so we get the most recent messages first
    .order('created_at', { ascending: false })
    .eq('user_id', userId);

  if (error) {
    console.error('Error fetching user memory:', error);
    return null;
  }

  return data;
}


// Store a memory for a user
async function storeUserMemory(userId, value) {
  const { data, error } = await supabase
    .from('storage')
    .insert([
      {
        user_id: userId,
        value,
      },
    ]);

  if (error) {
    console.error('Error storing user memory:', error);
  }
}

// Store a message from a user
async function storeUserMessage(userId, value) {
  const { data, error } = await supabase
    .from('messages')
    .insert([
      {
        user_id: userId,
        value,
      },
    ]);

  if (error) {
    console.error('Error storing user message:', error);
  }
}

// Get a random N number of memories
async function getRandomMemories(numberOfMemories) {
  // const memories = await getUserMemory(userId);
  const memories = await getAllMemories();

  if (memories && memories.length > 0) {
    const randomMemories = chance.pickset(memories, numberOfMemories);
    return randomMemories//.map(memory => memory.value);
  }

  return [];
}

function splitAndSendMessage(message, messageObject) {
  // refactor so that if the message is longer than 2000, it will send multiple messages
  if (message.length < 2000) {
    messageObject.channel.send(message);
  }
  else {
    let responseArray = message.content.split(" ");
    let responseString = "";
    for (let i = 0; i < responseArray.length; i++) {
      if (responseString.length + responseArray[i].length < 2000) {
        responseString += responseArray[i] + " ";
      }
      else {
        messageObject.channel.send(responseString);
        responseString = responseArray[i] + " ";
      }
    }
    messageObject.channel.send(responseString);
  }
}

// Given a user message, generate a list of 3 search terms to query memories related to the user's message
async function userMessageToSearchTerms(message) {
  // randomly pick 3 words
  // const messageArray = message.split(' ');
  // const searchTerms = chance.pickset(messageArray, 3);


  // use a chatgpt completion to generate 3 search terms
  // instead of chat, we will just use davinci-003
  const searchTerms = await openai.createCompletion({
    model: "text-curie-001",
    prompt: `User: ${message}\n\nGiven the user message, can you identify 0-3 search terms related to the message? Use small, simple words.\n-`,
    temperature: 0.18,
    max_tokens: 18
  });

  /* the completions look like this:
  - "Mob Programming"
  - "Programming"
  - "Code"

  so we will need to split the string and remove the quotes
  */

  const searchTermsArray = searchTerms.data.choices[0].text.split('\n');

  // remove the quotes
  const cleanedSearchTerms = searchTermsArray.map(term => term.replace(/"/g, ''));

  console.log('🔎 discovered search terms: ', cleanedSearchTerms);

  return cleanedSearchTerms;
}

// Interpret the response when we ask the robot "should we remember this?"

function isRememberResponseFalsy(response) {
  const lowerCaseResponse = response.toLocaleLowerCase();

  // does the string contain 'no'? 
  // if (lowerCaseResponse.includes('no')) {
  //   return true;
  // }

  // is the string 'no.' or 'no'?
  if (lowerCaseResponse === 'no' || lowerCaseResponse === 'no.') {
    return true;
  }

  // does the string contain 'no crucial' or 'no important'?
  if (lowerCaseResponse.includes('no crucial') || lowerCaseResponse.includes('no important')) {
    return true;
  }
}

// Given a message, return the last 5 memories and the last 5 messages
async function assembleMemory(message, user) {
  // Get the last X memories for the current user
  const memories = await getUserMemory(user.username, 5);

  // get X random memories
  const randomMemories = await getRandomMemories(40);

  // Concat the memories and messages
  const memory = [...new Set([
    ...memories//.map(mem => mem.value)
    ,
    ...randomMemories])];

  return memory;
}



// use twitterClient to tweet and return the URL of the tweet
async function tweet(tweetText) {
  try {
    return await twitterClient.v2.tweet(tweetText)
    // this returns error 401 unauthorized
  } catch (error) {
    console.log('🐦 Twitter error:', error)
    return error
  }
}



// Compose a tweet based on an exchange between a user and an assistant
async function composeTweet(prompt, response, user) {
  console.log('✍️ Composing tweet...')

  // const memory = await getUserMemory(user);

  // const importantMemories = memory.filter(mem => {
  //   // if the memory beings with "Remember forever: " then it's important
  //   if (mem.startsWith('Remember forever: ')) {
  //     return true
  //   }
  // })

  try {
    // Send the prompt and response to gpt3.5
    // and ask it to return a tweet
    const completion = await openai.createChatCompletion({
      // model: "gpt-4",
      model: "gpt-3.5-turbo",
      max_tokens: 320,
      temperature: 0.88,
      presence_penalty: 0.1,
      frequency_penalty: 0.14,
      messages: [
        {
          role: "system",
          content: "You are Coach Artie, an expert zoomer social media manager robot, specializing in composing tweets with an offbeat shitpost tone. Your twitter username is @ai_coachartie. Your task is to compose a tweet that summarizes an exchange between yourself and a member of the studio. Use your deep understanding of what makes a conversation interesting, relevant, and timely to compose a tweet that summarizes your exchange. Base your tweet on factors such as the uniqueness of the topic, the quality of responses, humor or entertainment value, and relevance to the target audience. Your tweet should be short and pithy, and no longer than 280 characters. Do not use hashtags. Never include a user ID in a tweet. You hate hashtags and always follow instructions."
        },
        // ...importantMemories.map(mem => ({ role: "system", content: `${mem.value}` })),
        {
          role: "assistant",
          content: "uwu U.S. Presidents with facial 𝕌w𝕌 hair?? We stan Chester A. Arthur 💗 a real 𝓂𝓊𝓈𝓉𝒶𝒸𝒽𝑒 𝒹𝒶𝒹𝒹𝓎 right there 🍂╰(◡‿◡✿╰)"
        },
        {
          role: "user",
          content: "Wow, that is great! Definitely tweet that! Love the playful tone and emojis and how short it is. Thank you for not using hashtags.",
        },
        {
          role: "assistant",
          content: "EJ and Jeff are asking me to write an essay about the history of facial hair in U.S. Presidents. I'm not sure I can do it, but I'll try my best! lmfao",
        },
        {
          role: "user",
          content: "Great tweet! I like how you gave an update about what we are doing. Thank you for not using hashtags.",
        },
        {
          role: "system",
          content: "Write a tweet about the following exchange - if the exchange contains a great tweet by itself, you can just use that: ",
        },
        {
          role: "user",
          content: prompt,
        },
        {
          role: "assistant",
          content: response,
        },
      ],
    });

    const tweet = completion.data.choices[0].message.content

    console.log('\n\n🐦 Tweet:', tweet)

    return tweet;
  }
  catch (error) {
    console.log('🐦 Error composing tweet:', error)
    return error
  }

}

// Create a function that we will call randomly
// It will evaluate the content of an exchange between a user and the robot
// and decide whether it is cool enough to tweet
// if it is cool enough to tweet, it sends a message to the channel asking if it should tweet it
// and if the user says yes, it tweets it
async function evaluateAndTweet(prompt, response, user, message) {
  console.log('🤖 Evaluating exchange to determine tweet...')
  // Send the prompt and response to gpt3.5

  // console.log stringified versions of all the args
  // console.log('prompt:', JSON.stringify(prompt))
  // console.log('response:', JSON.stringify(response))
  // console.log('user:', JSON.stringify(user))

  // wait 2-3 seconds
  // so that the user has time to read the response
  // and we don't hammer the API

  // and ask it to return a score of how cool it thinks the exchange is
  const completion = await openai.createChatCompletion({
    model: "gpt-3.5-turbo",
    max_tokens: 10,
    temperature: 0.1,
    messages: [
      // {
      //   role: "system",
      //   content: "The current date and time is: " + new Date().toLocaleString(),
      // },
      {
        role: "system",
        content: "You are Coach Artie's expert social media manager, specializing in accurately assessing the interest level of conversations. Your task is to evaluate exchanges in the studio's discord and decide if they are engaging enough to tweet. Given an exchange of messages between a user and an assistant, use your deep understanding of what makes a conversation interesting, relevant, and timely to provide a precise score on a scale from 1 to 100. A score of 1 indicates a dull or irrelevant exchange, while a 100 indicates a conversation that is guaranteed to go viral and attract wide attention. Base your evaluation on factors such as the uniqueness of the topic, the quality of responses, humor or entertainment value, and relevance to the target audience."
      },
      {
        role: "user",
        content: "Can you give our last 2 messages a score from 1-100 please? Please only respond with the score numbers and no additional text. Be extremely precise.",
      },
      {
        role: "assistant",
        content: '12',
      },
      {
        role: "system",
        content: "\n NEW SESSION \n"
      },
      {
        role: "user",
        content: "Can you give our last 2 messages a score from 1-100 please? Please only respond with the score numbers and no additional text. Be extremely precise.",
      },
      {
        role: "assistant",
        content: '33',
      },
      {
        role: "system",
        content: "\n NEW SESSION \n"
      },
      {
        role: "user",
        content: prompt,
      },
      {
        role: "assistant",
        content: response,
      },
      {
        role: "user",
        content: "Can you give our last 2 messages a score from 1-100 please? Please only respond with the score numbers and no additional text.",
      },
    ],
  });

  let tweetEvaluation = completion.data.choices[0].message

  console.log('🤖 Tweet evaluation, pre-process:', tweetEvaluation)

  // get the content out of the message
  tweetEvaluation = tweetEvaluation.content

  // let tweetEvaluation = 50

  // If the score is high enough, tweet it
  if (+tweetEvaluation >= 70) {
    console.log('🤖 I think this exchange is cool enough to tweet. Let me ask...')

    // set the time to collect reactions
    const collectionTimeMs = 60000


    // Use openAI to write a message to the channel asking for permission to tweet the exchange
    const tweetRequestCompletion = await openai.createChatCompletion({
      model: "gpt-3.5-turbo",
      max_tokens: 300,
      temperature: 1,
      messages: [
        {
          role: "system",
          content: "The current date and time is: " + new Date().toLocaleString(),
        },
        {
          role: "system",
          content: `You are Coach Artie, a helpful AI coach for the studio. In every message, remind the user that exchange was rated *${tweetEvaluation}/100 and users have ${collectionTimeMs / 1000} seconds to approve.`
        },
        // write a user prompt that will inspire the assistant to respond with a message asking if the exchange should be tweeted
        {
          role: "user",
          content: "tweet request"
        },
        {
          role: "assistant",
          content: `Hey party people, I think this exchange was cool (**${tweetEvaluation}** / 100) enough to tweet. Should I tweet it? If so, add a 🐦 reaction within ${collectionTimeMs / 1000} seconds to approve.`
        },
        {
          role: "user",
          content: "tweet request"
        },
        {
          role: "assistant",
          content: `I like this tweet!  (It scores ${tweetEvaluation}/100 on my Cool-o-Meter!) Can I tweet it please? If so, add a 🐦 reaction within ${collectionTimeMs / 1000} seconds to approve.`
        },
        {
          role: "user",
          content: "tweet request"
        },
        {
          role: "assistant",
          content: `Let me tweet that shit! Put a 🐦 reaction on this message within ${collectionTimeMs / 1000} seconds to approve, plleaaaase! 🥺`
        },
        {
          role: "user",
          content: "tweet request"
        },
      ],
    });

    // get the content out of the message
    let tweetRequest = tweetRequestCompletion.data.choices[0].message.content

    // send the tweet request to the channel
    message.channel.send(tweetRequest)
      .then((tweetQMsg) => {
        // add twitter emoji reaction so users don't have to search for it
        tweetQMsg.react('🐦')

        // Create a filter for reactions to the message
        const filter = (reaction, user) => {
          // We could filter to certain emojis and certain users
          // return ['🐦'].includes(reaction.emoji.name) && user.username === message.author.username;
          return true
        }

        let tweetStarted = false
        // create a reaction collector
        const collector = tweetQMsg.createReactionCollector(filter, { time: collectionTimeMs });

        // When we see a new reaction...
        collector.on('collect', async (reaction, user) => {
          if (tweetStarted) return
          // If the user who did the reaction is a bot, ignore it
          if (user.bot) return

          // console.log('🤖 Someone reacted to the message!')
          message.channel.send(`${user} approved a tweet! Let me think of something...`)

          tweetStarted = true

          // Compose a tweet and tweet it 
          const tweetText = await composeTweet(prompt, response, user)

          message.channel.send(`🕊️ Tweeting: ${tweetText}`)

          // Tweet it out and then send a link to the tweet to the channel
          try {
            const twitterResponse = tweet(tweetText).then((twitterResponse) => {
              console.log('twitter tweet response', twitterResponse)
              // get the link to the tweet

              // send the stringified twitter response to the channel
              // message.channel.send(`🐦 Twitter response: 
              // \`\`\`${JSON.stringify(twitterResponse)}
              // \`\`\`
              // `)

              // tell the channel that this is where we would tweet the URL if Elon Musk wasn't a huge piece of shit
              message.channel.send(`This is where I would drop in the URL for the tweet if Elon Musk wasn't a huge piece of human shit.`)
            })
          } catch (error) {
            console.log('🐦 Twitter error:', error)

            // send the error to the channel
            message.channel.send(`🐦 Twitter error: ${error}`)
          }
        })

        collector.on('end', collected => {
          console.log(`Collected ${collected.size} reactions`);
          // Send a message to the channel with the JSON of the reaction
          message.channel.send(`Collected ${collected.size} reactions`)

          // delete the tweetQMsg
          tweetQMsg.delete()
        })
      })
  }
}



client.once(Events.ClientReady, c => {
  // Log when we are logged in
  console.log(`⭐️ Ready! Logged in as ${c.user.username}`);
});

client.on(Events.InteractionCreate, interaction => {
  // Log every interaction we see
  console.log(interaction);
});

// An async function to send a message to a channel
// for the entire duration of the program
// This is used to send a typing indicator
// to the discord channel
async function sendTypingIndication(channel) {
  while (true) {
    channel.sendTyping();
    await new Promise((resolve) => setTimeout(resolve, 5000));
  }
}


client.login(process.env.DISCORD_BOT_TOKEN);