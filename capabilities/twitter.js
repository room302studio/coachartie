const dotenv = require("dotenv");
const { TwitterApi } = require("twitter-api-v2");

dotenv.config();
// set up the v2 twitter api so we can easily tweet from our account
// all the creds are in .env
const twitterClient = new TwitterApi({
  // appKey: process.env.TWITTER_CONSUMER_KEY,
  // appSecret: process.env.TWITTER_CONSUMER_SECRET,
  accessToken: process.env.TWITTER_ACCESS_TOKEN,
  accessSecret: process.env.TWITTER_ACCESS_TOKEN_SECRET,
});

// use twitterClient to tweet and return the URL of the tweet
async function tweet(tweetText) {
  try {
    return await twitterClient.v2.tweet(tweetText);
    // this returns error 401 unauthorized
  } catch (error) {
    console.log("🐦 Twitter error:", error);
    return error;
  }
}

// Create a function that we will call randomly
// It will evaluate the content of an exchange between a user and the robot
// and decide whether it is cool enough to tweet
// if it is cool enough to tweet, it sends a message to the channel asking if it should tweet it
// and if the user says yes, it tweets it
async function evaluateAndTweet(prompt, response, user, message) {
  console.log("🤖 Evaluating exchange to determine tweet...");
  // Send the prompt and response to gpt3.5

  // console.log stringified versions of all the args
  // console.log('prompt:', JSON.stringify(prompt))
  // console.log('response:', JSON.stringify(response))
  // console.log('user:', JSON.stringify(user))

  // wait a few seconds
  // so that the user has time to read the response
  // and we don't hammer the API
  // we will await a promise resolving after a random number of milliseconds
  await new Promise((resolve) =>
    setTimeout(resolve, Math.random() * 1000 + 2000)
  );

  // and ask it to return a score of how cool it thinks the exchange is
  const completion = await openai.createChatCompletion({
    model: "gpt-3.5-turbo",
    max_tokens: 10,
    temperature: 0.3,
    messages: [
      {
        role: "system",
        content: PROMPT_CONVO_EVALUATE_FOR_TWEET,
      },
      {
        role: "system",
        content: "\n NEW SESSION \n",
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
        content: PROMPT_CONVO_EVALUATE_INSTRUCTIONS,
      },
    ],
  });

  let tweetEvaluation = completion.data.choices[0].message;

  console.log("🤖 Tweet evaluation, pre-process:", tweetEvaluation);

  // get the content out of the message
  tweetEvaluation = tweetEvaluation.content;

  // let tweetEvaluation = 50

  // If the score is high enough, tweet it
  if (+tweetEvaluation >= 70 && chance.bool()) {
    console.log(
      "🤖 I think this exchange is cool enough to tweet. Let me ask..."
    );

    // set the time to collect reactions
    const collectionTimeMs = 60000;

    // Use openAI to write a message to the channel asking for permission to tweet the exchange
    const tweetRequestCompletion = await openai.createChatCompletion({
      model: "gpt-3.5-turbo",
      max_tokens: 300,
      temperature: 1,
      messages: [
        {
          role: "system",
          content:
            "The current date and time is: " + new Date().toLocaleString(),
        },
        {
          role: "system",
          content: PROMPT_TWEET_REQUEST(tweetEvaluation, collectionTimeMs),
          // write a user prompt that will inspire the assistant to respond with a message asking if the exchange should be tweeted
        },
        {
          role: "user",
          content: "tweet request",
        },
        {
          role: "assistant",
          content: `Can I tweet this out?
  (**${tweetEvaluation}** / 100) 
  React within ${collectionTimeMs / 1000}s to approve.`,
        },
        {
          role: "user",
          content: "tweet request",
        },
        {
          role: "assistant",
          content: `I like this tweet!  (I rate it ${tweetEvaluation}/100) Can I tweet it please? 
  
  If so, add a 🐦 reaction within ${
    collectionTimeMs / 1000
  } seconds to approve.`,
        },
        {
          role: "user",
          content: "tweet request",
        },
        {
          role: "assistant",
          content: `Let me tweet that! Put a 🐦 reaction on this message within ${
            collectionTimeMs / 1000
          } seconds to approve, plleaaaase! 🥺`,
        },
        {
          role: "system",
          content:
            "The current date and time is: " + new Date().toLocaleString(),
        },
        {
          role: "system",
          content: `You are Coach Artie, a helpful AI coach for the studio. Please write a sentence requesting permission to tweet an exchange you just had. In every message, remind the user that exchange was rated *${tweetEvaluation}/100 and users have ${
            collectionTimeMs / 1000
          } seconds to approve by reacting with a 🐦. Use a playful tone that keeps the studio fun.`,
        },
        {
          role: "user",
          content: "tweet request",
        },
      ],
    });

    // get the content out of the message
    let tweetRequest = tweetRequestCompletion.data.choices[0].message.content;

    // send the tweet request to the channel
    message.channel.send(tweetRequest).then((tweetQMsg) => {
      // add twitter emoji reaction so users don't have to search for it
      tweetQMsg.react("🐦");

      // Create a filter for reactions to the message
      const filter = (reaction, user) => {
        // We could filter to certain emojis and certain users
        // return ['🐦'].includes(reaction.emoji.name) && user.username === message.author.username;
        return true;
      };

      let tweetStarted = false;
      // create a reaction collector
      const collector = tweetQMsg.createReactionCollector(filter, {
        time: collectionTimeMs,
      });

      // When we see a new reaction...
      collector.on("collect", async (reaction, user) => {
        if (tweetStarted) return;
        // If the user who did the reaction is a bot, ignore it
        if (user.bot) return;

        // console.log('🤖 Someone reacted to the message!')
        message.channel.send(
          `${user} approved a tweet! Let me think of something...`
        );

        tweetStarted = true;

        // Compose a tweet and tweet it
        const tweetText = await composeTweet(prompt, response, user);

        message.channel.send(`Tweet:
          
          ${tweetText}`);

        // Tweet it out and then send a link to the tweet to the channel
        try {
          const twitterResponse = tweet(tweetText).then((twitterResponse) => {
            console.log("twitter tweet response", twitterResponse);
            // get the link to the tweet

            // send the stringified twitter response to the channel
            // message.channel.send(`🐦 Twitter response:
            // \`\`\`${JSON.stringify(twitterResponse)}
            // \`\`\`
            // `)

            // tell the channel that this is where we would tweet the URL if Elon Musk wasn't a huge piece of shit
            // message.channel.send(`This is where I would drop in the URL for the tweet if Elon Musk wasn't a huge piece of human shit.`)
            message.channel.send(`Twitter API access currently disabled.`);
          });
        } catch (error) {
          console.log("🐦 Twitter error:", error);

          // send the error to the channel
          message.channel.send(`🐦 Twitter error: ${error}`);
        }
      });

      // collector.on('end', collected => {
      //   console.log(`Collected ${collected.size} reactions`);
      //   // Send a message to the channel with the JSON of the reaction
      //   message.channel.send(`Collected ${collected.size} reactions`)

      //   // delete the tweetQMsg
      //   // tweetQMsg.delete()
      // })
    });
  }
}

// Compose a tweet based on an exchange between a user and an assistant
async function composeTweet(prompt, response, user) {
  console.log("✍️ Composing tweet...");

  const memory = await getUserMemory(user, 4);

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
        ...memory.map((mem) => ({ role: "system", content: `${mem.value}` })),
        {
          role: "system",
          content: PROMPT_TWEET_INTRO,
        },
        // ...importantMemories.map(mem => ({ role: "system", content: `${mem.value}` })),
        {
          role: "assistant",
          content:
            "uwu U.S. Presidents with facial 𝕌w𝕌 hair?? We stan Chester A. Arthur 💗 a real 𝓂𝓊𝓈𝓉𝒶𝒸𝒽𝑒 𝒹𝒶𝒹𝒹𝓎 right there 🍂╰(◡‿◡✿╰)",
        },
        {
          role: "user",
          content:
            "Wow, that is great! Definitely tweet that! Love the playful tone and emojis and how short it is. Thank you for not using hashtags.",
        },
        {
          role: "assistant",
          content:
            "EJ and Jeff are asking me to write an essay about the history of facial hair in U.S. Presidents. I'm not sure I can do it, but I'll try my best! lmfao",
        },
        {
          role: "user",
          content:
            "Great tweet! I like how you gave an update about what we are doing. Thank you for not using hashtags.",
        },
        {
          role: "system",
          content:
            "Write a tweet about the following exchange - if the exchange contains a great tweet by itself, you can just use that: ",
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
          role: "system",
          content: PROMPT_TWEET_END,
        },
      ],
    });

    const tweet = completion.data.choices[0].message.content;

    // remove any hashtag words from the tweet
    const tweetWithoutHashtags = tweet.replace(/#\w+/g, "");

    console.log("\n\n🐦 Tweet:", tweet);

    // return tweet;
    return tweetWithoutHashtags;
  } catch (error) {
    console.log("🐦 Error composing tweet:", error);
    return error;
  }
}
