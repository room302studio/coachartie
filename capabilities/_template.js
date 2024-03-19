const dotenv = require("dotenv");
dotenv.config();
const axios = require("axios");

const { destructureArgs } = require("../helpers");

async function handleCapabilityMethod(method, args) {
  const [arg1] = destructureArgs(args);

  if (method === "makeExternalRequest") {
    return await makeExternalRequest(arg1);
  } else {
    throw new Error(`Method ${method} not supported by this capability.`);
  }
}

// This jsdoc documentation is parsed and passed to the robot capabilities through the manifest
/**
 * @async
 * @function makeExternalRequest
 * @param {string} url - The URL to make an external request to.
 * @returns {Promise<string>} The response from the external API, or an error message if an error occurred.
 */
async function makeExternalRequest(url) {
  try {
    const response = await axios.get(url);
    return response.data;
  } catch (error) {
    throw new Error(`Error occurred while making external request: ${error}`);
  }
}

module.exports = {
  handleCapabilityMethod,
};
