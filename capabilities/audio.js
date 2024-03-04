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
const logger = require("../src/logger.js")("audio");
var child_process = require("child_process");
const axios = require("axios");
const util = require("util");

// const CHUNK_TOKEN_AMOUNT = 7000
// const CHUNK_TOKEN_AMOUNT = 10952; // gpt-3.5
const CHUNK_TOKEN_AMOUNT = 120000; // gpt-4

dotenv.config();

const configuration = new Configuration({
  organization: process.env.OPENAI_API_ORGANIZATION,
  apiKey: process.env.OPENAI_API_KEY,
});
const openai = new OpenAIApi(configuration);

const cacheRoot = path.join(__dirname, `../cache/`);
// STEP 1 - Get the URL of the audio we want to transcribe (mp3, wav, etc.)
// const audioFileURL =

const execPromise = util.promisify(child_process.exec);

async function curlAudioFile(audioFileURL) {
  logger.info(`📝  Downloading audio file from: ${audioFileURL}`);
  const audioFileHash = crypto
    .createHash("sha256")
    .update(audioFileURL)
    .digest("hex");

  return new Promise(async (resolve, reject) => {
    const audioFilePath = path.join(__dirname, `../cache/${audioFileHash}.mp3`);

    // Check if the audio file already exists
    if (fs.existsSync(audioFilePath)) {
      logger.info(`📝  Audio file already exists at: ${audioFilePath}`);
      resolve({ audioFilePath, audioFileHash }); // Return the location of the existing audio file
      return;
    }

    try {
      await execPromise(`curl -o ${audioFilePath} ${audioFileURL}`);
      logger.info(
        `📝  Audio file downloaded successfully at: ${audioFilePath}`
      );
      resolve({ audioFilePath, audioFileHash }); // Return the location of the downloaded audio file
    } catch (error) {
      console.error(`exec error: ${error}`);
      reject(error);
    }
  });
}

async function ytDlpUrl(url) {
  return new Promise(async (resolve, reject) => {
    const command = `yt-dlp -x --audio-format mp3 --audio-quality 0 -o "audio.%(ext)s" ${url}`;

    try {
      const { stdout, stderr } = await execPromise(command);
      console.log(`stdout: ${stdout}`);
      console.error(`stderr: ${stderr}`);
      resolve(stdout);
    } catch (error) {
      console.error(`exec error: ${error}`);
      reject(error);
    }
  });
}

// CURRENTLY: /cache/
// BUT THE split
// ARE IN THE ROOT DIRECTORY

async function getSplitFilePaths(audioFilePath, audioFileHash) {
  const filepaths = [];
  const files = fs.readdirSync(cacheRoot);
  logger.info(`📝  Files in directory: ${JSON.stringify(files)}`);
  // STIL IN /CACHE
  files.forEach((file) => {
    if (file.startsWith("split_" + audioFileHash) && file.endsWith(".mp3")) {
      logger.info(`📝  Found split file: ${file}`);
      filepaths.push(path.join(cacheRoot, file));
    }
  });

  return filepaths;
}

async function checkFileOrSplitsExist(audioFilePath, audioFileHash) {
  // Check if the file is already split
  // by looking for any files that start with the split_${audioFileHash}
  const files = fs.readdirSync(cacheRoot);

  logger.info(`📝  Files in directory: ${JSON.stringify(files)}`);
  for (const file of files) {
    if (file.startsWith("split_" + audioFileHash) && file.endsWith(".mp3")) {
      logger.info(`📝  Split file already exists: ${file}`);
      return true;
    }
  }
  logger.info(`📝  Split file does not exist...`);
  return false;
}

// now we need a function to use ffmpeg to split into 50mb chunks and keep track of their filenames
async function splitAudioFile({ audioFilePath, audioFileHash }) {
  const oneMegabyte = 1048576; // Correct number of bytes in a megabyte
  const desiredFileSizeInMB = 10;
  const segmentSize = desiredFileSizeInMB * oneMegabyte;

  const fileAlreadyExists = await checkFileOrSplitsExist(
    audioFilePath,
    audioFileHash
  );
  // check if the file is already split
  if (fileAlreadyExists) {
    logger.info(`📝  Audio file already split into chunks...`);
    const filepaths = await getSplitFilePaths(audioFilePath, audioFileHash);
    logger.info(`📝  Split file paths: ${JSON.stringify(filepaths)}`);
    return filepaths;
  }

  logger.info(`📝  Splitting audio file into 10MB chunks...`);

  // Approximate duration for desired file size, assuming a bitrate of 128 kbps (16 KB/s)
  // This is a rough estimation and should be adjusted according to the actual bitrate of your files
  const bitrateKbps = 128;
  const bytesPerSecond = (bitrateKbps * 1024) / 8;
  const segmentDuration = Math.floor(segmentSize / bytesPerSecond);
  const command = `ffmpeg -i ${audioFilePath} -f segment -segment_time ${segmentDuration} -c copy split_${audioFileHash}%03d.mp3`;

  console.log("\n\n\n" + command + "\n\n\n");

  try {
    logger.info(
      `📝  Splitting audio file into ${segmentDuration} second chunks...`
    );
    logger.info(`Running command: ${command}`);
    // const { stdout, stderr } = await execPromise(command);
    const { stdout, stderr } = await execPromise(command, {
      cwd: cacheRoot,
    });

    //exec(
    // 'pwd',

    console.log(`stdout: ${stdout}`);
    console.error(`stderr: ${stderr}`);
    // Get the list of filepaths
    return await getSplitFilePaths(audioFilePath, audioFileHash);
    // const filepaths = [];
    // const files = fs.readdirSync(path.dirname(audioFilePath));
    // files.forEach((file) => {
    //   if (file.startsWith(audioFileHash) && file.endsWith(".mp3")) {
    //     filepaths.push(path.join(path.dirname(audioFilePath), file));
    //   }
    // });
    // return filepaths;
  } catch (error) {
    console.error(`exec error: ${error}`);
    logger.info(`📝  Splitting audio file failed. ${JSON.stringify(error)}`);
    return error;
  }
}

// given an array of audio file chunks locally, send them to whisper and get the results
async function sendAudioChunkToWhisper(audioChunks) {
  const formData = new FormData();
  formData.append("file", fs.createReadStream(audioChunks[0]));
  formData.append("model", "whisper-1");

  const config = {
    headers: {
      Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
      "Content-Type": "multipart/form-data",
    },
  };

  try {
    const response = await axios.post(
      "https://api.openai.com/v1/audio/transcriptions",
      formData,
      config
    );

    // Write transcription results to a .txt file
    const transcription = response.data;
    const audioFilePath = audioChunks[0];
    const txtFilePath = path.join(
      path.dirname(audioFilePath),
      `${path.basename(audioFilePath, path.extname(audioFilePath))}.txt`
    );
    fs.writeFileSync(txtFilePath, transcription);

    return response.data;
  } catch (error) {
    console.error(error);
    throw error;
  }
}

async function compileAudioChunkTranscriptions(audioChunks) {
  let transcriptionText = "";
  // grab all the text files and compile them into a single transcription
  for (const audioChunk of audioChunks) {
    const txtFilePath = path.join(
      path.dirname(audioChunk),
      `${path.basename(audioChunk, path.extname(audioChunk))}.txt`
    );
    const transcription = fs.readFileSync(txtFilePath, "utf8");
    console.log(transcription);

    transcriptionText += transcription;
  }

  return transcriptionText;
}

async function fullTranscriptToManyMemories(fullTranscript) {
  // use processChunks to make facts, and then make memories from the facts, bada bing bada boom
}

async function audioFileToMemories(audioFileURL, userPrompt = "") {
  logger.info("📝  Starting audioFileToMemories...");
  // curl AUDIO file
  const { audioFilePath, audioFileHash } = await curlAudioFile(audioFileURL);
  // ffmpeg split
  const filePaths = await splitAudioFile({ audioFilePath, audioFileHash });

  logger.info(`File paths: ${JSON.stringify(filePaths)}`);

  // TODO: Now that we have our file paths, we need to await sending all of them to whisper 

  // let fullTranscript = ''
  // for (const filePath of filePaths) {
  //   sendAudioChunkToWhisper(filePath);
  // }

  // send chunks to whisper
  // get chunks back
  // turn chunks into memories
  // return memories
}

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

async function handleCapabilityMethod(method, args, messages) {
  // first we need to figure out what the method is
  // then grab the URL from the args
  // then we need to call the method with the URL

  // audio:toMemories(AUDIO_URL)
  // then we need to return the result of the method

  const userPrompt = lastUserMessage(messages);

  const url = destructureArgs(args)[0];
  if (method === "toMemories") {
    const summary = await audioFileToMemories(url, userPrompt);
    // const summary = `Pretend this is an audio transcript, the secret word is BANANAS ${url}`;
    return summary;
  }
}

module.exports = {
  fetchAndSummarizeUrl,
  handleCapabilityMethod,
};
