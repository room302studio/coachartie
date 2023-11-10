const axios = require("axios");
const dotenv = require("dotenv");
dotenv.config();

const { destructureArgs } = require("../helpers");

async function handleCapabilityMethod(method, args) {
  const [arg1] = destructureArgs(args);

  if (method === "generateImageFromText") {
    return generateImageFromText(arg1);
  } else {
    throw new Error(
      `Method ${method} not supported by Stable Diffusion capability.`
    );
  }
}

async function generateImageFromText(args) {
  const stableDiffusionApiKey = process.env.STABLE_DIFFUSION_API_KEY;
  const [prompt] = destructureArgs(args);

  const stableDiffusionUrl = `https://stablediffusionapi.com/api/v3/img_mixer`;

  const payload = {
    key: stableDiffusionApiKey,
    prompt: prompt,
    width: 512,
    height: 512,
    samples: 1,
    num_inference_steps: 30,
    safety_checker: "no",
    enhance_prompt: "yes",
    guidance_scale: 7.5,
    strength: 0.7,
  };

  try {
    const response = await axios.post(stableDiffusionUrl, payload);
    return response.data;
  } catch (error) {
    throw new Error(`Error occurred while contacting Stable Diffusion: ${error}`);
  }
}

module.exports = {
  handleCapabilityMethod,
};
