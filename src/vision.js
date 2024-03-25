const { openai } = require("./openai");
const logger = require("../src/logger.js")("vision");

let imageUrl = "";
let imageDescription = "";
let isFetching = false;
let error = null;

const fetchImageDescription = async () => {
  isFetching = true;
  logger.info(`Requesting description of image at ${imageUrl}`);
  try {
    const completion = await openai.chat.completions.create({
      model: "gpt-4-vision-preview",
      max_tokens: 1024,
      messages: [
        {
          role: "user",
          content: [
            {
              type: "text",
              text: "What’s in this image? Please be as specific as possible, especially any text that may be present.",
            },
            {
              type: "image_url",
              image_url: {
                url: imageUrl,
              },
            },
          ],
        },
      ],
    });

    imageDescription = completion.choices[0].message.content;
    logger.info(imageDescription);
  } catch (err) {
    error = err;
  }
  isFetching = false;

  return imageDescription;
};

module.exports = {
  setImageUrl: (url) => (imageUrl = url),
  setImageBase64: (base64) => (imageUrl = base64),
  fetchImageDescription,
  getImageDescription: () => imageDescription,
  getIsFetching: () => isFetching,
  getError: () => error,
};
