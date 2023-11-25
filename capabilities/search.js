
const puppeteer = require("puppeteer");
const chance = require("chance").Chance();
const { destructureArgs } = require("../helpers");

async function getSearchResults(query) {
  const url = `https://duckduckgo.com/html/?q=${encodeURIComponent(query)}`;

  console.log(`🕸️  Scraping DuckDuckGo results for query: ${query}`);

  const browser = await puppeteer.launch();
  const page = await browser.newPage();
  await page.setUserAgent(randomUserAgent());
  await page.goto(url);

  await page.waitForSelector("#links");

  const results = await page.$$eval(".result", (elements) => {
    return elements.map((element) => {
      const title = element.querySelector(".result__title").textContent;
      const url = element.querySelector(".result__url").textContent;
      const description = element.querySelector(".result__snippet").textContent;

      return { title, url, description };
    });
  });

  await browser.close();

  console.log(`📝  Scraped ${results.length} DuckDuckGo results`);

  return results;
}

async function searchWeb(query) {
  const results = await getSearchResults(query);

  const summary = results.map((result) => {
    return `${result.title}\n${result.url}\n${result.description}\n`;
  }).join("\n");

  return summary;
}

async function handleCapabilityMethod(method, args) {
  // first we need to figure out what the method is
  // then grab the URL from the args
  // then we need to call the method with the URL
  // then we need to return the result of the method

  const query = destructureArgs(args)[0];
  if (method === "searchWeb") {
    const summary = await searchWeb(query);
    return summary;
  } 
}

function randomUserAgent() {
  const potentialUserAgents = [
    `Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/92.0.4515.159 Safari/537.36`,
    `Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/14.0 Safari/605.1.15`,
    `Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/92.0.4515.159 Safari/537.36`,
    `Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:91.0) Gecko/20100101 Firefox/91.0`,
  ];

  const pickedUserAgent = chance.pickone(potentialUserAgents);
  console.log("📝  Picked User Agent: ", pickedUserAgent);

  // use chance.choose to pick a random user agent
  return pickedUserAgent;
}

module.exports = {
  searchWeb,
  handleCapabilityMethod,
};
