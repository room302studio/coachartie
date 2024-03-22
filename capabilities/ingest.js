const puppeteer = require("puppeteer");
const dotenv = require("dotenv");
dotenv.config();

const { destructureArgs } = require("../helpers");

async function handleCapabilityMethod(method, args) {
  const [arg1] = destructureArgs(args);

  if (method === "deepDocumentIngest") {
    return await deepDocumentIngest(arg1);
  } else {
    throw new Error(`Method ${method} not supported by this capability.`);
  }
}

// This jsdoc documentation is parsed and passed to the robot capabilities through the manifest
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

  // if it's a URL, we need to fetch the page
  
  
  try {
    

    // First we need to figure out what kind of document we are looking at so we can process it properly
    // If it's Markdown we can skip a few steps

    // First, use our puppeteer web browser to turn the page into text

    // Then, if it's a web page we use headers elements to try to split the page into logical sections
    // If it's markdown we will do the same, but with a Markdown parser

    // First we prepare by taking the headers and as much of the sections as we can, and asking the LLM to send back a list of the sections/concepts in the document

    // Once we've created our sections, we can create memories of them and store them in the database

    // Then we want to generate a meta-summary of the document based on all of those memories, and store that in the database as well



    return response.data;
  } catch (error) {
    throw new Error(`Error occurred while making external request: ${error}`);
  }
}

module.exports = {
  handleCapabilityMethod,
};
