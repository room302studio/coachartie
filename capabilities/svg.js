const { destructureArgs } = require("../helpers");
const puppeteer = require("puppeteer");

/**
 * Converts an SVG string to an image using Puppeteer.
 * @param {string} svgString - The SVG string to convert.
 * @returns {Promise<{ image: Buffer }>} - A promise that resolves to an object containing the converted image as a Buffer.
 * @throws {Error} - If an error occurs while converting SVG to image.
 */
const convertSvgToImage = async (svgString) => {
  try {
    const browser = await puppeteer.launch();
    const page = await browser.newPage();

    // Set up the SVG
    await page.setContent(`
      <div id="svg">${svgString}</div>
    `);

    // Wait for the diagram to render
    await page.waitForSelector("svg");

    // Get the entire page/svg
    const svgHandle = await page.$("svg");
    const svgBoundingBox = await svgHandle.boundingBox();
    const screenshot = await page.screenshot({
      clip: {
        x: svgBoundingBox.x,
        y: svgBoundingBox.y,
        width: svgBoundingBox.width,
        height: svgBoundingBox.height,
      },
      // quality: 100, // Increase the quality to 100
      // fullPage: true, // Capture the full page
      deviceScaleFactor: 4, // Increase the DPI to 2x
    });
    await browser.close();

    return { image: screenshot };
  } catch (error) {
    throw new Error(`Error occurred while converting SVG to image: ${error}`);
  }
};

async function handleCapabilityMethod(method, args) {
  const [arg1] = destructureArgs(args);

  if (method === "convertSvgToImage") {
    return convertSvgToImage(arg1);
  } else {
    throw new Error(`Method ${method} not supported by SVG capability.`);
  }
}

module.exports = {
  handleCapabilityMethod,
};
