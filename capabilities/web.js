const dotenv = require("dotenv");
// const { Configuration, OpenAIApi } = require("openai");
const puppeteer = require("puppeteer");
const { getPromptsFromSupabase } = require("../helpers");
const { WEBPAGE_UNDERSTANDER_PROMPT, WEBPAGE_CHUNK_UNDERSTANDER_PROMPT } =
  getPromptsFromSupabase();
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
const llmHelper = require("../helpers-llm");

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

const allowedTextEls = "p, h1, h2, h3, h4, h5, h6, a, td, th, tr";

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
  logger.info(`Starting webPageToText for URL: ${url}`);
  const browser = await puppeteer.launch();
  const page = await browser.newPage();
  await page.setUserAgent(randomUserAgent());

  try {
    logger.info(`Navigating to ${url}`);
    const response = await page.goto(url, { waitUntil: "networkidle0" });

    if (!response.ok()) {
      throw new Error(
        `HTTP response status ${response.status()} ${response.statusText()}`
      );
    }

    logger.info(`Page loaded, getting title`);
    const title = await page.title();
    logger.info(`Page title: ${title}`);

    logger.info(`Waiting for body to load`);
    await page.waitForSelector("body", { timeout: 10000 });

    logger.info(`Extracting text from the page`);
    const text = await page.evaluate(() => {
      // Select the main content area - adjust this selector based on Bloomberg's structure
      const mainContent = document.querySelector("article") || document.body;

      // Function to get text from an element, excluding certain tags
      const getText = (element) => {
        if (
          element.tagName === "SCRIPT" ||
          element.tagName === "STYLE" ||
          element.tagName === "NAV"
        ) {
          return "";
        }
        if (element.tagName === "A") {
          return element.textContent + " ";
        }
        return Array.from(element.childNodes)
          .map((node) =>
            node.nodeType === Node.TEXT_NODE ? node.textContent : getText(node)
          )
          .join("");
      };

      return getText(mainContent).trim();
    });

    logger.info(`Raw text length: ${text.length}`);
    logger.info(`First 500 characters of raw text: ${text.substring(0, 500)}`);

    const trimmedText = text.replace(/\s+/g, " ").trim();
    logger.info(`Trimmed text length: ${trimmedText.length}`);
    logger.info(
      `First 500 characters of trimmed text: ${trimmedText.substring(0, 500)}`
    );

    if (trimmedText.length === 0) {
      logger.warn(`No text found on the page. Fetching full HTML content...`);
      const fullHtml = await page.content();
      logger.warn(
        `Full HTML content (first 1000 chars): ${fullHtml.substring(0, 1000)}`
      );
    }

    return { title, text: trimmedText };
  } catch (error) {
    logger.error(`Error in webPageToText: ${error.message}`);
    logger.error(`Error stack: ${error.stack}`);
    return { title: "Error", text: `Failed to fetch page: ${error.message}` };
  } finally {
    await browser.close();
  }
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
  logger.info(`Starting fetchAndParseURL for URL: ${url}`);
  const { title, text } = await webPageToText(url);

  if (text.startsWith("Failed to fetch page:")) {
    logger.error(`Failed to fetch page: ${text}`);
    throw new Error(text);
  }

  logger.info(`Fetched title: ${title}`);
  logger.info(`Fetched text length: ${text.length}`);

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
        try {
          // sleep so we don't anger the OpenAI gods
          await sleep(500);

          logger.info(
            `📝  Sending chunk ${i + index + 1} of ${chunkLength}...`
          );
          logger.info(`Chunk text: ${chunk.substring(0, 100)}...`); // Log only the first 100 characters

          const completion = await llmHelper.createChatCompletion(
            [
              {
                role: "user",
                content: userPrompt
                  ? `# User goal: ${userPrompt}`
                  : "Can you help me understand this chunk of a webpage please?",
              },
              {
                role: "user",
                content: `${WEBPAGE_CHUNK_UNDERSTANDER_PROMPT}\n\n${chunk}`,
              },
            ],
            {
              model: "gpt-4-0125-preview",
              max_tokens: 2048,
              presence_penalty: -0.05,
            }
          );

          return completion.content;
        } catch (error) {
          logger.error(`Error processing chunk: ${error.message}`);
          return `Error processing chunk: ${error.message}`;
        }
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
  logger.info(`🚀 Starting fetchAndSummarizeUrl for URL: ${url}`);
  logger.info(`User prompt: ${userPrompt}`);

  const cleanedUrl = cleanUrlForPuppeteer(url);
  logger.info(`Cleaned URL: ${cleanedUrl}`);

  const hashedUrl = crypto.createHash("md5").update(cleanedUrl).digest("hex");
  const cachePath = path.join(__dirname, "cache", `${hashedUrl}.json`);

  // Check if the cache file exists and is less than an hour old
  if (
    fs.existsSync(cachePath) &&
    (Date.now() - fs.statSync(cachePath).mtime) / 1000 < 3600
  ) {
    logger.info(`📝 Using cached data for URL: ${cleanedUrl}`);
    return fs.readFileSync(cachePath, "utf8");
  }

  logger.info(`📝 Fetching URL: ${cleanedUrl}`);
  const { text } = await fetchAndParseURL(cleanedUrl);
  logger.info(`📝 Fetched text length: ${text.length}`);
  logger.info(
    `📝 First 1000 characters of fetched text: ${text.substring(0, 1000)}`
  );

  logger.info("📝 Generating summary...");

  // Clean and chunk the text
  const cleanText = text
    .replace(/\n/g, " ")
    .replace(/\t/g, " ")
    .replace(/ +(?= )/g, "");

  const tokenCount = countMessageTokens(cleanText);
  logger.info(`📝 Total token count: ${tokenCount}`);

  const chunks = [];
  for (let i = 0; i < tokenCount; i += CHUNK_TOKEN_AMOUNT) {
    chunks.push(cleanText.slice(i, i + CHUNK_TOKEN_AMOUNT));
  }

  logger.info(`📝 Split text into ${chunks.length} chunks`);

  // Process the chunks
  const cacheKey = crypto.createHash("md5").update(url).digest("hex");
  const chunkCachePath = path.join(__dirname, `../cache/${cacheKey}.json`);

  let chunkResponses;
  if (fs.existsSync(chunkCachePath)) {
    logger.info("📝 Using cached chunks...");
    chunkResponses = JSON.parse(fs.readFileSync(chunkCachePath, "utf8"));
  } else {
    logger.info("📝 Processing chunks...");
    chunkResponses = await processChunks(chunks, cleanText);
    fs.writeFileSync(chunkCachePath, JSON.stringify(chunkResponses));
  }

  const factList = chunkResponses.join("\n");
  logger.info(`📝 Generated ${factList.split("\n").length} facts`);

  // Generate the summary
  const summaryPrompt = `
Please summarize the following webpage. Focus on the main points and key takeaways that are relevant to the user's request.

Webpage URL: ${cleanedUrl}

User's request: ${userPrompt}

Webpage facts:
${JSON.stringify(factList, null, 2)}`;

  logger.info(
    `📝 Summary prompt (first 500 chars): ${summaryPrompt.substring(0, 500)}...`
  );

  const summaryCompletion = await llmHelper.createChatCompletion(
    [{ role: "user", content: summaryPrompt }],
    { model: "gpt-4-0125-preview", max_tokens: 3072 }
  );

  const summary = summaryCompletion.content;
  logger.info(`📝 Generated summary length: ${summary.length}`);

  // Cache the summary
  fs.writeFileSync(cachePath, summary);
  logger.info(`📝 Summary cached at ${cachePath}`);

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
  logger.info(`🚀 handleCapabilityMethod in web.js called with:`);
  logger.info(`- method: ${method}`);
  logger.info(`- args: ${JSON.stringify(args)}`);
  logger.info(
    `- messages: ${messages ? "defined" : "undefined"}, length: ${
      messages?.length
    }`
  );

  try {
    logger.info(`Attempting to get userPrompt`);
    const userPrompt = messages ? lastUserMessage(messages) : "";
    logger.info(`userPrompt: ${userPrompt}`);

    logger.info(`Attempting to destructure args`);
    const url = destructureArgs(args)[0];
    logger.info(`url: ${url}`);

    if (method === "fetchAndSummarizeUrl") {
      logger.info(`Calling fetchAndSummarizeUrl`);
      const summary = await fetchAndSummarizeUrl(url, userPrompt);
      logger.info(`fetchAndSummarizeUrl completed`);
      return summary;
    } else if (method === "fetchAllLinks") {
      logger.info(`Calling fetchAllLinks`);
      const links = await fetchAllLinks(url);
      logger.info(`fetchAllLinks completed`);
      return links;
    } else if (method === "fetchLargestImage") {
      logger.info(`Calling fetchLargestImage`);
      const image = await fetchLargestImage(url);
      logger.info(`fetchLargestImage completed`);
      return image;
    } else {
      throw new Error(`Unknown method: ${method}`);
    }
  } catch (error) {
    logger.error(`Error in handleCapabilityMethod: ${error.message}`);
    logger.error(`Error stack: ${error.stack}`);
    return `Error handling capability: ${error.message}`;
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
