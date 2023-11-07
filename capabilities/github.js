const { Octokit } = require("@octokit/rest");
const { graphql } = require("@octokit/graphql");
const { createAppAuth } = require("@octokit/auth-app");
const dotenv = require("dotenv");

dotenv.config();

/**
 * Class representing a Github Coach.
 */
class GithubCoach {
  /**
   * Create a Github Coach.
   */
  constructor() {
    console.log("Initializing GithubCoach...");
    this._init();
  }

  /**
   * Initialize the Github Coach.
   */
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
          error: console.error,
        },
      });

      this.graphqlWithAuth = graphql.defaults({
        headers: {
          authorization: `token ${process.env.GITHUB_PERSONAL_ACCESS_TOKEN}`,
        },
      });
    } catch (error) {
      console.error(error);
    }
  }

  /**
   * Create a repository.
   * @param {string} repositoryName - The name of the repository.
   */
  async createRepo(repositoryName) {
    const response = await this.octokit.repos.createForAuthenticatedUser({
      name: repositoryName,
    });
    return response.data;
  }

  /**
   * Clone a repository.
   * @param {string} repositoryUrl - The URL of the repository.
   */
  async cloneRepo(repositoryUrl) {
    // implement clone repository functionality
  }

  /**
   * List repositories for the authenticated user.
   */
  async listRepos() {
    const response = await this.octokit.repos.listForAuthenticatedUser();
    return response.data.map((repo) => `${repo.name} - ${repo.description}`);
  }

  /**
   * List repositories for a user.
   * @param {string} username - The username of the user.
   */
  async listUserRepos(username) {
    const response = await this.octokit.repos.listForUser({
      username: username,
      per_page: 100,
    });
    return response.data.map((repo) => `${repo.name} - ${repo.description}`);
  }

  /**
   * Get the project ID from a URL.
   * @param {string} url - The URL of the project.
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
   * List projects for a user.
   * @param {string} username - The username of the user.
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

    return projects.map((project) => project.name);
  }

  /**
   * List project columns and cards.
   * @param {string} projectId - The ID of the project.
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
   * Add a draft issue to a project.
   * @param {string} projectId - The ID of the project.
   * @param {string} issueTitle - The title of the issue.
   * @param {string} issueBody - The body of the issue.
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
   * Create a branch.
   * @param {string} repositoryFullName - The full name of the repository.
   * @param {string} branchName - The name of the branch.
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
   * List branches for a repository.
   * @param {string} repositoryName - The name of the repository.
   */
  async listBranches(repositoryName) {
    const response = await this.octokit.repos.listBranches({
      owner: process.env.GITHUB_USER,
      repo: repositoryName,
    });
    return response.data;
  }

  /**
   * Create a file.
   * @param {string} repositoryName - The name of the repository.
   * @param {string} filePath - The path of the file.
   * @param {string} content - The content of the file.
   * @param {string} commitMessage - The commit message.
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
   * Create a gist.
   * @param {string} fileName - The name of the file.
   * @param {string} description - The description of the gist.
   * @param {string} contentString - The content of the gist.
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
   * Edit a file.
   * @param {string} repositoryName - The name of the repository.
   * @param {string} filePath - The path of the file.
   * @param {string} newContent - The new content of the file.
   * @param {string} commitMessage - The commit message.
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
   * Delete a file.
   * @param {string} repositoryName - The name of the repository.
   * @param {string} filePath - The path of the file.
   * @param {string} commitMessage - The commit message.
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
   * Create a pull request.
   * @param {string} repositoryName - The name of the repository.
   * @param {string} title - The title of the pull request.
   * @param {string} headBranch - The head branch of the pull request.
   * @param {string} baseBranch - The base branch of the pull request.
   * @param {string} description - The description of the pull request.
   */
  async createPullRequest(
    repositoryName,
    title,
    headBranch,
    baseBranch,
    description
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
   * Read the contents of a file.
   * @param {string} repositoryName - The name of the repository.
   * @param {string} filePath - The path of the file.
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

    switch (method) {
      case "createRepo":
        return await githubCoach.createRepo(...args);
      case "cloneRepo":
        return await githubCoach.cloneRepo(...args);
      case "listRepos":
        return await githubCoach.listRepos();
      case "listUserRepos":
        return await githubCoach.listUserRepos(...args);
      case "getProjectIdFromUrl":
        return await githubCoach.getProjectIdFromUrl(...args);
      case "listUserProjects":
        return await githubCoach.listUserProjects(...args);
      case "listProjectColumnsAndCards":
        return await githubCoach.listProjectColumnsAndCards(...args);
      case "addDraftIssueToProject":
        return await githubCoach.addDraftIssueToProject(...args);
      case "createBranch":
        return await githubCoach.createBranch(...args);
      case "listBranches":
        return await githubCoach.listBranches(...args);
      case "createFile":
        return await githubCoach.createFile(...args);
      case "createGist":
        return await githubCoach.createGist(...args);
      case "editFile":
        return await githubCoach.editFile(...args);
      case "deleteFile":
        return await githubCoach.deleteFile(...args);
      case "createPullRequest":
        return await githubCoach.createPullRequest(...args);
      case "readFileContents":
        return await githubCoach.readFileContents(...args);
      default:
        throw new Error(`Invalid method: ${method}`);
    }
  },
};
