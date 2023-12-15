const { exec } = require('child_process');
const { Octokit } = require('@octokit/rest');
const dotenv = require('dotenv');
const winston = require('winston');
dotenv.config();

// Logger setup
const logger = winston.createLogger({
  level: 'info',
  format: winston.format.json(),
  transports: [
    new winston.transports.File({ filename: 'pr-creation.log' })
  ]
});

function parseInstruction(instruction) {
  // make a request to openAI
  // return the response
  const plansFromInstruction = [
    'Edit file README.md',
    'Add a funny joke to file README.md',
  ];
  

  return plansFromInstruction.join('\n');
}

function generatePlan(plan) {
  const filesToEdit = [];
  const filesToCreate = [];

  const planLines = plan.split('\n');
  for (const planLine of planLines) {
    const planLineParts = planLine.split(' ');
    const operation = planLineParts[0].toLowerCase();
    const filePath = planLineParts[2];

    if (operation === 'Edit') {
      filesToEdit.push(filePath);
    } else if (operation === 'Add') {
      filesToCreate.push(filePath);
    }
  }

  return { filesToEdit, filesToCreate };
}

class PullRequestCreator {
  constructor() {
    this.octokit = new Octokit({
      auth: process.env.GITHUB_PERSONAL_ACCESS_TOKEN,
      userAgent: 'pull-request-creator',
      baseUrl: 'https://api.github.com',
    });
  }

  async cloneRepository(repoPath) {
    try {
      const command = `git clone https://github.com/\${repoPath}.git`;
      await this.executeCommand(command);
      logger.info('Repository cloned: ' + repoPath);
    } catch (error) {
      logger.error('Error cloning repository: ' + error);
      throw error;
    }
  }

  async executeCommand(command) {
    return new Promise((resolve, reject) => {
      exec(command, (error, stdout, stderr) => {
        if (error) {
          reject(error);
        } else {
          resolve({ stdout, stderr });
        }
      });
    });
  }

  async createPullRequest(repoPath, branchName, title, description) {
    try {
      const [owner, repo] = repoPath.split('/');
      const response = await this.octokit.pulls.create({
        owner,
        repo,
        title,
        head: branchName,
        base: 'main', // Assuming 'main' is the default branch
        body: description,
      });
      logger.info('Pull request created: ' + response.data.html_url);
      return response.data.html_url;
    } catch (error) {
      logger.error('Error creating pull request: ' + error);
      throw error;
    }
  }

  async processInstruction(repoPath, instruction) {
    try {
      await this.cloneRepository(repoPath);

      const plan = parseInstruction(instruction);
      const { filesToEdit, filesToCreate } = generatePlan(plan);

      // Execute file operations (pseudo code)
      // for each file in filesToEdit: editFile(file)
      // for each file in filesToCreate: createFile(file)

      // Commit and push changes (pseudo code)
      // this.executeCommand('git add .');
      // this.executeCommand(\`git commit -m "Automated changes for \${instruction}"\`);
      // this.executeCommand('git push');

      const prUrl = await this.createPullRequest(repoPath, 'automated-changes', 'Automated PR for ' + instruction, 'This PR contains automated changes.');

      // Cleanup operations (pseudo code)
      // Remove cloned repository directory

      return prUrl;
    } catch (error) {
      logger.error('Error processing instruction: ' + error);
      throw error;
    }
  }
}

module.exports = PullRequestCreator;