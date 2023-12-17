const axios = require("axios");
const { destructureArgs } = require("../helpers");
const puppeteer = require("puppeteer");

/**
 * Executes the provided JavaScript code in a headless browser using Puppeteer and captures a screenshot of the resulting page.
 * @param {string} javascriptCode - The JavaScript code to be executed in the browser.
 * @returns {Promise<{ image: Buffer }>} - A promise that resolves to an object containing the captured screenshot image as a Buffer.
 * @throws {Error} - If an error occurs while executing the JavaScript code and capturing the image.
 */
const executeJavascriptAndCaptureImage = async (javascriptCode) => {
  try {
    const browser = await puppeteer.launch();
    const page = await browser.newPage();

    // Load the Mermaid library
    // await page.addScriptTag({path: require.resolve('mermaid/dist/mermaid.min.js')});

    // load lodash from CDN
    await page.addScriptTag({
      url: "https://cdnjs.cloudflare.com/ajax/libs/lodash.js/4.17.21/lodash.min.js",
    });

    // load D3 from CDN
    await page.addScriptTag({
      url: "https://cdnjs.cloudflare.com/ajax/libs/d3/6.7.0/d3.min.js",
    });

    // Load tailwind CSS from CDN
    await page.addStyleTag({
      url: "https://cdnjs.cloudflare.com/ajax/libs/tailwindcss/2.2.19/tailwind.min.css",
    });

    // Set up the diagram
    await page.evaluate(javascriptCode);

    // Wait for javascript code to execute
    await new Promise((resolve) => setTimeout(resolve, 1500));

    // Get the entire page/svg
    // const svgHandle = await page.$('svg');
    // const svgBoundingBox = await svgHandle.boundingBox();
    const screenshot = await page.screenshot({
      fullPage: true, // Capture the full page
      deviceScaleFactor: 4, // Increase the DPI to 2x
    });

    await browser.close();

    return { image: screenshot };
  } catch (error) {
    throw new Error(
      `Error occurred while executing Javascript and capturing image: ${error}`,
    );
  }
};

async function handleCapabilityMethod(method, args) {
  const [arg1] = destructureArgs(args);

  if (method === "executeJavascriptAndCaptureImage") {
    return executeJavascriptAndCaptureImage(arg1);
  } else {
    throw new Error(`Method ${method} not supported by Mermaid capability.`);
  }
}

module.exports = {
  handleCapabilityMethod,
};
