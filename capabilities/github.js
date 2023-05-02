const { Octokit } = require("@octokit/rest");
const dotenv = require("dotenv");

dotenv.config();

class GithubCoach {
  constructor() {
    this.octokit = new Octokit({
      auth: process.env.GITHUB_TOKEN,
      userAgent: "github-capability",
      timeZome: "America/New_York",
      baseUrl: "https://api.github.com",
      log: {
        debug: () => {},
        info: () => {},
        warn: console.warn,
        error: console.error,
      },
    });
  }

  async createRepo(repositoryName) {
    const response = await this.octokit.repos.createForAuthenticatedUser({
      name: repositoryName,
    });
    return response.data;
  }

  async cloneRepo(repositoryUrl) {
    // implement clone repository functionality
  }

  async listRepos() {
    const response = await this.octokit.repos.listForAuthenticatedUser();
    return response.data;
  }

  async createBranch(repositoryName, branchName) {
    // use octokit.rest.git.createRef
    const response = await this.octokit.rest.git.createRef({
      owner: process.env.GITHUB_USER,
      repo: repositoryName,
      ref: `refs/heads/${branchName}`,
      sha: "master",
    });
    return response.data;    
  
  }

  async listBranches(repositoryName) {
    const response = await this.octokit.repos.listBranches({
      owner: process.env.GITHUB_USER,
      repo: repositoryName,
    });
    return response.data;
  }

  async createFile(repositoryName, filePath, content, commitMessage) {
    const response = await this.octokit.repos.createOrUpdateFileContents({
      owner: process.env.GITHUB_USER,
      repo: repositoryName,
      path: filePath,
      message: commitMessage,
      content: Buffer.from(content).toString("base64"),
    });
    return response.data;
  }

  async editFile(repositoryName, filePath, newContent, commitMessage) {
    const response = await this.octokit.repos.createOrUpdateFileContents({
      owner: process.env.GITHUB_USER,
      repo: repositoryName,
      path: filePath,
      message: commitMessage,
      content: Buffer.from(newContent).toString("base64"),
    });
    return response.data;
  }

  async deleteFile(repositoryName, filePath, commitMessage) {
    const response = await this.octokit.repos.deleteFile({
      owner: process.env.GITHUB_USER,
      repo: repositoryName,
      path: filePath,
      message: commitMessage,
    });
    return response.data;
  }

  async createPullRequest(repositoryName, title, headBranch, baseBranch, description) {
    const response = await this.octokit.pulls.create({
      owner: process.env.GITHUB_USER,
      repo: repositoryName,
      title: title,
      head: headBranch,
      base: baseBranch,
      body: description,
    });
    return response.data;
  }

  async readFileContents(repositoryName, filePath) {
    const response = await this.octokit.repos.getContent({
      owner: process.env.GITHUB_USER,
      repo: repositoryName,
      path: filePath,
    });
    return response.data;
  }
  
}

module.exports = {
  GithubCoach,
};