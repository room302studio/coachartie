import axios from 'axios';

export default {
  setup() {
    let imageUrl = '';
    let imageDescription = '';
    let isFetching = false;
    let error = null;

    const fetchImageDescription = async () => {
      if (imageUrl) {
        isFetching = true;
        try {
          const response = await axios.post(`https://api.openai.com/v1/vision/detect`, {
            'image_url': imageUrl
          }, {
            headers: {
              'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`,
              'Content-Type': 'application/json'
            }
          });
          imageDescription = response.data.description;
        } catch (err) {
          error = err;
        } finally {
          isFetching = false;
        }
      }
    };

    return {
      imageUrl,
      imageDescription,
      isFetching,
      error,
      fetchImageDescription
    };
  }
};
