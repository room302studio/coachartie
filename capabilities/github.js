const { Octokit } = require("@octokit/rest");
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
//     const auth = createAppAuth({
//       appId: process.env.GITHUB_APP_ID,
//       installationId: '37089548',
//       privateKey: `-----BEGIN RSA PRIVATE KEY-----
//       MIIEpAIBAAKCAQEAwiH2c0b2MwnvxxRrSM6qd77iRiGz5o3E8nDm1ZHh+ImhNR0v
//       Ea8bRGhGs6rbfXuFXozSJVTnS+/ZM0PxEKxyRrhOH8xhBgq07imAMLAtRU5bCB7O
//       LSongRp3Q+YbT495p3gX8YtXuS5+xlDYE/oqfWplQEZp3Iv0AGL/BcAbiMGNKo53
//       uYp6TDWWWEX/McC+bGvxogN3YWiqTM5FBvXaNyijp6VUm81+RBpCrWi9ZF3Zqs+S
//       pUR2ue23aYFi+DfDTEmUR7XLHGTUvOlPCfTpYpzUEVfp8bIMvFECQI8LbDCi0qDP
//       Wwz62gkYP0/ZWWci2ZeoeaaAPrOCWpH8CaCKRwIDAQABAoIBABsMNlUrXuQPj1vS
//       aXw0ZyXV75rL2U/XEsigmFjLQYuqSU6oKUWyev8V9DvWI0yhaBybTDAtWyiGW2G8
//       JpsnG6jkxuXBSQdZeInyOE0QTs5oM2C3Qgyi4ewn7tQD/GwiVlXR8qwRuQAxDTK+
//       Usy9vyvIJiFFbjxvN2jSYiu/71YnOxM2XH+dj9NKDSZUw+zvGia3sTBPEhY9+8Rq
//       ROt6FyaELIT9CT7mfDQQv2mMHMXUWKlW804xr0GWv1HQWhhlQneE81aQyj3/ksTP
//       z+LzS2ScE4aRrdk9jD3Dbh2grMzp5dJGNCByCPkxmzEfHrJcnKfubSUUmGyMMF/A
//       wpFn1XECgYEA80gEL3Jn6bOs+TTMAXuBQfwzyGrVF7z7vfp7nW9/KS76JZOBGgUl
//       j6iXUhamvA3/VyVvRdI5RIMP4zV0kg02GkcUhU/w74n4NIAuN04sLTAMvCk1gs4J
//       reg0EIO8ZOEcSpG3fsioxbAAPotc00d6JGog9fEHapnRbVEco+HfDp8CgYEAzEgo
//       5GKNigocxg+Z46WCbz0AV9426eF8mF6aDcqS2blHODUf7serzFTjpt9/WpQocSWy
//       7uYGTiGAsdfR1IODqy9yRA3i1X53tPH/ZdJK0HFEXQa+jb9jeLm2R02NarJ6oPmd
//       Pag6K1+C/ndan4cNklcKq9Gbe1Pz+LjLRE0Ia1kCgYEAqwR3HLt53MlX0R+SQYCG
//       jtIxvLOM9ND+zr/kYfndFCBX7E5StO3lR6WmKiiOMShN1P8Vx6lOZKEVbA1J0tnC
//       rJpHDKfzoRAGETICSxKC74kVirgVS8x29W+EGg/hQbEVaD4jFdcM/VsJ8O2a5VMb
//       w7lvTjSPmBplJEmern27hdUCgYALAmiRxm3yXpEma3jTt/vLmvIFykgTWr+oRpDu
//       5Vf8u+uGr/ZEnCY6IOkT+T+X1hxH3MxD68mzNEMHUqZQWbYi56+00zrCXsp8yf4F
//       ssutaC1TBiYG5aWqv/d+6EMS2QOa4VkEFajs5Xzd0fjkWBb3KBG/KNDEWMXxRaRO
//       zggCIQKBgQCmjNk3ef0SHJ5dXcyFrk0d066o9CAkbto6ehs3wUEcjmQUj3+Rl+LG
//       fyJeA551i7qjSKHmBnDY2fVVIP9AchGw3N5h5KhXo03R92sI+BaehC5uB25roPE2
//       TFndVIfQ8xLluGi1+WOUc3ynvsspjSdAM4ox1t+B7ox0laHR8A6Emw==
// -----END RSA PRIVATE KEY-----
// `,
//       auth: process.env.GITHUB_PERSONAL_ACCESS_TOKEN
//       // installationId: process.env.GITHUB_INSTALLATION_ID,
//     });

    // const authentication = await auth({ type: "installation" });
    this.octokit = new Octokit({
      // auth: authentication.token,
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