const axios = require('axios');
const cheerio = require('cheerio');

/*

{
  slug: 'wikipedia',
  description: 'This capability gives you the ability to search a term on wikipedia and read the article and turn it into a list of facts.',
  enabled: false,
  methods: [
    {
      name: 'askWikipedia',
      parameters: [
        {
          name: 'query',
          type: 'string',
        }
      ],
      returns: 'array',
    }
  ]
},

*/

async function askWikipedia(query) {
  const wikipediaApiUrl = 'https://en.wikipedia.org/w/api.php';
  const encodedQuery = encodeURIComponent(query);
  const searchParams = {
    action: 'query',
    list: 'search',
    format: 'json',
    srsearch: encodedQuery,
  };

  try {
    console.log('searchParams', searchParams);
    const searchResponse = await axios.get(wikipediaApiUrl, { params: searchParams });
    console.log('searchResponse', searchResponse);

    if (searchResponse.data.query.search.length === 0) {
      return 'No Wikipedia articles found for the given query.';
    }

    const pageId = searchResponse.data.query.search[0].pageid;
    const pageParams = {
      action: 'parse',
      prop: 'text|sections',
      pageid: pageId,
      format: 'json',
    };

    console.log('pageParams', pageParams);
    const pageResponse = await axios.get(wikipediaApiUrl, { params: pageParams });
    console.log('pageResponse', pageResponse);

    const $ = cheerio.load(pageResponse.data.parse.text['*']);

    // Remove unwanted elements like style, script, comments
    $('style, script').remove();
    $('*').contents().filter((_, elem) => elem.type === 'comment').remove();

    const articleText = $('body').text().trim();

    let trimmedArticleText = articleText

    // remove newlines and extra spaces
    trimmedArticleText = trimmedArticleText.replace(/\n/g, ' ');

    return trimmedArticleText.slice(0, 4000);

  } catch (error) {
    console.log('error', error);
    return 'Error occurred while contacting Wikipedia. Please try again later.';
  }
}

module.exports = {
  askWikipedia,
};