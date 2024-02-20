const dotenv = require("dotenv");
const { Configuration, OpenAIApi } = require("openai");
const puppeteer = require("puppeteer");
// const { fstat } = require("fs");
// const { fs } = require("fs");
const {
  WEBPAGE_UNDERSTANDER_PROMPT,
  WEBPAGE_CHUNK_UNDERSTANDER_PROMPT,
} = require("../prompts");
const { encode, decode } = require("@nem035/gpt-3-encoder");
// import chance
const chance = require("chance").Chance();
const {
  destructureArgs,
  countMessageTokens,
  lastUserMessage,
} = require("../helpers");
const fs = require("fs");
const path = require("path");
const crypto = require("crypto");
const logger = require("../src/logger.js")("web");

// const CHUNK_TOKEN_AMOUNT = 7000
const CHUNK_TOKEN_AMOUNT = 10952;

dotenv.config();

const configuration = new Configuration({
  organization: process.env.OPENAI_API_ORGANIZATION,
  apiKey: process.env.OPENAI_API_KEY,
});
const openai = new OpenAIApi(configuration);

// STEP 1 - Get the URL of the audio we want to transcribe (mp3, wav, etc.)
// const audioFileURL =

// console.log(audioFileURL)

// STEP 2 - Somehow turn that audio file into a transcription
// 2A: Download the raw audio file
// 2B: Split the file into 50mb chunks for Whisper? (ffmpeg? command line?)
// 2C: Send chunks for transcription to Whisper

// STEP 3 - Turn the transcript(s) into memories

// Get a huge long list of facts from the transcript
// Use a well-designed task prompt to turn the facts into memories
// HOW DO WE KNOW HOW MANY MEMORIES? HOW CAN WE SUPPORT 1-DOZENS DEPENDING ON THE LENGTH OF THE TRANSCRIPT?
// Create the memories using existing memory functions for eaach "chunk"

// quick promise sleep function
function sleep(ms) {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

async function processChunks(chunks, data, limit = 2, userPrompt = "") {
  const results = [];
  const chunkLength = chunks.length;

  // remove any empty or blank chunks
  chunks = chunks.filter((chunk) => chunk.length > 0);

  for (let i = 0; i < chunkLength; i += limit) {
    const chunkPromises = chunks
      .slice(i, i + limit)
      .map(async (chunk, index) => {
        // sleep so we don't anger the OpenAI gods
        await sleep(500);

        logger.info(`📝  Sending chunk ${i + index + 1} of ${chunkLength}...`);
        logger.info("📝  Chunk text:", chunk);

        const completion = await openai.createChatCompletion({
          model: "gpt-3.5-turbo-16k",
          max_tokens: 1024,
          // temperature: 0.5,
          // presence_penalty: 0.66,
          presence_penalty: -0.05,
          // frequency_penalty: 0.1,
          messages: [
            { role: "user", content: userPrompt },
            {
              role: "user",
              content: `${WEBPAGE_CHUNK_UNDERSTANDER_PROMPT}

            ${chunk}`,
            },
          ],
        });

        return completion.data.choices[0].message.content;
      });

    const chunkResults = await Promise.all(chunkPromises);
    results.push(...chunkResults);
  }

  return results;
}

/**
 * Fetches the content of a URL, generates a summary, and caches the result.
 * @param {string} url - The URL to fetch and summarize.
 * @returns {Promise<string>} - The generated summary.
 */
async function fetchAndSummarizeUrl(url, userPrompt = "") {
  const cleanedUrl = cleanUrlForPuppeteer(url);
  const hashedUrl = crypto.createHash("md5").update(cleanedUrl).digest("hex");
  const cachePath = path.join(__dirname, "cache", `${hashedUrl}.json`);

  // Check if the cache file exists and is less than an hour old
  if (
    fs.existsSync(cachePath) &&
    (Date.now() - fs.statSync(cachePath).mtime) / 1000 < 3600
  ) {
    logger.info(`📝  Using cached data for URL: ${cleanedUrl}`);
    return fs.readFileSync(cachePath, "utf8");
  }

  logger.info(`📝  Fetching URL: ${cleanedUrl}`);
  const data = await fetchAndParseURL(cleanedUrl);
  logger.info(`📝  Fetched URL: ${cleanedUrl}`);

  logger.info("📝  Generating summary...");

  // if data.text is longer than 4096 characters, split it into chunks of 4096 characters and send each chunk as a separate message and then combine the responses

  let text = data.text;

  // remove newlines
  text = text.replace(/\n/g, " ");

  // remove tabs
  text = text.replace(/\t/g, " ");

  // remove multiple spaces
  text = text.replace(/ +(?= )/g, "");

  // we need to refactor to use countMessageTokens instead of character count, so we split the text into chunks with CHUNK_TOKEN_AMOUNT tokens each
  let chunks = [];
  let chunkStart = 0;
  // now we need to split the text into chunks of 13592 tokens each
  // so we need to figure out how many tokens are in the text
  // we will use the countMessageTokens function to do this
  let tokenCount = countMessageTokens(text);
  logger.info(`📝  Token count: ${tokenCount}`);
  let chunkEnd = CHUNK_TOKEN_AMOUNT; // set the chunkEnd to the CHUNK_TOKEN_AMOUNT so we can start the loop
  while (chunkStart < tokenCount) {
    // we need to make sure that the chunkEnd is not greater than the tokenCount
    if (chunkEnd > tokenCount) {
      chunkEnd = tokenCount;
    }
    // now we can push the chunk to the chunks array
    chunks.push(text.slice(chunkStart, chunkEnd));
    // now we can set the chunkStart to the chunkEnd
    chunkStart = chunkEnd;
    // now we can set the chunkEnd to the chunkStart + CHUNK_TOKEN_AMOUNT
    chunkEnd = chunkStart + CHUNK_TOKEN_AMOUNT;
  }

  logger.info(`📝  Splitting text into ${chunks.length} chunks...`);
  logger.info(`📝  Chunk length: ${CHUNK_TOKEN_AMOUNT} tokens`);

  let factList = "";
  try {
    // Check if the chunks are already cached
    const cacheKey = crypto.createHash("md5").update(url).digest("hex");
    let chunkResponses;
    if (fs.existsSync(path.join(__dirname, `../cache/${cacheKey}.json`))) {
      logger.info("📝  Using cached chunks...");
      chunkResponses = JSON.parse(
        fs.readFileSync(
          path.join(__dirname, `../cache/${cacheKey}.json`),
          "utf8"
        )
      );
    } else {
      chunkResponses = await processChunks(chunks, data);
      // Cache the chunks
      fs.writeFileSync(
        path.join(__dirname, `../cache/${cacheKey}.json`),
        JSON.stringify(chunkResponses)
      );
    }

    factList = chunkResponses.join("\n");

    // return chunkResponses;
  } catch (error) {
    logger.info(error);
    return error;
  }

  logger.info(`📝  Generated ${factList.split("\n").length} fact summary.`);
  logger.info(`📝  Generating summary of: ${factList}`);

  // use gpt-3.5-turbo-16k for the final summary
  const summaryCompletion = await openai.createChatCompletion({
    model: "gpt-3.5-turbo-16k",
    // max_tokens: 2048,
    max_tokens: 3072,
    // temperature: 0.5,
    // presence_penalty: 0.66,
    // presence_penalty: -0.1,
    // frequency_penalty: 0.1,
    messages: [
      {
        role: "user",
        content: `# User goal: ${userPrompt}

${WEBPAGE_UNDERSTANDER_PROMPT}

## Facts
${factList}`,
      },
    ],
  });

  const summary = summaryCompletion.data.choices[0].message.content;

  logger.info(`📝  Generated summary for URL: ${cleanedUrl}`, summary);

  // Save the summary to the cache
  fs.writeFileSync(cachePath, summary);

  return summary;
}

function randomUserAgent() {
  const potentialUserAgents = [
    `Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/92.0.4515.159 Safari/537.36`,
    `Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/14.0 Safari/605.1.15`,
    `Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/92.0.4515.159 Safari/537.36`,
    `Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:91.0) Gecko/20100101 Firefox/91.0`,
  ];

  const pickedUserAgent = chance.pickone(potentialUserAgents);
  logger.info("📝  Picked User Agent: ", pickedUserAgent);

  // use chance.choose to pick a random user agent
  return pickedUserAgent;
}

async function handleCapabilityMethod(method, args, messages) {
  // first we need to figure out what the method is
  // then grab the URL from the args
  // then we need to call the method with the URL

  // audio:toMemories(AUDIO_URL)
  // then we need to return the result of the method

  const userPrompt = lastUserMessage(messages);

  const url = destructureArgs(args)[0];
  if (method === "toMemories") {
    // const summary = await audioFileToMemories(url, userPrompt);
    const summary = `Pretend this is an audio transcript, the secret word is BANANAS ${url}`;
    return summary;
  }
}

module.exports = {
  fetchAndSummarizeUrl,
  handleCapabilityMethod,
};
