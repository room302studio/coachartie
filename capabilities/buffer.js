const axios = require("axios");
const dotenv = require("dotenv");
dotenv.config();

const { destructureArgs } = require("../helpers");

async function handleCapabilityMethod(method, args) {
  switch (method) {
    case "postUpdate":
      return postUpdate(...destructureArgs(args));
    case "getProfiles":
      return getProfiles();
    default:
      throw new Error(`Method ${method} not supported by Buffer capability.`);
  }
}

/**
 * Retrieves the profiles connected to the user's Buffer account.
 * @returns {Promise<Object>} - A promise that resolves to the list of profiles.
 * @throws {Error} - If an error occurs while fetching profiles.
 */
async function getProfiles() {
  const bufferApiUrl = "https://api.bufferapp.com/1/profiles.json";
  const bufferAccessToken = process.env.BUFFER_ACCESS_TOKEN;

  try {
    const response = await axios.get(bufferApiUrl, {
      headers: {
        Authorization: `Bearer ${bufferAccessToken}`,
      },
    });
    return response.data;
  } catch (error) {
    throw new Error(
      `Error occurred while fetching profiles from Buffer: ${error}`
    );
  }
}

/**
 * Posts an update to Buffer.
 * @param {string} text - The text content of the update.
 * @param {Array<string>} profileIds - The IDs of the profiles to post the update.
 * @param {string} mediaLink - The link to the media to attach to the update.
 * @param {string} mediaDescription - The description of the media.
 * @returns {Promise<Object>} - A promise that resolves to the response data from Buffer.
 * @throws {Error} - If an error occurs while posting to Buffer.
 */
async function postUpdate(text, profileIds, mediaLink, mediaDescription) {
  const bufferApiUrl = "https://api.bufferapp.com/1/updates/create.json";
  const bufferAccessToken = process.env.BUFFER_ACCESS_TOKEN;

  const payload = {
    text,
    profile_ids: profileIds,
    media: {
      link: mediaLink,
      description: mediaDescription,
    },
    access_token: bufferAccessToken, // Depending on API, may need to adjust how the token is passed
  };

  try {
    const response = await axios.post(bufferApiUrl, payload, {
      headers: {
        Authorization: `Bearer ${bufferAccessToken}`, // Assuming token is needed in the header
        "Content-Type": "application/json",
      },
    });
    return response.data;
  } catch (error) {
    throw new Error(`Error occurred while posting to Buffer: ${error}`);
  }
}

module.exports = {
  handleCapabilityMethod,
};
