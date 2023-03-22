// This file will serve as a module used by the main discord bot in index.js

// The purpose of this file is to enable basic web browser access for the robot: given a URL, access it, parse it as JSON, and return the page contents to the main bot.

const axios = require('axios');
const cheerio = require('cheerio');

async function fetchAndParseURL(url) {
  const response = await axios.get(url);
  const $ = cheerio.load(response.data);
  
  // Return the page contents as a string removing the HTML tags
  // return $('body').text();

  // go through every element on the page and extract just the visible text, and concatenate into one long string
  let text = '';

  // const allowedTextEls = 'p, h1, h2, h3, h4, h5, h6, li, a, span, div, td, th, tr, table, blockquote, pre, code, em, strong, i, b, u, s, sub, sup, small, big, q, cite, main, nav';

  const allowedTextEls = 'p, h1, h2, h3, h4, h5, h6, a, span, div, td, th, tr, table, blockquote, pre, code, em, strong, i, b, u, s, sub, sup, small, big, q, cite, main, nav';  

  $('body *').each(function() {

    // if the text contains something like "(function()" it is probably javascript, so skip it
    // so lets check if there is function() in the text
    if ($(this).text().indexOf('function(') > -1) {
      return;
    }

    // make sure the element is actual page text, not javascript or css
    if ($(this).is(allowedTextEls)) {
      text += $(this).text() + ' ';
    }
  })

  return text;
}
const url = process.argv[2];

fetchAndParseURL(url).then((data) => {
  console.log(data);
})