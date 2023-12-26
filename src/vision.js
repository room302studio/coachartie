const { openai } = require("./openai");

let imageUrl = "";
let imageDescription = "";
let isFetching = false;
let error = null;

const fetchImageDescription = async () => {
  isFetching = true;
  console.log("requesgting description of image at", imageUrl);
  try {
    const completion = await openai.createChatCompletion({
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

    imageDescription = completion.data.choices[0].message.content;
    console.log(imageDescription);
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
