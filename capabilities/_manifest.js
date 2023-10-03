module.exports = {
  capabilities: [
    {
      slug: 'wolframalpha',
      description: 'This capability lets you retrieve a vast array of information from Wolfram Alpha. Use keyword-based queries. For instance; "7 day weather forecast for New York", astronomical data "current moon phase", linguistics "anagrams of trace" or "rhymes with demand", and translations "translate beauty to French". Wolfram Alpha is a powerful tool and is not limited to the examples provided',
      enabled: false,
      methods: [
        {
          name: 'askWolframAlpha',
          description: 'Make a request to the wolfram alpha API',
          parameters: [
            {
              name: 'question',
            }
          ],
        }
      ]
    },
    {
      slug: 'wikipedia',
      description: 'This capability gives you the ability to search a term on Wikipedia and read the article, transforming it into a list of facts. However, it\'s important to note that this capability often returns the first article it finds, which might not always be the article most relevant to your search term. To work around this limitation, ensure your search terms are as specific and relevant as possible. Also consider combining this capability with other capabilities to refine the results further. Remember that this capability performs best when requests are clear, concise, and targeted. Use disambiguation pages to your advantage.',
      enabled: false,
      methods: [
        {
          name: 'askWikipedia',
          description: 'Make a request to the wikipedia API',
          parameters: [
            {
              name: 'query',
            }
          ],
        }
      ]
    },
    {
      slug: 'calculator',
      description: 'This capability gives you the ability to do math.',
      methods: [
        {
          name: 'calculate',
          description: 'This method gives you the ability to add, subtract, multiply, and divide numbers.',
          parameters: [
            {
              name: 'operation',
              description: 'The operation to perform. Can be "add", "subtract", "multiply", or "divide".'
            },
            {
              name: 'numbers',
              description: 'An array of numbers to perform the operation on.'
            }
          ]
        },
      ]
    },
    {
      slug: 'web',
      description: 'This capability gives you the ability to access a website and read all of the text on it, and then return an array of facts that you can use to generate a memory or form a message to a user.',
      enabled: false,
      methods: [
        {
          name: 'fetchAndSummarizeUrl',
          description: 'Navigate to the URL and receive an array of facts that appear on the page',
          parameters: [
            {
              name: 'url',
            }
          ],
        },
        {
          name: 'fetchAllLinks',
          parameters: [
            {
              name: 'url',
            }
          ],
        },
      ]
    },
    {
      slug: 'chance',
      description: 'This capability gives you ability to harness the power of chance and randomness through chance.js - given an array of strings that represent choices, randomly choose one and return it.',
      enabled: false,
      methods: [
        {
          name: 'choose',
          description: 'Given an array of strings that represent choices, randomly choose one and return it.',
          parameters: [
            {
              name: 'Choice array',
            }
          ],
        },
        {
          name: 'floating',
          description: 'Given a minimum and maximum, return a random floating point number.',
          parameters: [
            {
              name: 'min',
            },
            {
              name: 'max',
            }
          ],
        },
        {
          name: 'integer',
          description: 'Given a minimum and maximum, return a random integer.',
          parameters: [
            {
              name: 'min',
            },
            {
              name: 'max',
            }
          ],
        },
      ]
    },
    {
      slug: 'github',
      description: 'This capability gives you the ability to interact with GitHub repositories, projects, and gists.',
      methods: [
        {
          name: 'createRepo',
          description: 'Create a new repository.',
          parameters: [
            {
              name: 'repositoryName',
              description: 'The name of the new repository.',
            },
          ],
        },
        /* addDraftIssueToProject(projectId, issueTitle, issueBody) */
        {
          name: 'addDraftIssueToProject',
          description: 'This capability allows you to add a draft issue to a specific project on GitHub. This is useful for keeping track of tasks, ideas, or features that need to be implemented or discussed further.',
          parameters: [
            {
              name: 'projectId',
              description: 'The ID of the project to add the issue to. The studio Kanban has an ID of PVT_kwHOB-L_oc4ARZ1c',
            },
            {
              name: 'issueTitle',
              description: 'The title of the issue.',
            },
            {
              name: 'issueBody',
              description: 'The body of the issue.',
            },
          ],
        },
        /* listUserProjects(username) */
        // {
        //   name: 'listUserProjects',
        //   description: 'List all projects for a github user.',
        //   parameters: [
        //     {
        //       name: 'username',
        //       description: 'The github username of the user to list projects for.',
        //     },
        //   ],
        // },
        /* async listProjectColumnsAndCards(projectId) */
        {
          name: 'listProjectColumnsAndCards',
          description: 'List all columns and cards for a github project based on its ID.',
          parameters: [
            {
              name: 'projectId',
              description: 'The ID of the project to list columns and cards for.',
            },
          ],
        },
        // {
        //   name: 'cloneRepo',
        //   description: 'Clone an existing repository.',
        //   parameters: [
        //     {
        //       name: 'repositoryUrl',
        //       description: 'The URL of the repository to clone.',
        //     },
        //   ],
        // },
        {
          name: 'createGist',
          description: 'Create a new gist.',
          parameters: [
            {
              name: 'fileName',
              description: 'The name of the new gist.',
            },
            {
              name: 'description',
              description: 'The description of the new gist.',
            },
            {
              name: 'contentString',
              // description: 'The content of the new gist.',
            },
          ],
        },
        // {
        //   name: 'listRepos',
        //   description: 'List all repositories for the authenticated user.',
        //   parameters: [],
        // },
        // {
        //   name: 'createBranch',
        //   description: 'Create a new branch in a repository.',
        //   parameters: [
        //     {
        //       name: 'repositoryName',
        //       description: 'The name of the repository.',
        //     },
        //     {
        //       name: 'branchName',
        //       description: 'The name of the new branch.',
        //     },
        //   ],
        // },
        // {
        //   name: 'listBranches',
        //   description: 'List all branches in a repository.',
        //   parameters: [
        //     {
        //       name: 'repositoryName',
        //       description: 'The name of the repo',
        //     },
        //   ],
        // },
        {
          name: 'createFile',
          description: 'Create a new file in a repository with the specified content and commit message.',
          parameters: [
            {
              name: 'repositoryName',
            },
            {
              name: 'filePath',
            },
            {
              name: 'content',
            },
            {
              name: 'commitMessage',
            },
          ],
        },
        // {
        //   name: 'editFile',
        //   description: 'Edit an existing file in a repository with the specified new content and commit message.',
        //   parameters: [
        //     {
        //       name: 'repositoryName',
        //     },
        //     {
        //       name: 'filePath',
        //     },
        //     {
        //       name: 'newContent',
        //     },
        //     {
        //       name: 'commitMessage',
        //     },
        //   ],
        // },
        // {
        //   name: 'createPullRequest',
        //   description: 'Create a new pull request.',
        //   parameters: [
        //     {
        //       name: 'repositoryName',
        //     },
        //     {
        //       name: 'title',
        //       description: 'The title of the pull request.',
        //     },
        //     {
        //       name: 'headBranch',
        //       description: 'The name of the branch containing the changes you want to merge.',
        //     },
        //     {
        //       name: 'baseBranch',
        //       description: 'The name of the branch you want your changes to be pulled into.',
        //     },
        //     {
        //       name: 'description',
        //       description: 'PR description',
        //     },
        //   ],
        // },
        // {
        //   name: 'readFileContents',
        //   description: 'Read the contents of a file in a repository.',
        //   parameters: [
        //     {
        //       name: 'repositoryName',
        //     },
        //     {
        //       name: 'filePath',
        //       description: 'The path to the file to read.',
        //     },
        //   ],
        // },
      ],
    }
  ]
}