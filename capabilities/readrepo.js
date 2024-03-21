const { Octokit } = require("@octokit/rest");
const dotenv = require("dotenv");

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
    }

    async readRepositoryContents(owner, repo) {
        const readDir = async (path = "") => {
            const contentList = await this.octokit.repos.getContent({ owner, repo, path });
            let allContents = "";

            for (const content of contentList.data) {
                if (content.type === "dir") {
                    allContents += await readDir(content.path);
                } else if (content.type === "file" && content.size <= 10485760 && !content.path.includes('.git')) {
                    const fileContent = await this.octokit.repos.getContent({ owner, repo, path: content.path });
                    const fileData = Buffer.from(fileContent.data.content, 'base64').toString('utf8');
                    allContents += `File: ${content.path}\n\n${fileData}\n\n`;
                }
            }

            return allContents;
        };

        return await readDir();
    }
}

module.exports = {
    handleCapabilityMethod: async (owner, repo) => {
        const reader = new RepoReader();
        return reader.readRepositoryContents(owner, repo).then(contents => contents).catch(error => `Error reading repository: ${error}`);
    }
};
