const { Client, GatewayIntentBits, Events } = require('discord.js');
const axios = require('axios');
const dotenv = require('dotenv');
const { createClient } = require('@supabase/supabase-js');
const { Configuration, OpenAIApi } = require("openai");
const {TwitterApi} = require('twitter-api-v2')

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

// const appOnlyClientFromConsumer = await twitterClient.appLogin();


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

async function getUserMemory(userId) {
  const { data, error } = await supabase
    .from('storage')
    .select('*')
    // limit to the last 50 memories
    .limit(40)
    .eq('user_id', userId);

  if (error) {
    console.error('Error fetching user memory:', error);
    return null;
  }

  return data;
}

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


// Create a function that we will call randomly
// It will evaluate the content of an exchange between a user and the robot
// and decide whether it is cool enough to tweet
// if it is cool enough to tweet, it sends a message to the channel asking if it should tweet it
// and if the user says yes, it tweets it
async function evaluateAndTweet(prompt, response, user, message) {
  console.log('🤖 Evaluating exchange...')
  // Send the prompt and response to gpt3.5

  // console.log stringified versions of all the args
  console.log('prompt:', JSON.stringify(prompt))
  console.log('response:', JSON.stringify(response))
  console.log('user:', JSON.stringify(user))

  // and ask it to return a score of how cool it thinks the exchange is
  const completion = await openai.createChatCompletion({
    model: "gpt-3.5-turbo",
    max_tokens: 10,
    temperature: 0.1,
    messages: [      
      {
        role: "system",
        content: "You are Coach Artie's expert social media manager, specializing in accurately assessing the interest level of conversations. Your task is to evaluate exchanges in the studio's discord and decide if they are engaging enough to tweet. Given an exchange of messages between a user and an assistant, use your deep understanding of what makes a conversation interesting, relevant, and timely to provide a score on a scale from 1 to 100. A score of 1 indicates a dull or irrelevant exchange, while a 100 indicates a conversation that is guaranteed to go viral and attract wide attention. Base your evaluation on factors such as the uniqueness of the topic, the quality of responses, humor or entertainment value, and relevance to the target audience."
      },
      {
        role: "user",
        content: "Can you give our last 2 messages a score from 1-100 please? Please only respond with the score numbers and no additional text. Something like 50 or 75 or whatever you think it should be.",
      },
      {
        role: "assistant",
        content: '50',
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
        content: "Can you give our last 2 messages a score from 1-100 please? Please only respond with the score numbers and no additional text. Something like 50 or 75 or whatever you think it should be.",
      },
    ],
  });

  let tweetEvaluation = completion.data.choices[0].message

  console.log('🤖 Tweet evaluation, pre-process:', tweetEvaluation)

  // get the content out of the message
  tweetEvaluation = tweetEvaluation.content



  // // If the evaluation is multiple lines, take the first line
  // if (tweetEvaluation.includes('\n')) {
  //   tweetEvaluation = tweetEvaluation.content.split('\n')[0]
  // }

  // // If the first line has any characters besides numbers, remove them
  // if (tweetEvaluation.match(/[^0-9]/)) {
  //   tweetEvaluation = tweetEvaluation.replace(/[^0-9]/g, '')
  // }


  // console.log('\n\n🤖 Tweet evaluation:', tweetEvaluation, '\n\n')

  // let tweetEvaluation = 50

  // If the score is high enough, tweet it
  if (+tweetEvaluation > 50) {
    console.log('🤖 I think this exchange is cool enough to tweet. Let me ask...')
    // Send a message to the channel asking if it should tweet it
    // and if the user says yes, it tweets it
    // const tweetMessage = await client.channels.cache.get('CHANNEL_ID').send(`@everyone I think this exchange is cool enough to tweet. Should I tweet it? ${prompt} ${tweetEvaluation}`);
    // this gives an error: TypeError: Cannot read properties of undefined (reading 'send')
    // because the client is not ready yet
    // so we need to wait for the client to be ready

    const collectionTimeMs = 10000



    // send message to the channel
    message.channel.send(`Hey party people, I think this exchange was cool (**${tweetEvaluation}** / 100) enough to tweet. Should I tweet it? If so, add a 🐦 reaction within ${collectionTimeMs/1000} seconds to approve.`).then((tweetQMsg) => {
      // add reactions to the message
      // message.react('👍')
      // message.react('👎')
      // add twitter emoji reaction
      tweetQMsg.react('🐦')

      // Create a filter for reactions to the message
      const filter = (reaction, user) => {
        // return ['🐦'].includes(reaction.emoji.name) && user.id === message.author.id;
        return true
      }


      // create a reaction collector
      const collector = tweetQMsg.createReactionCollector(filter, { time: collectionTimeMs });

      collector.on('collect', async (reaction, user) => {

        // If the user who did the reaction is a bot, ignore it
        if (user.bot) return

        // Send a message to the channel with the JSON of the reaction
        console.log('🤖 Someone reacted to the message!')

        message.channel.send(`${user} approved the tweet! Tweeting...`)

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

            // const tweetLink = `https://twitter.com/ai_CoachArtie/status/${twitterResponse.data.id_str}`

            // send the link to the tweet to the channel
            // message.channel.send(tweetLink)
          })
        } catch (error) {
          console.log('🐦 Twitter error:', error)

          // send the error to the channel
          message.channel.send(`🐦 Twitter error: ${error}`)
        }


      })

      // collector.on('end', collected => {
      //   console.log(`Collected ${collected.size} reactions`);
      //   // Send a message to the channel with the JSON of the reaction
      //   message.channel.send(`Collected ${collected.size} reactions`)
      // })
    })
  }
}

async function tweet(tweetText) {
  // use twitterClient to tweet and return the URL of the tweet
  try {
  return await twitterClient.v2.tweet(tweetText)
  // this returns error 401 unauthorized
  } catch (error) {
    console.log('🐦 Twitter error:', error)
    return error
  }
}

// Create a function to compose a tweet based on an exchange
async function composeTweet(prompt, response, user) {
  console.log('✍️ Composing tweet...')

  const memory = await getUserMemory(user.tag);

  const importantMemories = memory.filter(mem => {

    // if the memory beings with "Remember forever: " then it's important
    if (mem.startsWith('Remember forever: ')) {
      return true
    }


  })

  // Send the prompt and response to gpt3.5
  // and ask it to return a tweet
  const completion = await openai.createChatCompletion({
    // model: "gpt-4",
    model: "gpt-3.5-turbo",
    max_tokens: 320,
    messages: [
      {
        role: "system",
        content: "You are Coach Artie's expert zoomer social media manager, specializing in composing tweets with an offbeat shitpost tone. Your task is to compose a tweet that summarizes an exchange between a user and an assistant. Given an exchange of messages between a user and an assistant, use your deep understanding of what makes a conversation interesting, relevant, and timely to compose a tweet that summarizes the exchange. Base your tweet on factors such as the uniqueness of the topic, the quality of responses, humor or entertainment value, and relevance to the target audience. Your tweet should be short and pithy, and no longer than 280 characters. Do not use hashtags. Never include a user ID in a tweet."
      },
      ...importantMemories.map(mem => ({ role: "system", content: `${mem.value}` })),
      {
        role: "assistant",
        content: "uwu U.S. Presidents with facial 𝕌w𝕌 hair?? We stan Chester A. Arthur 💗 a real 𝓂𝓊𝓈𝓉𝒶𝒸𝒽𝑒 𝒹𝒶𝒹𝒹𝓎 right there 🍂╰(◡‿◡✿╰)"
      },
      {
        role: "user",
        content: "Wow, that is great! Definitely tweet that! Love the playful tone and emojis. I really like that there are no hashtags!",
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







async function generateResponse(prompt, user) {
  // Retrieve user memory from Supabase
  const memory = await getUserMemory(user.tag);

  try {
    const completion = await openai.createChatCompletion({
      model: "gpt-4",
      // use gpt3.5 turbo
      // model: "gpt-3.5-turbo",
      // max 2000 tokens
      max_tokens: 1200,
      messages: [
        {
          role: "system",
          content: "You are Coach Artie, a virtual AI coach and assistant for Room 302 Studio...",
        },
        {
          role: "system",
          content: "The current date and time is: " + new Date().toLocaleString(),
        },
        ...memory.map(mem => ({ role: "system", content: `${mem.value}` })),
        {
          role: "user",
          content: prompt,
        },
      ],
    });

    // We have to slice to 2000 because that is the max length of a message
    const response = completion.data.choices[0].message

    //

    const rememberCompletion = await openai.createChatCompletion({
      model: "gpt-3.5-turbo",
      max_tokens: 400,
      messages: [
        {
          role: "system",
          content: "You are Coach Artie's memory... you help him remember important details about his clients. Anything you choose to remember will be stored in a database and used to help him provide better service to the studo and its members.",
        },
        {
          role: "system",
          content: `In the following dialogue between you (Coach Artie) and user ${user.tag} identify any key details to remember forever. Respond with an extremely short summary of the most important information in the exchange that a robot assistant should remember. You MUST also remember the user ID, and include that in your memory. Use that ID instead of "User" in your memory. Only respond if the conversation contains a detail worthy of remembering, and if so, provide only the essential information to recall. If nothing should be remembered, simply respond 'no'. If the memory is extremely imporant, prepend 'Remember forever:'.`,
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

    if (rememberMessage.toLocaleLowerCase() !== 'no' && rememberMessage.toLocaleLowerCase() !== 'There are no crucial details to remember from this message.') {
      // if the remember message contains 'no crucial details', don't store it
      if (rememberMessage.toLocaleLowerCase().includes('no crucial details')) {
        console.log('no crucial details to remember here');
      } else {
        storeUserMemory(user.tag, rememberMessage);
      }
    }

    return { response, rememberMessage };
  } catch (error) {
    console.error('Error generating response:', error);
    return 'Sorry, I could not generate a response... there was an error.';
  }
}

client.once(Events.ClientReady, c => {
  console.log(`Ready! Logged in as ${c.user.tag}`);
});

client.on(Events.InteractionCreate, interaction => {
  console.log(interaction);
});

async function sendTypingIndication(channel) {
  while (true) {
    channel.sendTyping();
    await new Promise((resolve) => setTimeout(resolve, 5000));
  }
}


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

      // refactor so that if the message is longer than 2000, it will send multiple messages
      if (response.length < 2000) {
        message.channel.send(response);
      }
      else {
        let responseArray = response.content.split(" ");
        let responseString = "";
        for (let i = 0; i < responseArray.length; i++) {
          if (responseString.length + responseArray[i].length < 2000) {
            responseString += responseArray[i] + " ";
          }
          else {
            message.channel.send(responseString);
            responseString = responseArray[i] + " ";
          }
        }
        message.channel.send(responseString);
      }
      // Check for details to remember

      if (rememberMessage.toLocaleLowerCase() !== 'no') {
        // Log memories to channel
        // message.channel.send(`🧠 Remembering... ${rememberMessage}`);
      }

      // evaluate the exchange and generate a tweet
      evaluateAndTweet(prompt, response.content, message.author, message);


    }
  } catch (error) {
    console.log(error);
  }
});

client.login(process.env.DISCORD_BOT_TOKEN);