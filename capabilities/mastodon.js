const axios = require("axios");
const dotenv = require("dotenv");
dotenv.config();

const { destructureArgs } = require("../helpers");

async function handleCapabilityMethod(method, args) {
  const [arg1, arg2] = destructureArgs(args);

  if (method === "postStatus") {
    return postStatus(arg1, arg2);
  } else {
    throw new Error(`Method ${method} not supported by Mastodon capability.`);
  }
}

/**
 * Posts a status to Mastodon.
 * @param {string} text - The text content of the status.
 * @param {string} image - The ID of the image to attach to the status.
 * @returns {Promise<Object>} - A promise that resolves to the response data from Mastodon.
 * @throws {Error} - If an error occurs while posting to Mastodon.
 */
async function postStatus(text, image) {
  const mastodonApiUrl = process.env.MASTODON_API_URL;
  const mastodonAccessToken = process.env.MASTODON_ACCESS_TOKEN;

  const payload = {
    status: text,
    media_ids: image ? [image] : undefined,
  };

  try {
    const response = await axios.post(mastodonApiUrl, payload, {
      headers: {
        Authorization: `Bearer ${mastodonAccessToken}`,
      },
    });
    return response.data;
  } catch (error) {
    throw new Error(`Error occurred while posting to Mastodon: ${error}`);
  }
}

module.exports = {
  handleCapabilityMethod,
};
