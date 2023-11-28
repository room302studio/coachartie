const axios = require("axios");
const { createCanvas, loadImage } = require("canvas");
const { destructureArgs } = require("../helpers");
const puppeteer = require('puppeteer');

let mermaid;
try {
  mermaid = require.resolve("mermaid");
} catch (error) {
  console.error("Failed to resolve mermaid module:", error);
}

const convertMermaidDiagram = async (diagramText) => {
  try {
    const browser = await puppeteer.launch();
    const page = await browser.newPage();

    // we need to clean the diagram text- sometimes it might come in a code block like
    /* 
    ```mermaid
      graph LR;
          A[Conservation Efforts] -- Fighting by --> B[Large Water Users];
          B -- Legal Actions --> A;
          A -- Influences --> C[Groundwater Levels];
          B -- Affects --> C;
          D[Local Communities] -- Impacted by --> C;
          C -- Necessitates --> E[Regulatory Measures];
          E --> A;
          D --> B;
          E -. Lobbies against .-> B;
          A -.- E;
      ```

      so we need to check for the ```mermaid and ``` and remove them if they exist
    */
    if (diagramText.startsWith("```mermaid")) {
      diagramText = diagramText.replace("```mermaid", "");
    }
    if (diagramText.endsWith("```")) {
      diagramText = diagramText.replace("```", "");
    }



    // Load the Mermaid library
    await page.addScriptTag({path: require.resolve('mermaid/dist/mermaid.min.js')});

    // Set up the diagram
    await page.setContent(`
      <div id="mermaid">${diagramText}</div>
      <script>
        mermaid.initialize({startOnLoad: true});
        mermaid.init(undefined, '#mermaid');
      </script>
    `);

    // Wait for the diagram to render
    await page.waitForSelector('svg');

    // Get the entire page/svg
    const svgHandle = await page.$('svg');
    const svgBoundingBox = await svgHandle.boundingBox();
    const screenshot = await page.screenshot({
      // clip: {
      //   x: svgBoundingBox.x,
      //   y: svgBoundingBox.y,
      //   width: svgBoundingBox.width,
      //   height: svgBoundingBox.height
      // },
      // quality: 100, // Increase the quality to 100
      fullPage: true, // Capture the full page
      deviceScaleFactor: 4// Increase the DPI to 2x
    });

    await browser.close();

    return { image: screenshot };
  } catch (error) {
    throw new Error(`Error occurred while converting Mermaid diagram: ${error}`);
  }
};

async function handleCapabilityMethod(method, args) {
  const [arg1] = destructureArgs(args);

  if (method === "convertMermaidDiagram") {
    return convertMermaidDiagram(arg1);
  } else {
    throw new Error(
      `Method ${method} not supported by Mermaid capability.`
    );
  }
}

module.exports = {
  handleCapabilityMethod,
};