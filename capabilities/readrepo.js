const { Octokit } = require("@octokit/rest");
const dotenv = require("dotenv");
const { destructureArgs } = require("../helpers");
const logger = require("../src/logger.js")("readrepo");
const { countTokens} = require('../helpers.js');

// Load environment variables from a .env file into process.env
dotenv.config();

/**
 * This capability allows you to read the entire contents of a GitHub repository (excluding binary files), concatenating all files into one long text string.
 * It's particularly useful if you want to understand the structure
 * and contents of a GitHub repository or if you want to implement changes to an existing repo, by specifying its URL and the requested changes.
 *
 * @capability {name} "GitHub Repository Reader"
 * @description "Reads all code/text files from a specified GitHub repository, concatenates them into a single string,
 *               and prepends the path and filename to each file's content. Useful for reviewing or modifying repository content."
 * @param {string} owner - The GitHub username or organization name of the repository owner.
 * @param {string} repo - The name of the repository.
 * @returns {Promise<string>} A promise that resolves to a string containing the concatenated contents of the repository's code/text files.
 */

class RepoReader {
  constructor() {
    this.octokit = new Octokit({ auth: process.env.GITHUB_TOKEN });
    logger.info("RepoReader initialized with Octokit client.");
  }

  async readRepositoryContents(owner, repo) {
    logger.info(`Starting to read repository contents for ${owner}/${repo}.`);
    const readDir = async (path = "") => {
      logger.info(`Fetching contents for path: ${path}`);
      const contentList = await this.octokit.repos.getContent({
        owner,
        repo,
        path,
      });
      let allContents = "";

      for (const content of contentList.data) {
        if (content.type === "dir") {
          logger.info(`Found directory: ${content.path}, recursing into it.`);
          allContents += await readDir(content.path);
        } else if (
          content.type === "file" &&
          content.size <= 10485760 &&
          !content.path.includes(".git")
        ) {
          logger.info(`Found file: ${content.path}, fetching content.`);
          const fileContent = await this.octokit.repos.getContent({
            owner,
            repo,
            path: content.path,
          });
          logger.info(`${content.path} content fetched ${fileContent.data.content.length}`);
          const fileData = Buffer.from(
            fileContent.data.content,
            "base64",
          ).toString("utf8");
          allContents += `File: ${content.path}\n\n${fileData}\n\n`;
          logger.info(`Content fetched for file: ${content.path}`);
        }
      }

      return allContents;
    };

    const contents = await readDir();
    logger.info(`Completed reading repository contents for ${owner}/${repo}.`);
    logger.info(`Contents length: ${contents.length}`);
    // make sure contents is a string
    console.log(contents)
    // count the tokens in the content string
    logger.info('Counting tokens')
    // const tokenCount = countTokens(contents);
    // logger.info(`Token count: ${tokenCount}`);
    const contentsStringified = JSON.stringify(contents);
    logger.info(`Content string length: ${contentsStringified.length}`);
    const tokenCount = countTokens(contentsStringified);
    logger.info(`Token count: ${tokenCount}`);
    // return contents;
    return contentsStringified;
  }
}

function handleCapabilityMethod(methodName, args) {
  const [arg1, arg2] = destructureArgs(args);

  switch (methodName) {
    case "readRepositoryContents":
      const repoReader = new RepoReader();
      return repoReader.readRepositoryContents(arg1, arg2);
    default:
      throw new Error("Invalid operation");
  }
}

module.exports = {
  handleCapabilityMethod,
};
