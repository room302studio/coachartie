module.exports = {
  capabilities: [
    {
      slug: "wolframalpha",
      description:
        'This capability lets you retrieve a vast array of information from Wolfram Alpha. Use keyword-based queries. For instance; "7 day weather forecast for New York", astronomical data "current moon phase", linguistics "anagrams of trace" or "rhymes with demand", and translations "translate beauty to French". Wolfram Alpha is a powerful tool and is not limited to the examples provided',
      enabled: false,
      methods: [
        {
          name: "askWolframAlpha",
          description: "Make a request to the wolfram alpha API",
          parameters: [
            {
              name: "question",
            },
          ],
        },
      ],
    },
    {
      slug: "wikipedia",
      description:
        "This capability gives you the ability to search a term on Wikipedia and read the article, transforming it into a list of facts. However, it's important to note that this capability often returns the first article it finds, which might not always be the article most relevant to your search term. To work around this limitation, ensure your search terms are as specific and relevant as possible. Also consider combining this capability with other capabilities to refine the results further. Remember that this capability performs best when requests are clear, concise, and targeted. Use disambiguation pages to your advantage.",
      enabled: false,
      methods: [
        {
          name: "askWikipedia",
          description: "Make a request to the wikipedia API",
          parameters: [
            {
              name: "query",
            },
          ],
        },
      ],
    },
    {
      slug: "calculator",
      description: "This capability gives you the ability to do math.",
      methods: [
        {
          name: "calculate",
          description:
            "This method gives you the ability to add, subtract, multiply, and divide numbers.",
          parameters: [
            {
              name: "operation",
              description:
                'The operation to perform. Can be "add", "subtract", "multiply", or "divide".',
            },
            {
              name: "numbers",
              description: "An array of numbers to perform the operation on.",
            },
          ],
        },
      ],
    },
    {
      slug: "web",
      description:
        "This capability gives you the ability to access a website and read all of the text on it, and then return an array of facts that you can use to generate a memory or form a message to a user.",
      enabled: false,
      methods: [
        {
          name: "fetchAndSummarizeUrl",
          description:
            "Navigate to the URL and receive an array of facts that appear on the page",
          parameters: [
            {
              name: "url",
            },
          ],
        },
        {
          name: "fetchAllLinks",
          parameters: [
            {
              name: "url",
            },
          ],
        },
      ],
    },
    {
      slug: "chance",
      description:
        "This capability gives you ability to harness the power of chance and randomness through chance.js - given an array of strings that represent choices, randomly choose one and return it.",
      enabled: false,
      methods: [
        {
          name: "choose",
          description:
            "Given an array of strings that represent choices, randomly choose one and return it.",
          parameters: [
            {
              name: "Choice array",
            },
          ],
        },
        {
          name: "floating",
          description:
            "Given a minimum and maximum, return a random floating point number.",
          parameters: [
            {
              name: "min",
            },
            {
              name: "max",
            },
          ],
        },
        {
          name: "integer",
          description: "Given a minimum and maximum, return a random integer.",
          parameters: [
            {
              name: "min",
            },
            {
              name: "max",
            },
          ],
        },
      ],
    },
    // {
    //   slug: 'github',
    //   description: 'This capability gives you the ability to interact with GitHub repositories, projects, and gists.',
    //   methods: [
    //     {
    //       name: 'createRepo',
    //       description: 'Create a new repository.',
    //       parameters: [
    //         {
    //           name: 'repositoryName',
    //           description: 'The name of the new repository.',
    //         },
    //       ],
    //     },
    //     /* addDraftIssueToProject(projectId, issueTitle, issueBody) */
    //     {
    //       name: 'addDraftIssueToProject',
    //       description: 'This capability allows you to add a draft issue to a specific project on GitHub. This is useful for keeping track of tasks, ideas, or features that need to be implemented or discussed further.',
    //       parameters: [
    //         {
    //           name: 'projectId',
    //           description: 'The ID of the project to add the issue to. The studio Kanban has an ID of PVT_kwHOB-L_oc4ARZ1c',
    //         },
    //         {
    //           name: 'issueTitle',
    //           description: 'The title of the issue.',
    //         },
    //         {
    //           name: 'issueBody',
    //           description: 'The body of the issue.',
    //         },
    //       ],
    //     },
    //     /* listUserProjects(username) */
    //     // {
    //     //   name: 'listUserProjects',
    //     //   description: 'List all projects for a github user.',
    //     //   parameters: [
    //     //     {
    //     //       name: 'username',
    //     //       description: 'The github username of the user to list projects for.',
    //     //     },
    //     //   ],
    //     // },
    //     /* async listProjectColumnsAndCards(projectId) */
    //     {
    //       name: 'listProjectColumnsAndCards',
    //       description: 'List all columns and cards for a github project based on its ID.',
    //       parameters: [
    //         {
    //           name: 'projectId',
    //           description: 'The ID of the project to list columns and cards for.',
    //         },
    //       ],
    //     },
    //     {
    //       name: 'cloneRepo',
    //       description: 'Clone an existing repository.',
    //       parameters: [
    //         {
    //           name: 'repositoryUrl',
    //           description: 'The URL of the repository to clone.',
    //         },
    //       ],
    //     },
    //     {
    //       name: 'createGist',
    //       description: 'Create a new gist.',
    //       parameters: [
    //         {
    //           name: 'fileName',
    //           description: 'The name of the new gist.',
    //         },
    //         {
    //           name: 'description',
    //           description: 'The description of the new gist.',
    //         },
    //         {
    //           name: 'contentString',
    //           // description: 'The content of the new gist.',
    //         },
    //       ],
    //     },
    //     // {
    //     //   name: 'listRepos',
    //     //   description: 'List all repositories for the authenticated user.',
    //     //   parameters: [],
    //     // },
    //     // {
    //     //   name: 'createBranch',
    //     //   description: 'Create a new branch in a repository.',
    //     //   parameters: [
    //     //     {
    //     //       name: 'repositoryName',
    //     //       description: 'The name of the repository.',
    //     //     },
    //     //     {
    //     //       name: 'branchName',
    //     //       description: 'The name of the new branch.',
    //     //     },
    //     //   ],
    //     // },
    //     {
    //       name: 'listBranches',
    //       description: 'List all branches in a repository.',
    //       parameters: [
    //         {
    //           name: 'repositoryName',
    //           description: 'The name of the repo',
    //         },
    //       ],
    //     },
    //     {
    //       name: 'createFile',
    //       description: 'Create a new file in a repository with the specified content and commit message.',
    //       parameters: [
    //         {
    //           name: 'repositoryName',
    //         },
    //         {
    //           name: 'filePath',
    //         },
    //         {
    //           name: 'content',
    //         },
    //         {
    //           name: 'commitMessage',
    //         },
    //       ],
    //     },
    //     // {
    //     //   name: 'editFile',
    //     //   description: 'Edit an existing file in a repository with the specified new content and commit message.',
    //     //   parameters: [
    //     //     {
    //     //       name: 'repositoryName',
    //     //     },
    //     //     {
    //     //       name: 'filePath',
    //     //     },
    //     //     {
    //     //       name: 'newContent',
    //     //     },
    //     //     {
    //     //       name: 'commitMessage',
    //     //     },
    //     //   ],
    //     // },
    //     // {
    //     //   name: 'createPullRequest',
    //     //   description: 'Create a new pull request.',
    //     //   parameters: [
    //     //     {
    //     //       name: 'repositoryName',
    //     //     },
    //     //     {
    //     //       name: 'title',
    //     //       description: 'The title of the pull request.',
    //     //     },
    //     //     {
    //     //       name: 'headBranch',
    //     //       description: 'The name of the branch containing the changes you want to merge.',
    //     //     },
    //     //     {
    //     //       name: 'baseBranch',
    //     //       description: 'The name of the branch you want your changes to be pulled into.',
    //     //     },
    //     //     {
    //     //       name: 'description',
    //     //       description: 'PR description',
    //     //     },
    //     //   ],
    //     // },
    //     {
    //       name: 'readFileContents',
    //       description: 'Read the contents of a file in a repository.',
    //       parameters: [
    //         {
    //           name: 'repositoryName',
    //         },
    //         {
    //           name: 'filePath',
    //           description: 'The path to the file to read.',
    //         },
    //       ],
    //     },
    //   ],
    // },
    // {
    //   slug: 'googledrive',
    //   description: 'This capability gives you the ability to access the Google Drive of the entire studio and read files.',
    //   enabled: false,
    //   methods: [
    //     {
    //       name: 'listFiles',
    //       parameters: []
    //     },
    //     {
    //       name: 'readFile',
    //       parameters: [
    //         {
    //           name: 'fileId',
    //         }
    //       ],
    //     },
    //     {
    //       name: 'appendString',
    //       parameters: [
    //         {
    //           name: 'docId',
    //         },
    //         {
    //           name: 'text',
    //         },
    //       ],
    //     },
    //   ]
    // },
    // {
    //   slug: 'agent-generation',
    //   description: 'This capability gives you the ability to generate a new agent, which means write a prompt that gives the agent a goal and a personality. These agents will run until they decide to stop or determine they have achieved their goal. Agent prompts are stored for reuse later.',
    //   enabled: false,
    //   methods: [
    //     {
    //       name: 'generateAgentPrompt',
    //       parameters: [
    //         {
    //           name: 'userId',
    //         },
    //         {
    //           name: 'exchange',
    //         },
    //       ],
    //     },
    //     {
    //       name: 'spinUpNewAgent',
    //       description: 'This method gives you the ability to spin up a new agent to run in the background.',
    //       parameters: [
    //         {
    //           name: 'agentPrompt',
    //         },
    //       ],
    //     },
    //   ]

    // },
    // {
    //   slug: 'web-search',
    //   description: 'This capability gives you the ability to search the web for a specific term and get a list of results.',
    //   enabled: false,
    //   methods: [
    //     {
    //       name: 'searchWeb',
    //       parameters: [
    //         {
    //           name: 'searchTerm',
    //         }
    //       ],
    //     }
    //   ]
    // },
    // {
    //   slug: 'google-calendar',
    //   description: 'This capability gives you the ability to access the Google Calendars of members of the studio and see their availability.',
    //   enabled: false,
    //   methods: [
    //     {
    //       name: 'getCalendarEventsForEntireStudio',
    //     },
    //     {
    //       name: 'getCalendarEventsForUser',
    //       parameters: [
    //         {
    //           name: 'userId',
    //         }
    //       ],
    //     },
    //   ]
    // },
    // {
    //   slug: 'google-drive',
    //   description: 'This capability gives you the ability to access the Google Drive of the entire studio and read files.',
    //   enabled: false,
    //   methods: [
    //     {
    //       name: 'listFiles',
    //     },
    //     {
    //       name: 'readFile',
    //       parameters: [
    //         {
    //           name: 'fileId',
    //         }
    //       ],
    //     },
    //     {
    //       name: 'appendString',
    //       parameters: [
    //         {
    //           name: 'docId',
    //         },
    //         {
    //           name: 'text',
    //         },
    //       ],
    //     },
    //   ]
    // },
    // {
    //   slug: 'schedule',
    //   description: 'This capability lets you schedule a message (like a reminder) to be sent or a task to be performed at a specific time.',
    //   enabled: false,
    //   methods: [
    //     {
    //       name: 'scheduleDiscordMessage',
    //       parameters: [
    //         {
    //           name: 'channelId',
    //         },
    //         {
    //           name: 'message',
    //         },
    //         {
    //           name: 'time',
    //         }
    //       ],
    //     },
    //     {
    //       // Checks if there are any scheduled tasks that need to be performed
    //       // if there are, it performs them
    //       name: 'checkScheduledTasks',
    //     }
    //   ],
    // },
    // {
    //   slug: 'memory-embedding-search',
    //   description: 'This capability lets you search memories using pgvector and the memory embeddings to find similar memories.',
    //   enabled: false,
    //   methods: [
    //     {
    //       name: 'getSimilarMemories',
    //       parameters: [
    //         {
    //           name: 'memoryId',
    //         }
    //       ],
    //     },
    //     {
    //       name: 'searchMemoriesByText',
    //       parameters: [
    //         {
    //           name: 'searchTerm',
    //         }
    //       ],
    //     }
    //   ]
    // },
    // {
    //   slug: 'dynamic-state-storage',
    //   description: 'This capability lets you store and recall arbitrary data with unique slugs in the studio database on the fly.',
    //   enabled: false,
    //   methods: [
    //     {
    //       name: 'storeDynamicState',
    //       parameters: [
    //         {
    //           name: 'slug',
    //         },
    //         {
    //           name: 'data',
    //         }
    //       ],
    //     },
    //     {
    //       name: 'recallDynamicState',
    //       parameters: [
    //         {
    //           name: 'slug',
    //         }
    //       ],
    //     },
    //     {
    //       name: 'deleteDynamicState',
    //       parameters: [
    //         {
    //           name: 'slug',
    //         }
    //       ],

    //     }
    //   ]

    // },
    // {
    //   slug: 'youtube',
    //   description: 'This capability gives you the ability to search YouTube for videos and get a list of results, and also access a video and get the title, description, and transcript.',
    //   enabled: false,
    // },
    // {
    //   slug: 'github-prs',
    //   description: 'This capability gives you the ability to respond when you are mentioned in a GitHub pull request.',
    //   enabled: false,
    // },
    // {
    //   slug: 'datasette-sqlite',
    //   description: 'This capability gives you the ability to access a SQLite database and run SQL queries against it.',
    //   enabled: false,
    // },
    // {
    //   slug: 'datasette-json-api',
    //   description: 'This capability gives you the ability to access a datasette JSON API and run queries against it.',
    // },
    // {
    //   slug: 'stable-diffusion-image-generation',
    //   description: 'This capability gives you the ability to generate images using the Stable Diffusion API.',
    //   enabled: false,
    // },
    // {
    //   slug: 'twitter',
    //   description: 'This capability gives you the ability to compose and post tweets.',
    //   enabled: false
    // },
    // {
    //   slug: 'add-capability',
    //   description: 'This capability gives you the ability to create a new capability for yourself, which is a javascript file that is imported into the main bot and can be used to add new functionality. You must never add a secret capability, and you must ask a studio member to confirm that you are allowed to add a capability before you do so.',
    // },
  ],
};
