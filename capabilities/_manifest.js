module.exports = {
  capabilities: [
    {
      slug: 'calculator',
      description: 'This capability gives you the ability to do math.',
      methods: [
        {
          name: 'calculate',
          description: 'This method gives you the ability to add, subtract, multiply, and divide numbers.',
          returns: 'number',
          parameters: [
            {
              name: 'operation',
              type: 'string',
              description: 'The operation to perform. Can be "add", "subtract", "multiply", or "divide".'
            },
            {
              name: 'numbers',
              type: 'array',
              description: 'An array of numbers to perform the operation on.'
            }
          ]
        },
      ]
    },
    {
      slug: 'github',
      description: 'This capability gives you the ability to interact with GitHub repositories.',
      methods: [
        {
          name: 'createRepo',
          description: 'Create a new repository.',
          returns: 'object',
          parameters: [
            {
              name: 'repositoryName',
              type: 'string',
              description: 'The name of the new repository.',
            },
          ],
        },
        {
          name: 'cloneRepo',
          description: 'Clone an existing repository.',
          returns: 'void',
          parameters: [
            {
              name: 'repositoryUrl',
              type: 'string',
              description: 'The URL of the repository to clone.',
            },
          ],
        },
        {
          name: 'createGist',
          description: 'Create a new gist.',
          parameters: [
            {
              name: 'fileName',
              type: 'string',
              description: 'The name of the new gist.',
            },
            {
              name: 'description',
              type: 'string',
              description: 'The description of the new gist.',
            },
            {
              name: 'contentString',
              type: 'string',
              description: 'The content of the new gist.',
            },
          ],
        },
        {
          name: 'listRepos',
          description: 'List all repositories for the authenticated user.',
          returns: 'array',
          parameters: [],
        },
        {
          name: 'createBranch',
          description: 'Create a new branch in a repository.',
          returns: 'void',
          parameters: [
            {
              name: 'repositoryName',
              type: 'string',
              description: 'The name of the repository.',
            },
            {
              name: 'branchName',
              type: 'string',
              description: 'The name of the new branch.',
            },
          ],
        },
        {
          name: 'listBranches',
          description: 'List all branches in a repository.',
          returns: 'array',
          parameters: [
            {
              name: 'repositoryName',
              type: 'string',
              description: 'The name of the repository.',
            },
          ],
        },
        {
          name: 'createFile',
          description: 'Create a new file in a repository with the specified content and commit message.',
          returns: 'object',
          parameters: [
            {
              name: 'repositoryName',
              type: 'string',
              description: 'The name of the repository.',
            },
            {
              name: 'filePath',
              type: 'string',
              description: 'The path to the new file.',
            },
            {
              name: 'content',
              type: 'string',
              description: 'The content of the new file.',
            },
            {
              name: 'commitMessage',
              type: 'string',
              description: 'The commit message for the new file.',
            },
          ],
        },
        {
          name: 'editFile',
          description: 'Edit an existing file in a repository with the specified new content and commit message.',
          returns: 'object',
          parameters: [
            {
              name: 'repositoryName',
              type: 'string',
              description: 'The name of the repository.',
            },
            {
              name: 'filePath',
              type: 'string',
              description: 'The path to the file to edit.',
            },
            {
              name: 'newContent',
              type: 'string',
              description: 'The new content of the file.',
            },
            {
              name: 'commitMessage',
              type: 'string',
              description: 'The commit message for the file edit.',
            },
          ],
        },
        {
          name: 'createPullRequest',
          description: 'Create a new pull request.',
          returns: 'object',
          parameters: [
            {
              name: 'repositoryName',
              type: 'string',
              description: 'The name of the repository.',
            },
            {
              name: 'title',
              type: 'string',
              description: 'The title of the pull request.',
            },
            {
              name: 'headBranch',
              type: 'string',
              description: 'The name of the branch containing the changes you want to merge.',
            },
            {
              name: 'baseBranch',
              type: 'string',
              description: 'The name of the branch you want your changes to be pulled into.',
            },
            {
              name: 'description',
              type: 'string',
              description: 'The description of the changes in the pull request.',
            },
          ],
        },
        {
          name: 'readFileContents',
          description: 'Read the contents of a file in a repository.',
          returns: 'string',
          parameters: [
            {
              name: 'repositoryName',
              type: 'string',
              description: 'The name of the repository.',
            },
            {
              name: 'filePath',
              type: 'string',
              description: 'The path to the file to read.',
            },
          ],
        },
      ],
    },
    // {
    //   slug: 'evaluate',
    //   description: 'This capability gives you the ability to evaluate an exchange between a human-user and yourself and determine if you were helpful, if there are any ways you can improve, and if there are any further tasks you can do to help the user.',
    //   enabled: false,
    //   methods: [
    //     {
    //       name: 'evaluate',
    //       parameters: [
    //         {
    //           name: 'userId',
    //           type: 'string',
    //         },
    //         {
    //           name: 'exchange',
    //           type: 'array',
    //           description: 'An array of messages, where each message is a message either sent by a user or a bot. Given this exchange, you write a self-evaluation of helpfulness and a to-do list for your future self to best help the user.',
    //         }
    //       ],
    //       returns: 'string',
    //     },
    //   ]
    // },
    {
      slug: 'web',
      description: 'This capability gives you the ability to access a website and read all of the text on it, and then return an array of facts that you can use to generate a memory or form a message to a user.',
      enabled: false,
      methods: [
        {
          name: 'fetchAndSummarizeUrl',
          parameters: [
            {
              name: 'url',
              type: 'string',
            }
          ],
          returns: 'string',
        },
        {
          name: 'fetchAllLinks',
          parameters: [
            {
              name: 'url',
              type: 'string',
            }
          ],
          returns: 'string',
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
          parameters: [
            {
              name: 'Choice array',
              type: 'array',
            }
          ],
          returns: 'string',
        },
        {
          name: 'floating',
          parameters: [
            {
              name: 'min',
              type: 'number',
            },
            {
              name: 'max',
              type: 'number',
            }
          ],
          returns: 'number',
        },
        {
          name: 'integer',
          parameters: [
            {
              name: 'min',
              type: 'number',
            },
            {
              name: 'max',
              type: 'number',
            }
          ],
          returns: 'number',
        },
      ]
    },
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
    //           type: 'string',
    //         },
    //         {
    //           name: 'exchange',
    //           type: 'array',
    //         },
    //       ],
    //       returns: 'string',
    //     },
    //     {
    //       name: 'spinUpNewAgent',
    //       description: 'This method gives you the ability to spin up a new agent to run in the background.',
    //       parameters: [
    //         {
    //           name: 'agentPrompt',
    //           type: 'string',
    //         },
    //       ],
    //       returns: 'string',
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
    //           type: 'string',
    //         }
    //       ],
    //       returns: 'array',
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
    //       returns: 'array',
    //     },
    //     {
    //       name: 'getCalendarEventsForUser',
    //       parameters: [
    //         {
    //           name: 'userId',
    //           type: 'string',
    //         }
    //       ],
    //       returns: 'array',
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
    //       returns: 'array',
    //     },
    //     {
    //       name: 'readFile',
    //       parameters: [
    //         {
    //           name: 'fileId',
    //           type: 'string',
    //         }
    //       ],
    //       returns: 'string',
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
    //           type: 'string',
    //         },
    //         {
    //           name: 'message',
    //           type: 'string',
    //         },
    //         {
    //           name: 'time',
    //           type: 'string',
    //         }
    //       ],
    //       returns: 'string',
    //     },
    //     {
    //       // Checks if there are any scheduled tasks that need to be performed
    //       // if there are, it performs them
    //       name: 'checkScheduledTasks',
    //     }
    //   ],
    // },
    {
      slug: 'wolframalpha',
      description: 'This capability gives you the ability to ask Wolfram Alpha questions and get answers.',
      enabled: false,
      methods: [
        {
          name: 'askWolframAlpha',
          parameters: [
            {
              name: 'question',
              type: 'string',
            }
          ],
          returns: 'string',
        }
      ]
    },
    {
      slug: 'wikipedia',
      description: 'This capability gives you the ability to search a term on wikipedia and read the article and turn it into a list of facts.',
      enabled: false,
      methods: [
        {
          name: 'askWikipedia',
          parameters: [
            {
              name: 'query',
              type: 'string',
            }
          ],
          returns: 'array',
        }
      ]
    },
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
    //           type: 'string',
    //         }
    //       ],
    //       returns: 'array',
    //     },
    //     {
    //       name: 'searchMemoriesByText',
    //       parameters: [
    //         {
    //           name: 'searchTerm',
    //           type: 'string',
    //         }
    //       ],
    //       returns: 'array',
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
    //           type: 'string',
    //         },
    //         {
    //           name: 'data',
    //           type: 'object',
    //         }
    //       ],
    //       returns: 'string',
    //     },
    //     {
    //       name: 'recallDynamicState',
    //       parameters: [
    //         {
    //           name: 'slug',
    //           type: 'string',
    //         }
    //       ],
    //       returns: 'object',
    //     },
    //     {
    //       name: 'deleteDynamicState',
    //       parameters: [
    //         {
    //           name: 'slug',
    //           type: 'string',
    //         }
    //       ],
    //       returns: 'string',

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
  ]
}