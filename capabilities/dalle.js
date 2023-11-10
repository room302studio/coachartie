const axios = require("axios");
const { createCanvas, loadImage } = require("canvas");

async function handleCapabilityMethod(method, args) {
  const [arg1] = destructureArgs(args);

  if (method === "generateImage") {
    return generateImage(arg1);
  } else {
    throw new Error(
      `Method ${method} not supported by Dall-E capability.`
    );
  }
}

async function generateImage(prompt) {
  try {
    const response = await axios.post('https://api.openai.com/v1/dalle-3/images', {
      prompt: prompt
    });
    const canvas = createCanvas(800, 600);
    const ctx = canvas.getContext('2d');
    const img = await loadImage(response.data.image);
    ctx.drawImage(img, 0, 0, 800, 600);
    return canvas.toBuffer();
  } catch (error) {
    throw new Error(`Error occurred while generating image: ${error}`);
  }
}

module.exports = {
  handleCapabilityMethod,
};
