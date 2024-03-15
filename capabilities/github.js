const { Octokit } = require("@octokit/rest");
const { graphql } = require("@octokit/graphql");
const { createAppAuth } = require("@octokit/auth-app");
const dotenv = require("dotenv");
const { destructureArgs } = require("../helpers");
const logger = require("../src/logger.js")("github");

dotenv.config();

class GithubCoach {
  constructor() {
    logger.info("Initializing GithubCoach...");
    this._init();
  }

  async _init() {
    try {
      this.octokit = new Octokit({
        auth: process.env.GITHUB_PERSONAL_ACCESS_TOKEN,
        userAgent: "github-capability",
        timeZone: "America/New_York",
        baseUrl: "https://api.github.com",
        log: {
          debug: () => {},
          info: () => {},
          warn: console.warn,
          error: logger.info,
        },
      });

      this.graphqlWithAuth = graphql.defaults({
        headers: {
          authorization: `token ${process.env.GITHUB_PERSONAL_ACCESS_TOKEN}`,
        },
      });
    } catch (error) {
      logger.info(error);
    }
  }

  /**
   * Creates a new repository.
   * @param {string} repositoryName - The name of the repository.
   * @returns {Promise<Object>} The response from the Github API.
   */
  async createRepo(repositoryName) {
    const response = await this.octokit.repos.createForAuthenticatedUser({
      name: repositoryName,
    });
    logger.info("create repo response");
    return JSON.stringify(response);
  }

  /**
   * Clones a repository.
   * @param {string} repositoryUrl - The URL of the repository.
   */
  async cloneRepo(repositoryUrl) {
    // execute the shell command to clone the repository
    // and return the result
    const { exec } = require("child_process");
    exec(`git clone ${repositoryUrl}`, (error, stdout, stderr) => {
      if (error) {
        logger.info(`error: ${error.message}`);
        return;
      }
      if (stderr) {
        logger.info(`stderr: ${stderr}`);
        return;
      }
      logger.info(`stdout: ${stdout}`);
      return stdout;
    });
  }

  /**
   * Lists the repositories of the authenticated user.
   * @returns {Promise<Array<string>>} An array of repository names and descriptions.
   */
  async listRepos() {
    const response = await this.octokit.repos.listForAuthenticatedUser();
    return response.data.map((repo) => `${repo.name} - ${repo.description}`);
  }

  /**
   * Lists the repositories of a user.
   * @param {string} username - The username of the user.
   * @returns {Promise<Array<string>>} An array of repository names and descriptions.
   */
  async listUserRepos(username) {
    const response = await this.octokit.repos.listForUser({
      username: username,
      per_page: 100,
    });
    logger.info("listUserRepos response", response);
    return response.data.map((repo) => `${repo.name} - ${repo?.description}`);
  }

  /**
   * Gets the project ID from a URL.
   * @param {string} url - The URL of the project.
   * @returns {Promise<string|null>} The project ID, or null if the project was not found.
   */
  async getProjectIdFromUrl(url) {
    const [, , , username, , , projectId] = url.split("/");
    const { data: projects } = await this.octokit.projects.listForUser({
      username,
    });
    const project = projects.find((project) => project.html_url === url);
    return project ? project.id : null;
  }

  /**
   * Lists the projects of a user.
   * @param {string} username - The username of the user.
   * @returns {Promise<string>} A stringified array of project nodes.
   */
  async listUserProjects(username) {
    const data = await this.graphqlWithAuth(`
      query {
        user(login: "${username}") {
          projects(first: 20) {
            nodes {
              name
            }
          }
        }
      }
    `);

    const projects = data.user.projects.nodes;
    if (!projects) {
      return "No projects found for this user.";
    }

    // return projects.map((project) => project.name);
    return JSON.stringify(projects);
  }

  /**
   * Lists the project columns and cards of a project.
   * @param {string} projectId - The ID of the project.
   * @returns {Promise<string>} A stringified array of project nodes.
   */
  async listProjectColumnsAndCards(projectId) {
    const data = await this.graphqlWithAuth(`
      query {
        node(id: "${projectId}") {
          ... on Project {
            columns(first: 20) {
              nodes {
                name
                cards {
                  nodes {
                    content {
                      __typename
                      ... on Issue {
                        title
                        body
                      }
                      ... on PullRequest {
                        title
                      }
                    }
                  }
                }
              }
            }
          }
        }
      }
    `);

    const columns = data.node.columns.nodes;
    if (!columns) {
      return "No columns found for this project.";
    }

    return columns.map((column) => {
      const cards = column.cards.nodes.map((card) => {
        const content = card.content;
        if (content.__typename === "Issue") {
          return `Issue: ${content.title}\n${content.body}`;
        } else if (content.__typename === "PullRequest") {
          return `Pull Request: ${content.title}`;
        } else {
          return "";
        }
      });
      return `${column.name}:\n${cards.join("\n")}`;
    });
  }

  /**
   * Adds a draft issue to a project.
   * @param {string} projectId - The ID of the project.
   * @param {string} issueTitle - The title of the issue.
   * @param {string} issueBody - The body of the issue.
   * @returns {Promise<string>} A stringified response from the Github API.
   */
  async addDraftIssueToProject(projectId, issueTitle, issueBody) {
    const data = await this.graphqlWithAuth(`
      mutation {
        addProjectCard(input: { projectId: "${projectId}", contentId: "${projectId}", contentType: "Issue", note: "${issueBody}" }) {
          clientMutationId
        }
      }
    `);

    return data.addProjectCard
      ? "Draft issue added to project."
      : "Failed to add draft issue to project.";
  }

  /**
   * Creates a branch in a repository.
   * @param {string} repositoryFullName - The full name of the repository, in the format of owner/repo.
   * @param {string} branchName - The name of the branch.
   * @returns {Promise<Object>} The response from the Github API.
   */
  async createBranch(repositoryFullName, branchName) {
    const [owner, repositoryName] = repositoryFullName.split("/");
    branchName = branchName.trim();

    const baseRef = await this.octokit.git.getRef({
      owner,
      repo: repositoryName,
      ref: "heads/master",
    });

    const baseSHA = baseRef.data.object.sha;

    const response = await this.octokit.git.createRef({
      owner,
      repo: repositoryName,
      ref: `refs/heads/${branchName}`,
      sha: baseSHA,
    });

    return response.data;
  }

  /**
   * Lists the branches of a repository.
   * @param {string} repositoryName - The name of the repository.
   * @returns {Promise<Array<Object>>} An array of branch objects.
   */
  async listBranches(repositoryName) {
    const response = await this.octokit.repos.listBranches({
      owner: process.env.GITHUB_USER,
      repo: repositoryName,
    });
    return response.data;
  }

  /**
   * Creates a file in a repository.
   * @param {string} repositoryName - The name of the repository.
   * @param {string} filePath - The path of the file.
   * @param {string} content - The content of the file.
   * @param {string} commitMessage - The commit message.
   * @returns {Promise<Object>} The response from the Github API.
   */
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

  /**
   * Adds an issue to a repository.
   * @param {string} ownerName - The name of the owner.
   * @param {string} repositoryName - The name of the repository.
   * @param {string} issueTitle - The title of the issue.
   * @param {string} issueBody - The body of the issue.
   * @returns {Promise<Object>} - A promise that resolves to the created issue data.
   */
  async addIssueToRepo(ownerName, repositoryName, issueTitle, issueBody) {
    const response = await this.octokit.issues.create({
      owner: ownerName,
      repo: repositoryName,
      title: issueTitle,
      body: issueBody,
    });
    return JSON.stringify(response.data);
  }

  /**
   * Creates a gist.
   * @param {string} fileName - The name of the file.
   * @param {string} description - The description of the gist.
   * @param {string} contentString - The content of the gist.
   * @returns {Promise<string>} A message containing the URL of the created gist.
   */
  async createGist(fileName, description, contentString) {
    const response = await this.octokit.gists.create({
      files: {
        [fileName]: {
          content: contentString,
        },
      },
      description: description,
      public: true,
    });

    return `Gist created! You can access it at <${response.data.html_url}> - remember not to use markdown in your response.`;
  }

  /**
   * Edits a file in a repository.
   * @param {string} repositoryName - The name of the repository.
   * @param {string} filePath - The path of the file.
   * @param {string} newContent - The new content of the file.
   * @param {string} commitMessage - The commit message.
   * @returns {Promise<Object>} The response from the Github API.
   */
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

  /**
   * Deletes a file in a repository.
   * @param {string} repositoryName - The name of the repository.
   * @param {string} filePath - The path of the file.
   * @param {string} commitMessage - The commit message.
   * @returns {Promise<Object>} The response from the Github API.
   */
  async deleteFile(repositoryName, filePath, commitMessage) {
    const response = await this.octokit.repos.deleteFile({
      owner: process.env.GITHUB_USER,
      repo: repositoryName,
      path: filePath,
      message: commitMessage,
    });
    return response.data;
  }

  /**
   * Creates a pull request in a repository.
   * @param {string} repositoryName - The name of the repository.
   * @param {string} title - The title of the pull request.
   * @param {string} headBranch - The name of the head branch.
   * @param {string} baseBranch - The name of the base branch.
   * @param {string} description - The description of the pull request.
   * @returns {Promise<Object>} The response from the Github API.
   */
  async createPullRequest(
    repositoryName,
    title,
    headBranch,
    baseBranch,
    description,
  ) {
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

  /**
   * Reads the contents of a file in a repository.
   * @param {string} repositoryName - The name of the repository.
   * @param {string} filePath - The path of the file.
   * @returns {Promise<Object>} The response from the Github API.
   */
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
  /**
   * Handle a capability method.
   * @param {string} method - The name of the method.
   * @param {Array} args - The arguments for the method.
   */
  handleCapabilityMethod: async (method, args) => {
    const githubCoach = new GithubCoach();

    const destructuredArgs = destructureArgs(args);
    // logger.info("destructuredArgs", destructuredArgs);
    // destructuredArgs [ 'coachartie/test2', 'Test issue 1', 'This is a test issue' ]
    // to pass the array off arguments to each method
    // we need to
    // 1. destructure the array
    // 2. pass the destructured arguments to the method

    switch (method) {
      case "createRepo":
        // return await githubCoach.createRepo(args);
        return await githubCoach.createRepo(...destructuredArgs);
      case "addIssueToRepo":
        return await githubCoach.addIssueToRepo(...destructuredArgs);
      case "cloneRepo":
        return await githubCoach.cloneRepo(...destructuredArgs);
      case "listRepos":
        return await githubCoach.listRepos();
      case "listUserRepos":
        return await githubCoach.listUserRepos(...destructuredArgs);
      case "getProjectIdFromUrl":
        return await githubCoach.getProjectIdFromUrl(...destructuredArgs);
      case "listUserProjects":
        return await githubCoach.listUserProjects(...destructuredArgs);
      case "listProjectColumnsAndCards":
        return await githubCoach.listProjectColumnsAndCards(
          ...destructuredArgs,
        );
      case "addDraftIssueToProject":
        return await githubCoach.addDraftIssueToProject(...destructuredArgs);
      case "createBranch":
        return await githubCoach.createBranch(...destructuredArgs);
      case "listBranches":
        return await githubCoach.listBranches(...destructuredArgs);
      case "createFile":
        return await githubCoach.createFile(...destructuredArgs);
      case "createGist":
        return await githubCoach.createGist(...destructuredArgs);
      case "editFile":
        return await githubCoach.editFile(...destructuredArgs);
      case "deleteFile":
        return await githubCoach.deleteFile(...destructuredArgs);
      case "createPullRequest":
        return await githubCoach.createPullRequest(...destructuredArgs);
      case "readFileContents":
        return await githubCoach.readFileContents(...destructuredArgs);
      default:
        throw new Error(`Invalid method: ${method}`);
    }
  },
};
