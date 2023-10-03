const { Octokit } = require("@octokit/rest");
const { graphql } = require("@octokit/graphql");
const { createAppAuth } = require("@octokit/auth-app");
const dotenv = require("dotenv");

dotenv.config();

/**
 * This class provides methods to interact with Github.
 * @class GithubCoach
 */
class GithubCoach {
  /**
   * Constructor for GithubCoach class.
   * Initializes the GithubCoach.
   */
  constructor() {
    console.log("Initializing GithubCoach...");
    this._init();
  }

  /**
   * Initializes the GithubCoach.
   * @private
   */
  async _init() {
    try {
      this.octokit = new Octokit({
        // auth: authentication.token,
        auth: process.env.GITHUB_PERSONAL_ACCESS_TOKEN,
        userAgent: "github-capability",
        timeZone: "America/New_York",
        baseUrl: "https://api.github.com",
        log: {
          debug: () => { },
          info: () => { },
          warn: console.warn,
          error: console.error,
        },
        userAgent: "Coach-Artie/1.0.0"
      });

      this.graphqlWithAuth = graphql.defaults({
        headers: {
          authorization: `token ${process.env.GITHUB_PERSONAL_ACCESS_TOKEN}`,
        },
      });

    }
    catch (error) {
      console.log(error);
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
    return response.data;
  }

  /**
   * Clones a repository.
   * @param {string} repositoryUrl - The URL of the repository.
   */
  async cloneRepo(repositoryUrl) {
    // implement clone repository functionality
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
    return response.data.map((repo) => `${repo.name} - ${repo.description}`);
  }

  /**
   * Gets the project ID from a URL.
   * @param {string} url - The URL of the project.
   * @returns {Promise<string|null>} The project ID, or null if the project was not found.
   */
  async getProjectIdFromUrl(url) {
    const [, , , username, , , projectId] = url.split("/");
    const { data: projects } = await this.octokit.projects.listForUser({ username });
    console.log("PROJECTS", projects);
    const project = projects.find(project => project.html_url === url);
    console.log("PROJECT", project);
    return project ? project.id : null;
  }

  /**
   * Lists the projects of a user.
   * @param {string} username - The username of the user.
   * @returns {Promise<string>} A stringified array of project nodes.
   */
  async listUserProjects(username) {
    // const { data: projects } = await this.octokit.projects.listForUser({ username });
    // return projects.map(project => project.name);
    // so this uses the rest API which only works for old projects :(
    // new projects have to be accessed with the graphql API
    // joy!
    const data = await this.graphqlWithAuth(`query {
      user(login: "${username}") {
        projectsV2(first: 20) {
          nodes {
            id
            title
          }
        }
      }
    }`)

    console.log('🔴', data);
    console.log('🟢', data.user)

    if(!data.user.projectsV2.nodes) {
      return 'no projects found for this user';
    }

    console.log('🟡', data.user.projectsV2.nodes)
    
    return JSON.stringify(data.user.projectsV2.nodes)
  }


  /**
   * Lists the project columns and cards of a project.
   * @param {string} projectId - The ID of the project.
   * @returns {Promise<string>} A stringified array of project nodes.
   */
  async listProjectColumnsAndCards(projectId) {
    // need to use projectsV2 and graphql for this
    // https://docs.github.com/en/graphql/reference/objects#projectcolumn
    // https://docs.github.com/en/graphql/reference/objects#projectcard
    // https://docs.github.com/en/graphql/reference/objects#projectcarditem
    // https://docs.github.com/en/graphql/reference/objects#projectcardstate
    const data = await this.graphqlWithAuth(`query {
      node(id: "${projectId}") {
        ... on ProjectV2 {
          items(first: 20) {
            nodes{
              id
              fieldValues(first: 8) {
                nodes{                
                  ... on ProjectV2ItemFieldTextValue {
                    text
                    field {
                      ... on ProjectV2FieldCommon {
                        name
                      }
                    }
                  }
                  ... on ProjectV2ItemFieldDateValue {
                    date
                    field {
                      ... on ProjectV2FieldCommon {
                        name
                      }
                    }
                  }
                  ... on ProjectV2ItemFieldSingleSelectValue {
                    name
                    field {
                      ... on ProjectV2FieldCommon {
                        name
                      }
                    }
                  }
                }              
              }
              content{              
                ... on DraftIssue {
                  title
                  body
                }
                ...on Issue {
                  title
                  assignees(first: 10) {
                    nodes{
                      login
                    }
                  }
                }
                ...on PullRequest {
                  title
                  assignees(first: 10) {
                    nodes{
                      login
                    }
                  }
                }
              }
            }
          }
        }
      }
    }`)

    console.log('🔴', data);
    console.log('🟢', data.node.items.nodes)

    if(!data.node.items.nodes) {
      return 'no columns found for this project';
    }

    return JSON.stringify(data.node.items.nodes)

  }

  /**
   * Adds a draft issue to a project.
   * @param {string} projectId - The ID of the project.
   * @param {string} issueTitle - The title of the issue.
   * @param {string} issueBody - The body of the issue.
   * @returns {Promise<string>} A stringified response from the Github API.
   */
  async addDraftIssueToProject(projectId, issueTitle, issueBody) {
    /*
   gh api graphql -f query='
  mutation {
    addProjectV2DraftIssue(input: {projectId: "PROJECT_ID" title: "TITLE" body: "BODY"}) {
      projectItem {
        id
      }
    }
  }'

  */
    const data = await this.graphqlWithAuth(`mutation {
      addProjectV2DraftIssue(input: {projectId: "${projectId}" title: "${issueTitle}" body: "${issueBody}"}) {
        projectItem {
          id
        }
      }
    }`)

    return JSON.stringify(data)
  }

  /**
   * Creates a branch in a repository.
   * @param {string} repositoryFullName - The full name of the repository, in the format of owner/repo.
   * @param {string} branchName - The name of the branch.
   * @returns {Promise<Object>} The response from the Github API.
   */
  async createBranch(repositoryFullName, branchName) {
    // a repository full name is in the format of owner/repo
    const [owner, repositoryName] = repositoryFullName.split("/");

    console.log('🔴', owner, repositoryName);

    // trim any preceding or trailing whitespace from branchName
    branchName = branchName.trim();

    const baseRefMaster = await this.octokit.git.getRef({
      owner,
      repo: repositoryName,
      ref: "heads/master",
    });

    const baseRef = baseRefMaster;

    const baseSHA = baseRef.data.object.sha;

    // use octokit.rest.git.createRef
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
   * Creates a gist.
   * @param {string} fileName - The name of the file.
   * @param {string} description - The description of the gist.
   * @param {string} contentString - The content of the gist.
   * @returns {Promise<string>} A message containing the URL of the created gist.
   */
  async createGist(fileName, description, contentString) {
    // content string may contain newlines and we need to convert them to \n
    // contentString = contentString.replace(/\n/g, "\\n");

    console.log('Making gist from string: \n', contentString);

    const response = await this.octokit.gists.create({
      files: {
        [fileName]: {
          // content: `${contentString}`,
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
  GithubCoach,
};