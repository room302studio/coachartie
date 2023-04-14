module.exports = {
  capabilities: [
    {
      slug: 'remember',
      description: 'This capability gives you the ability to remember things.',
      methods: [
        {
          name: 'storeUserMemory',
          description: 'This method gives you the ability to store a memory about a user, which is bound to their user ID in the database.',
          returns: null,
          parameters: [
            {
              name: 'userId',
              type: 'string',
            },
            {
              name: 'value',
              description: 'The text of the memory.',
              type: 'string',
            },
          ]
        },
        {
          name: 'assembleMemory',
          description: 'This method gives you the ability to assemble a bunch of memories based on a conversation. The memories are an assortment of random, relevant memories, and messages this user has sent in the past. If you are in a Discord thread, the memories will include all of the most recent messages in the thread within the token limit. If you are in a DM, the memories will include the most recent messages in the DM within the token limit.',
          returns: 'array',
          parameters: []
        },
        {
          name: 'getRandomMemories',
          description: 'This method gives you the ability to get a random N number of memories from the database.',
          returns: 'array',
          parameters: [
            {
              name: 'numberOfMemories',
              type: 'number',
              description: 'The number of memories to get.'
            }
          ]
        },
      ]
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
    // {
    //   slug: 'web',
    //   description: 'This capability gives you the ability to access a website and read all of the text on it, and then return an array of facts that you can use to generate a memory or form a message to a user.',
    //   enabled: false,
    //   methods: [
    //     {
    //       name: 'readWebPage',
    //       parameters: [
    //         {
    //           name: 'url',
    //           type: 'string',
    //         }
    //       ],
    //       returns: 'array',
    //     }
    //   ]
    // },
    // {
    //   slug: 'chance',
    //   description: 'This capability gives you ability to harness the power of chance and randomness through chance.js - given an array of strings that represent choices, randomly choose one and return it.',
    //   enabled: false,
    //   methods: [
    //     {
    //       name: 'choose',
    //       parameters: [
    //         {
    //           name: 'Choice array',
    //           type: 'array',
    //         }
    //       ],
    //       returns: 'string',
    //     }
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
    // {
    //   slug: 'wolfram-alpha',
    //   description: 'This capability gives you the ability to ask Wolfram Alpha questions and get answers.',
    //   enabled: false,
    //   methods: [
    //     {
    //       name: 'askWolframAlpha',
    //       parameters: [
    //         {
    //           name: 'question',
    //           type: 'string',
    //         }
    //       ],
    //       returns: 'string',
    //     }
    //   ]
    // },
    // {
    //   slug: 'wikipedia',
    //   description: 'This capability gives you the ability to search a term on wikipedia and read the article and turn it into a list of facts.',
    //   enabled: false,
    //   methods: [
    //     {
    //       name: 'askWikipedia',
    //       parameters: [
    //         {
    //           name: 'query',
    //           type: 'string',
    //         }
    //       ],
    //       returns: 'array',
    //     }
    //   ]
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
    //   slug: 'github',
    //   description: 'This capability gives you the ability to access the studio GitHub repos and read their files.',
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