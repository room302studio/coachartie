// const { Client, GatewayIntentBits, Events } = require('discord.js');
// const axios = require('axios');
const dotenv = require('dotenv');
const { createClient } = require('@supabase/supabase-js');
const { Configuration, OpenAIApi } = require("openai");
// const { TwitterApi } = require('twitter-api-v2')
// const chance = require('chance').Chance();
const puppeteer = require('puppeteer');
const { fstat } = require('fs');

dotenv.config();

const configuration = new Configuration({
  apiKey: process.env.OPENAI_API_KEY,
});
const openai = new OpenAIApi(configuration);



// This file will serve as a module used by the main discord bot in index.js

// The purpose of this file is to enable basic web browser access for the robot: given a URL, access it, parse it as JSON, and return the page contents to the main bot.



// Get the text from all text-like elements
// const allowedTextEls = 'p, h1, h2, h3, h4, h5, h6, a, span, div, td, th, tr, table, blockquote, pre, code, em, strong, i, b, u, s, sub, sup, small, big, q, cite, main, nav';

const allowedTextEls = 'p, h1, h2, h3, h4, h5, h6, a, td, th, tr, pre';

async function fetchAndParseURL(url) {
  const browser = await puppeteer.launch();
  const page = await browser.newPage();
  await page.goto(url);

  console.log('🕸️  Navigating to ' + url);

  // wait for body to load
  await page.waitForSelector('body');

  // get the page title and description
  const title = await page.title();

  // get the page description
  // const description = await page.$eval('meta[name="description"]', (element) => {
  //   return element.content;
  // });

  const description = ''

  // go through every element on the page and extract just the visible text, and concatenate into one long string
  const text = await page.$$eval(allowedTextEls, function (elements) {
    return elements.map((element) => {
      // sanitize any HTML content out of the text
      // return element.textContent.replace(/<[^>]*>?/gm, '') + ' ';
      // if <pre> wrap in backticks
      if (element.tagName === 'PRE') {
        return '```\n' + element.textContent.replace(/<[^>]*>?/gm, '') + '\n```';
      }
      return element.textContent.replace(/<[^>]*>?/gm, '') + ' ';
    }
    ).join('\n');
  })

  await browser.close();

  return { title, description, text };
}

async function processChunks(chunks, data, pageUnderstanderPrompt, limit = 2) {
  const results = [];
  const chunkLength = chunks.length;

  for (let i = 0; i < chunkLength; i += limit) {
    const chunkPromises = chunks.slice(i, i + limit).map(async (chunk, index) => {
      console.log(`📝  Sending chunk ${i + index + 1} of ${chunkLength}...`);

      const completion = await openai.createChatCompletion({
        model: "gpt-3.5-turbo",
        max_tokens: 320,
        temperature: 0.4,
        presence_penalty: 0.66,
        frequency_penalty: 0.1,
        messages: [
          {
            role: "assistant",
            content: pageUnderstanderPrompt,
          },
          {
            role: "user",
            content: `Can you give me a bullet point of facts in the following text? Bullet points should be standalone pieces of information that are meaningful and easily understood when recalled on their own. Bullet points must contain all of the context needed to understand the information. Bullet points may not refer to information contained in previous bullet points. Related facts should all be contained in a single bullet point.

                    Title: ${data.title}
                    Description: ${data.description}
                    ${chunk}          
                                `,
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

async function generateSummary(url, data) {
  console.log('📝  Generating summary...');

  const pageUnderstanderPrompt = `You are an AI language model that can extract and summarize information from webpages. Read the raw dump of text from the following webpage: ${url}. Return a bulleted list of context-rich facts from the webpage that Coach Artie, an AI studio coach, should remember to support the community, offer resources, answer questions, and foster collaboration. Ensure that each fact is a standalone piece of information that is meaningful and easily understood when recalled on its own. Only respond with bullet points, no other text.`

  // if data.text is longer than 4096 characters, split it into chunks of 4096 characters and send each chunk as a separate message and then combine the responses

  const text = data.text

  // const chunkAmount = 7000
  const chunkAmount = 4096

  // split the text into chunks of 4096 characters using slice
  let chunks = [];
  let chunkStart = 0;
  let chunkEnd = chunkAmount;
  while (chunkStart < text.length) {
    chunks.push(text.slice(chunkStart, chunkEnd));
    chunkStart = chunkEnd;
    chunkEnd += chunkAmount;
  }

  console.log(`📝  Splitting text into ${chunks.length} chunks...`);

  if (chunks.length > 26) {
    console.log('📝  Sorry, this page is too long to summarize. Please try a shorter page.');
    return;
  }

  try {
    const chunkResponses = await processChunks(chunks, data, pageUnderstanderPrompt);

    // const factList = chunkResponses.join('\n');

    return chunkResponses;
  } catch (error) {
    console.log(error);
    return error;
  }

  // summarizing does not seem to help much, so just return the fact list



  console.log(factList);

  // take the fact list and split the individual bullet points into an array
  const factListArray = factList.split('\n- ');

  // save the fact list to a file for this URL
  const fs = require('fs');

  const fileName = url.replace(/[^a-z0-9]/gi, '_').toLowerCase();

  fs.writeFileSync(`./summaries/${fileName}_facts.txt`, factList);

  console.log(`📝  Generated initial summary of ${factListArray.length} bullet points...`);

  // console.log(factListArray);

  // send the fact list to gpt4 to further summarize and filter the most important facts and re-write them so they have enough context to be understood on their own
  const summaryPrompt = `You are Coach Artie, a virtual AI coach and assistant for Room 302 Studio, an innovative and creative space where people collaborate on projects and cultivate ideas. You have advanced capabilities, including storing memories for later recall. You prioritize remembering crucial information. Today you will be asked to turn a list of facts into memories that are stored in a database. Each of these memories is a standalone piece of information that is meaningful and easily understood when recalled on its own. Read the following list of facts and return a bulleted list of only the most important facts. Ensure that each fact is a standalone piece of information that is meaningful and easily understood when recalled on its own. Only respond with bullet points, no other text.
  
  Good fact: "In the article, 'The Future of Data Visualization,' by Jane Doe, she encourages users to continue creating and sharing data visualizations with other tools despite the shutdown of Blockbuilder."
  
  Bad fact: "Article focuses on author's personal journey with data visualization and creative process"`

  const summaryCompletion = await openai.createChatCompletion({
    model: "gpt-4",
    // model: "gpt-3.5-turbo",
    temperature: 0.4,
    presence_penalty: -0.5,
    frequency_penalty: 0.1,
    max_tokens: 1024,
    messages: [
      {
        role: "system",
        content: summaryPrompt,
      },
      {
        role: "user",
        content: `Follow these instructions exactly: given this list of facts, rewrite each fact to include all necessary contextual information, such as the author, article title, and any other relevant details, to make the fact meaningful when recalled on its own. Only include facts you feel are important to remember forever. Facts must not refer to "the author", "webpage title", or "the article". Instead, facts must explicitly name the author and article title. Facts must not refer to information contained in previous facts. Related facts should all be contained in a single fact. If you return facts that refer to "the author", "webpage title", or "the article", you will be severely penalized and your users will be very disappointed in you.

        The webpage URL is: ${url}
        The webpage title is: ${data.title}
        The webpage description is: ${data.description}

        ${factList}`
      },
    ],
  });

  const summary = summaryCompletion.data.choices[0].message.content


  // Split the summary into an array of bullet points
  const summaryArray = summary.split('\n- ');

  // remove any bullet points that say "the author, "the article", or "the webpage"
  const filteredSummaryArray = summaryArray.filter((fact) => {
    const lowercaseFact = fact.toLowerCase();
    if (lowercaseFact.includes('the author') || lowercaseFact.includes('the article') || lowercaseFact.includes('the webpage') || lowercaseFact.includes('the page') || lowercaseFact.includes('the project') || lowercaseFact.includes('the website') || lowercaseFact.includes('the site') || lowercaseFact.includes('the URL') || lowercaseFact.includes('the url') || lowercaseFact.includes('the link')) {
      return false;
    } else {
      return true;
    }
  })

  console.log('---')
  console.log('📝  Summary of most important facts:');

  // re-constitute the summary into a string and log it
  const filteredSummary = filteredSummaryArray.join('\n- ');
  fs.writeFileSync(`./summaries/${fileName}_summary.txt`, filteredSummary);

  console.log(filteredSummary);

  return filteredSummaryArray;
}


// check if this is being run as a script or imported as a module
if (require.main === module) {
  // if this is being run as a script, run the main function
  main();
} else {
  // if this is being imported as a module, export the functions
  module.exports = {
    fetchAndParseURL,
    generateSummary
  };
}

function main() {

  const url = process.argv[2];

  fetchAndParseURL(url).then(async (data) => {
    // console.log(JSON.stringify(data, null, 2));  

    return generateSummary(url, data);
  })

}