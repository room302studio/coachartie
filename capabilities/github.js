const { Octokit } = require("@octokit/rest");
const { graphql } = require("@octokit/graphql");
const { createAppAuth } = require("@octokit/auth-app");
const dotenv = require("dotenv");

dotenv.config();

class GithubCoach {
  constructor() {
    console.log("Initializing GithubCoach...");
    this._init();
  }

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
    return response.data.map((repo) => `${repo.name} - ${repo.description}`);
  }

  async listUserRepos(username) {
    const response = await this.octokit.repos.listForUser({
      username: username,
      per_page: 100,
    });
    return response.data.map((repo) => `${repo.name} - ${repo.description}`);
  }

  async getProjectIdFromUrl(url) {
    const [, , , username, , , projectId] = url.split("/");
    const { data: projects } = await this.octokit.projects.listForUser({ username });
    console.log("PROJECTS", projects);
    const project = projects.find(project => project.html_url === url);
    console.log("PROJECT", project);
    return project ? project.id : null;
  }

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