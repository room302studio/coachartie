const axios = require("axios");
const dotenv = require("dotenv");
dotenv.config();
const logger = require("../src/logger.js")("stable-diffusion");

const { destructureArgs } = require("../helpers");

async function handleCapabilityMethod(method, args) {
  const [arg1] = destructureArgs(args);

  if (method === "generateImageFromText") {
    return generateImageFromText(arg1);
  } else {
    throw new Error(
      `Method ${method} not supported by Stable Diffusion capability.`,
    );
  }
}

/**
 * Generates an image from the given text using the Stable Diffusion API.
 * @param {Object} args - The arguments for generating the image.
 * @param {string} args.prompt - The text prompt for generating the image.
 * @returns {Promise<string>} - A promise that resolves to a JSON string representing the response data.
 * @throws {Error} - If an error occurs during the API request.
 */
async function generateImageFromText(args) {
  const stableDiffusionApiKey = process.env.STABLE_DIFFUSION_API_KEY;
  const [prompt] = destructureArgs(args);

  try {
    const response = await axios.post(
      "https://stablediffusionapi.com/api/v3/text2img",
      {
        key: stableDiffusionApiKey,
        prompt: prompt,
        negative_prompt: null,
        width: "512",
        height: "512",
        samples: "1",
        num_inference_steps: "20",
        seed: null,
        guidance_scale: 7.5,
        safety_checker: "yes",
        multi_lingual: "no",
        panorama: "no",
        self_attention: "no",
        upscale: "no",
        embeddings_model: null,
        webhook: null,
        track_id: null,
      },
    );

    logger.info(response.data);
    return JSON.stringify(response.data);
  } catch (error) {
    logger.info(error);
  }
}

module.exports = {
  handleCapabilityMethod,
};
