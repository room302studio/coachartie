const axios = require("axios");
const dotenv = require("dotenv");
dotenv.config();

const { destructureArgs } = require("../helpers");

var options = {
  'method': 'POST',
  'url': 'https://stablediffusionapi.com/api/v3/text2img',
  'headers': {
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({
    "key": "",
    "prompt": "ultra realistic close up portrait ((beautiful pale cyberpunk female with heavy black eyeliner))",
    "negative_prompt": null,
    "width": "512",
    "height": "512",
    "samples": "1",
    "num_inference_steps": "20",
    "seed": null,
    "guidance_scale": 7.5,
    "safety_checker": "yes",
    "multi_lingual": "no",
    "panorama": "no",
    "self_attention": "no",
    "upscale": "no",
    "embeddings_model": null,
    "webhook": null,
    "track_id": null
  })
};



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

  const response = axios.post('https://stablediffusionapi.com/api/v3/text2img', {
    "key": stableDiffusionApiKey,
    "prompt": prompt,
    "negative_prompt": null,
    "width": "512",
    "height": "512",
    "samples": "1",
    "num_inference_steps": "20",
    "seed": null,
    "guidance_scale": 7.5,
    "safety_checker": "yes",
    "multi_lingual": "no",
    "panorama": "no",
    "self_attention": "no",
    "upscale": "no",
    "embeddings_model": null,
    "webhook": null,
    "track_id": null
  })
    .then(function (response) {
      console.log(response.data);
      return response.data;
    })
    .catch(function (error) {
      console.log(error);
    });

  return response.output;
}

module.exports = {
  handleCapabilityMethod,
};
  