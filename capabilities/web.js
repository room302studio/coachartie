const dotenv = require("dotenv");
// const { Configuration, OpenAIApi } = require("openai");
const puppeteer = require("puppeteer");
const { getPromptsFromSupabase } = require("../helpers");
const { WEBPAGE_UNDERSTANDER_PROMPT, WEBPAGE_CHUNK_UNDERSTANDER_PROMPT } =
  getPromptsFromSupabase();
const { encode, decode } = require("@nem035/gpt-3-encoder");
// import chance
const chance = require("chance").Chance();
const {
  destructureArgs,
  countMessageTokens,
  lastUserMessage,
  sleep,
} = require("../helpers");
const fs = require("fs");
const path = require("path");
const crypto = require("crypto");
const logger = require("../src/logger.js")("web");

// import OpenAI from "openai";
// conver to require
const OpenAI = require("openai");
const openai = new OpenAI();

// TODO: Pull this in from config
// const CHUNK_TOKEN_AMOUNT = 7000
// const CHUNK_TOKEN_AMOUNT = 10952;
const CHUNK_TOKEN_AMOUNT = 120 * 1024; // 128k tokens

dotenv.config();

// const configuration = new Configuration({
//   organization: process.env.OPENAI_API_ORGANIZATION,
//   apiKey: process.env.OPENAI_API_KEY,
// });
// const openai = new OpenAIApi(configuration);

// This file will serve as a module used by the main discord bot

// The purpose of this file is to enable basic web browser access for the robot: given a URL, access it, parse it as JSON, and return the page contents to the main bot.

const allowedTextEls =
  "p, h1, h2, h3, h4, h5, h6, a, td, th, tr, pre, code, blockquote";

function cleanUrlForPuppeteer(dirtyUrl) {
  // if the url starts and ends with ' then remove them
  if (dirtyUrl.startsWith("'") && dirtyUrl.endsWith("'")) {
    dirtyUrl = dirtyUrl.slice(1, -1);
  }

  // if it starts with ' remove it
  if (dirtyUrl.startsWith("'")) {
    dirtyUrl = dirtyUrl.slice(1);
  }

  // if it ends with ' remove it
  if (dirtyUrl.endsWith("'")) {
    dirtyUrl = dirtyUrl.slice(0, -1);
  }

  // if the url starts and ends with " then remove them
  if (dirtyUrl.startsWith('"') && dirtyUrl.endsWith('"')) {
    dirtyUrl = dirtyUrl.slice(1, -1);
  }

  // if it starts with " remove it
  if (dirtyUrl.startsWith('"')) {
    dirtyUrl = dirtyUrl.slice(1);
  }

  // if it ends with " remove it
  if (dirtyUrl.endsWith('"')) {
    dirtyUrl = dirtyUrl.slice(0, -1);
  }

  // return the clean url
  return dirtyUrl;
}

// Refactored function to be exported
async function webPageToText(url) {
  const browser = await puppeteer.launch();
  const page = await browser.newPage();
  await page.setUserAgent(randomUserAgent());
  await page.goto(url);

  logger.info("🕸️  Navigating to " + url);

  const title = await page.title();

  // wait for body to load
  await page.waitForSelector("body");

  // Extract text from the page
  const text = await page.$$eval(allowedTextEls, (elements) => {
    return elements
      .map((element) => {
        if (element.tagName === "PRE") {
          return "```\n" + element.textContent + "\n```";
        }
        if (element.tagName === "A") {
          // const url = new URL(element.href);
          return `${element.textContent} (${element.href}) `;
        }
        return element.textContent + " ";
      })
      .join(" ");
  });

  const trimmedText = text.replace(/\s+/g, " ").trim();

  await browser.close();

  return { title, text: trimmedText };
}

async function webpageToHTML(url) {
  const browser = await puppeteer.launch();
  const page = await browser.newPage();
  await page.setUserAgent(randomUserAgent());
  await page.goto(url);

  logger.info("🕸️  Navigating to " + url);

  // wait for body to load
  await page.waitForSelector("body");

  // wait a second or two for javascript to run
  await sleep(5000);

  // Extract text from the page body tag
  const html = await page.$eval("body", (body) => body.innerHTML);

  await browser.close();

  return { html };
}

async function fetchAndParseURL(url) {
  const { title, text } = await webPageToText(url);

  return { title, text };
}

/**
 * Fetches all links on a given URL.
 *
 * @param {string} url - The URL to fetch links from.
 * @returns {Promise<string>} - A promise that resolves to a string containing the links.
 */
async function fetchAllLinks(url) {
  logger.info("🕸️  Fetching all links on " + url);
  // navigate to a page and fetch all of the anchor tags
  const browser = await puppeteer.launch();
  const page = await browser.newPage();
  await page.setUserAgent(randomUserAgent());

  // clean the URL
  const cleanUrl = cleanUrlForPuppeteer(url);

  // if the url and cleanedUrl are different, log it
  if (url !== cleanUrl) {
    logger.info("🧹  Cleaned URL to " + cleanUrl);
  }

  await page.goto(cleanUrl);

  logger.info("🕸️  Navigating to " + cleanUrl);

  // check if the base cleanUrl we are navigating to is google.com
  const isGoogle = url.includes("google.com");

  if (isGoogle) {
    await page.waitForSelector("div#search");
  } else {
    await page.waitForSelector("body");
  }

  // wait for body to load
  // await page.waitForSelector("body");

  // wait 2 seconds for any JS to run
  await sleep(2000);

  // get all the links and the link text
  const links = await page.$$eval("a", function (elements) {
    return (
      elements
        .map((element) => {
          return {
            // href: trimHref(element.href),
            href: element.href,
            text: element.textContent,
          };
        })
        // filter out any links that don't have text
        .filter((link) => link.text.length > 0)
        // filter out any links that are internal links by detecting the # symbol
        .filter((link) => !link.href.includes("#"))
    );
  });

  await browser.close();

  // return the links as a newline delimited list prepared for GPT-3
  const linkList = links.map((link) => {
    let linkUrl;
    try {
      linkUrl = new URL(link.href);
    } catch (e) {
      // if the URL is invalid, just return the raw link
      return `* ${link.text} (${link.href})`;
    }

    // clear all query params EXCEPT for q=, which is a search query
    linkUrl.search = linkUrl.search
      .split("&")
      .filter((param) => param.startsWith("q="))
      .join("&");

    return `* ${link.text} (${linkUrl.href})`;
  });

  return `# Links on ${url}\n${linkList.join("\n")}`;
}

/**
 * Fetches all visible images on a given URL.
 *
 * @param {string} url - The URL to fetch images from.
 * @returns {Promise<Array<{src: string, alt: string}>>} - A promise that resolves to an array of image objects, each containing the source (src) and alternative text (alt) of the image.
 */
async function fetchAllVisibleImages(url) {
  logger.info("🕸️  Fetching all images on " + url);
  // navigate to a page and fetch all of the anchor tags
  const browser = await puppeteer.launch();
  const page = await browser.newPage();
  await page.setUserAgent(randomUserAgent());

  // clean the URL
  const cleanUrl = cleanUrlForPuppeteer(url);

  // if the url and cleanedUrl are different, log it
  if (url !== cleanUrl) {
    logger.info("🧹  Cleaned URL to " + cleanUrl);
  }

  await page.goto(cleanUrl);

  logger.info("🕸️  Navigating to " + cleanUrl);

  // wait for body to load
  await page.waitForSelector("body");

  // wait 2 seconds for any JS to run
  await sleep(2000);

  // get all the links and the link text
  const images = await page.$$eval("img", function (elements) {
    return (
      elements
        .map((element) => {
          return {
            src: element.src,
            alt: element.alt,
          };
        })
        // filter out any links that don't have text
        .filter((image) => image.alt.length > 0)
    );
  });

  await browser.close();

  // return the links as a newline delimited list prepared for GPT-3
  return images;
}

/**
 * Fetches the largest image from the given URL.
 * @param {string} url - The URL to fetch the images from.
 * @returns {Promise<string>} The source URL of the largest image.
 */
async function fetchLargestImage(url) {
  const urlImages = await fetchAllVisibleImages(url);
  // sort the images by size
  urlImages.sort((a, b) => {
    return b.width * b.height - a.width * a.height;
  });

  // return the first image
  return urlImages[0].src;
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
        logger.info(`Chunk text: ${chunk}`);

        const completion = await openai.chat.completions.create({
          // model: "gpt-3.5-turbo-16k",
          model: "gpt-4-0125-preview",
          max_tokens: 2048,
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
        return completion.choices[0];
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
  const { text } = await fetchAndParseURL(cleanedUrl);
  logger.info(`📝  Fetched text: ${text}`);
  logger.info(`📝  Fetched URL: ${cleanedUrl}`);

  logger.info("📝  Generating summary...");

  // if data.text is longer than 4096 characters, split it into chunks of 4096 characters and send each chunk as a separate message and then combine the responses

  // remove newlines
  let cleanText = text.replace(/\n/g, " ");

  // remove tabs
  cleanText = cleanText.replace(/\t/g, " ");

  // remove multiple spaces
  cleanText = cleanText.replace(/ +(?= )/g, "");

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
      chunkResponses = await processChunks(chunks, cleanText);
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
  const summaryCompletion = await openai.chat.completions.create({
    // model: "gpt-3.5-turbo-16k",
    model: "gpt-4-0125-preview",
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

  const summary = summaryCompletion.choices[0].message.content;

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
  logger.info(`📝  Picked User Agent: ${pickedUserAgent}`);

  // use chance.choose to pick a random user agent
  return pickedUserAgent;
}

async function handleCapabilityMethod(method, args, messages) {
  // first we need to figure out what the method is
  // then grab the URL from the args
  // then we need to call the method with the URL
  // then we need to return the result of the method

  const userPrompt = lastUserMessage(messages);

  const url = destructureArgs(args)[0];
  if (method === "fetchAndSummarizeUrl") {
    const summary = await fetchAndSummarizeUrl(url, userPrompt);
    return summary;
  } else if (method === "fetchAllLinks") {
    const links = await fetchAllLinks(url);
    return links;
  } else if (method === "fetchLargestImage") {
    const image = await fetchLargestImage(url);
    return image;
  }
}

module.exports = {
  fetchAndSummarizeUrl,
  fetchLargestImage,
  fetchAllLinks,
  handleCapabilityMethod,
  webPageToText,
  webpageToHTML,
};
