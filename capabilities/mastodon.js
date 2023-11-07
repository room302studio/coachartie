const Mastodon = require('mastodon-api');
const { destructureArgs } = require("../helpers");

const M = new Mastodon({
  access_token: 'your_access_token',
  timeout_ms: 60*1000,  // optional HTTP request timeout to apply to all requests.
  api_url: 'https://mastodon.social/api/v1/', // optional, defaults to https://mastodon.social/api/v1/
});

async function postStatus(status) {
  return M.post('statuses', { status });
}

async function searchKeyword(keyword) {
  return M.get('search', { q: keyword, resolve: true });
}

module.exports = {
  handleCapabilityMethod: async (method, args) => {
    const [arg1] = destructureArgs(args);

    switch (method) {
      case "postStatus":
        return await postStatus(arg1);
      case "searchKeyword":
        return await searchKeyword(arg1);
      default:
        throw new Error(`Invalid method: ${method}`);
    }
  },
};