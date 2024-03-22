const puppeteer = require("puppeteer");
const cheerio = require("cheerio");
const dotenv = require("dotenv");
dotenv.config();
const { webPageToText, webpageToHTML } = require("./web.js"); // Adjust the path as necessary
const { destructureArgs } = require("../helpers");
const logger = require("../src/logger.js")("ingest-capability");

async function handleCapabilityMethod(method, args) {
  const [arg1] = destructureArgs(args);

  if (method === "deepDocumentIngest") {
    return await deepDocumentIngest(arg1);
  } else {
    throw new Error(`Method ${method} not supported by this capability.`);
  }
}

/**
 * @async
 * @function deepDocumentIngest
 * @param {string} urlOrText - The arguments object that contains the URL or the text of the document to be ingested
 * @returns {string} - The meta-summary of the document
 *
 */
async function deepDocumentIngest(urlOrText) {
  if (!urlOrText) {
    throw new Error("No URL or text provided to ingest.");
  }

  // check if the input is a URL
  const isUrl = urlOrText.startsWith("http");

  try {
    // First we need to figure out what kind of document we are looking at so we can process it properly
    // If it's Markdown we can skip a few steps

    // First, use our puppeteer web browser to turn the page into text
    // const {text: documentString} = await webPageToText(urlOrText);
    const { html } = await webpageToHTML(urlOrText);

    let document;
    if (isUrl) {
      // documentText = documentString;
      document = await parseHtmlToSections(html);
    } else {
      // documentText = urlOrText;
      // if it's a string, parse it as markdown
      document = parseMarkdownToSections(urlOrText);
    }

    console.log("document:");
    console.log(document);

    // Then, if it's a web page we use headers elements to try to split the page into logical sections
    // If it's markdown we will do the same, but with a Markdown parser

    // First we prepare by taking the headers and as much of the sections as we can, and asking the LLM to send back a list of the sections/concepts in the document

    // Once we've created our sections, we can create memories of them and store them in the database

    // Then we want to generate a meta-summary of the document based on all of those memories, and store that in the database as well

    return "Document ingested successfully.";
  } catch (error) {
    throw new Error(`Error occurred while making external request: ${error}`);
  }
}

async function parseHtmlToSections(htmlText) {
  const $ = cheerio.load(htmlText);
  const sections = [];
  let currentSection = { header: null, content: [] };

  $("h1, h2, h3, h4, h5, h6, p").each((index, element) => {
    const $element = $(element);
    const tagName = $element.prop("tagName").toLowerCase();
    const text = $element.text();

    if (
      tagName === "h1" ||
      tagName === "h2" ||
      tagName === "h3" ||
      tagName === "h4" ||
      tagName === "h5" ||
      tagName === "h6"
    ) {
      // When we hit a heading, we start a new section
      if (currentSection.header || currentSection.content.length) {
        // Save the previous section if it has content
        sections.push(currentSection);
      }
      // Start a new section with the current header
      currentSection = { header: text, content: [] };
    } else {
      // Add non-heading elements to the current section's content
      currentSection.content.push(text);
    }
  });

  // Add the last section if it has content
  if (currentSection.header || currentSection.content.length) {
    sections.push(currentSection);
  }

  return sections;
}

function parseMarkdownToSections(markdownText) {
  const tokens = marked.lexer(markdownText);
  const sections = [];
  let currentSection = { header: null, content: [] };

  tokens.forEach((token) => {
    if (token.type === "heading") {
      // When we hit a heading, we start a new section
      if (currentSection.header || currentSection.content.length) {
        // Save the previous section if it has content
        sections.push(currentSection);
      }
      // Start a new section with the current header
      currentSection = { header: token.text, content: [] };
    } else {
      // Add non-heading tokens to the current section's content
      currentSection.content.push(token);
    }
  });

  // Add the last section if it has content
  if (currentSection.header || currentSection.content.length) {
    sections.push(currentSection);
  }

  return sections;
}

module.exports = {
  handleCapabilityMethod,
};
