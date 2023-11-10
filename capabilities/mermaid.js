const axios = require("axios");
const mermaid = require("mermaid");
const { createCanvas, loadImage } = require("canvas");

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

async function convertMermaidDiagram(diagramText) {
  try {
    const svg = await mermaid.render('mermaid-svg', diagramText);
    const canvas = createCanvas(800, 600);
    const ctx = canvas.getContext('2d');
    const img = await loadImage(svg);
    ctx.drawImage(img, 0, 0, 800, 600);
    return canvas.toBuffer();
  } catch (error) {
    throw new Error(`Error occurred while converting Mermaid diagram: ${error}`);
  }
}

module.exports = {
  handleCapabilityMethod,
};
