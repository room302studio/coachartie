const puppeteer = require("puppeteer");
const cheerio = require("cheerio");
const dotenv = require("dotenv");
dotenv.config();
const { webPageToText, webpageToHTML } = require("./web.js"); // Adjust the path as necessary
const { destructureArgs, createChatCompletion } = require("../helpers");
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
 * @param {string} url - The arguments object that contains the URL or the text of the document to be ingested
 * @returns {string} - The meta-summary of the document
 *
 */
async function deepDocumentIngest(url) {
  // For testing:
  // node capability-player.js --runCapability="ingest:deepDocumentIngest(https://docs.pdw.co/tachio-overview)"

  try {
    // First we need to figure out what kind of document we are looking at so we can process it properly
    // If it's Markdown we can skip a few steps

    // First, use our puppeteer web browser to turn the page into text
    // const {text: documentString} = await webPageToText(url);
    const { html } = await webpageToHTML(url);

    // let document;
    // if (isUrl) {
    //   // documentText = documentString;
    //   document = await parseHtmlToSections(html);
    // } else {
    //   // documentText = url;
    //   // if it's a string, parse it as markdown
    //   document = parseMarkdownToSections(url);
    // }

    // TODO handle long unstructured text, like this:
    // 0:03:42	S: Of
    // 0:03:42	J: like,
    // 0:03:43	S: me.
    // 0:03:43	J: usually, I'll just be like because, like, sometimes the summary has, like, points and, like, set points. Sometimes I just copy and paste the points. The
    // 0:03:49	S: Gotcha.
    // 0:03:49	J: FYI, like, that's helpful knowledge.
    // 0:03:51	S: Yeah. Yeah. Cool. So and you you mentioned that it would be nice to have a simpler workflow for this. Do you have anything in mind and just, like, what we could build in to make that a bit easier? I
    // 0:04:04	J: Yeah,
    // Do we pass this to the LLM as is? Or do we need to do some pre-processing?

    console.log("html:");
    console.log(html);

    // Sketch (Phase I):
    //  - Send the entire document to the LLM
    //  - Generate the meta-summary
    //  - Store the meta-summary as a memory

    const messages = [
      {
        role: "user",
        // content: "Give me 3 rhymes for apple",
        content: `Can you please write a 1000-3000 word detailed overview summary of the following document: 
${JSON.stringify(html, null, 2)}

When analyzing this document, your goal is to distill its content into concise, standalone facts. Each fact should encapsulate a key piece of information, complete in itself, and easily understandable without needing further context. Pay special attention to precise details, especially if they involve code or search queries - accuracy in phrasing is crucial here. It's important to include relevant URLs or specific search queries that are associated with these facts, as they can serve as gateways for deeper exploration later on. The facts should not depend on each other for context, and each should be as self-contained as possible. Remember, less is more in this task; prioritize quality and relevance over quantity.`,
      },
    ];
    const completion = await createChatCompletion(messages);

    console.log("completion");
    console.log(JSON.stringify(completion, null, 2));

    // Sketch (Phase II):
    //  - For each section,
    //    - Pass the meta-summary AND the detailed section itself to the LLM
    //    - We ask for a fact list of the section
    //    - We create a memory with the fact list (which becomes an embedding)

    // Then, if it's a web page we use headers elements to try to split the page into logical sections
    // If it's markdown we will do the same, but with a Markdown parser

    // First we prepare by taking the headers and as much of the sections as we can, and asking the LLM to send back a list of the sections/concepts in the document

    // Once we've created our sections, we can create memories of them and store them in the database

    // await storeUserMemory({ username: "capability" }, rememberText);

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
