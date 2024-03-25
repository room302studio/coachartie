const puppeteer = require("puppeteer");
const cheerio = require("cheerio");
const dotenv = require("dotenv");
dotenv.config();
const { webPageToText, webpageToHTML } = require("./web.js"); // Adjust the path as necessary
const { destructureArgs, createChatCompletion } = require("../helpers");
const { storeUserMemory } = require("../src/remember");
const logger = require("../src/logger.js")("ingest-capability");
const { convert } = require("html-to-text");
const fs = require("fs");
const path = require("path");
const crypto = require("crypto");

const cacheDir = path.join(__dirname, "cache");
if (!fs.existsSync(cacheDir)) {
  fs.mkdirSync(cacheDir, { recursive: true });
}

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

  // TODO: Cache the text-ified version of the URL for a certain amount of time
  // Generate a hash for the URL
  // const urlHash = crypto.createHash("md5").update(url).digest("hex");
  // const cacheFilePath = path.join(cacheDir, `${urlHash}.json`);

  // // Check if cache exists and is recent (e.g., less than 1 hour old)
  // if (
  //   fs.existsSync(cacheFilePath) &&
  //   Date.now() - fs.statSync(cacheFilePath).mtimeMs < 3600000
  // ) {
  //   console.log("Using cached data");
  //   return fs.readFileSync(cacheFilePath, "utf8");
  // }

  try {
    const { html } = await webpageToHTML(url);
    const document = convert(html, {
      wordwrap: 130,
    });

    const messages = [
      {
        role: "user",
        content: `Can you please write an extremely long and thorough reiteration of the following document: 
${JSON.stringify(document, null, 2)}

When analyzing this document, your goal is to distill its content into concise, standalone facts, as many as you possibly can. Each fact should encapsulate a key piece of information, complete in itself, and easily understandable without needing further context. Pay special attention to precise details, especially if they involve code or search queries - accuracy in phrasing is crucial here. It's important to include relevant URLs, specific search queries, project IDs that are associated with these facts. Respond ONLY with the facts, do not greet me or confirm the request. Keep your response above 1000 words and below 5000 words, please.

Make separate sections of facts for each section of the document, using \`\`\`---\`\`\` between each section. Respond immediately, beginning with the first section, no introductions or confirmation.`,
      },
    ];
    const completion = await createChatCompletion(messages, {
      max_tokens: 4000,
    });

    // because the robot was instructed to deliniate the facts with '---' we can split the response into facts
    // we need to be aware the first fact MAY be blank
    const facts = completion.split("\n---\n");

    // now that each fact is separated we can store them in the database
    facts.forEach(async (fact, index) => {
      const factAsMemory = `Memory about RESOURCE_ID: ${url}\n${fact}
(${index + 1}/${facts.length})
      `;
      await storeUserMemory(
        { username: "capability-deepdocumentingest", guild: "" },
        fact,
        "capability",
        url,
      );
    });

    const metaSummaryMessages = [
      {
        role: "user",
        content: `Can you please provide a high-level summary of the most important facts in this document: 
  ${JSON.stringify(document, null, 2)}`
      }
    ];

    const metaSummaryCompletion = await createChatCompletion(metaSummaryMessages, {
      max_tokens: 2000,
    });

    // Store the meta-summary in the database
    await storeUserMemory(
      { username: "capability-deepdocumentingest", guild: "" },
      metaSummaryCompletion,
      "capability-deepdocumentingest",
      url,
    );

    return `Document ingested successfully. ${facts.length} groups of facts were extracted from the ${url}.`;
  } catch (error) {
    throw new Error(`Error occurred while making external request: ${error}`);
  }
}

module.exports = {
  handleCapabilityMethod,
};
