module.exports = {
  "capabilities": [
    {
      "slug": "calculator",
      "description": "This capability gives you the ability to do math.",
      "methods": [
        {
          "name": "calculator",
          "description": "This method gives you the ability to add, subtract, multiply, and divide numbers.",
          "parameters": []
        },
        {
          "name": "calculate",
          "description": "",
          "parameters": []
        },
        {
          "name": "operation",
          "description": "- The operation to perform. Can be \"add\", \"subtract\", \"multiply\", or \"divide\".",
          "parameters": [
            {}
          ]
        },
        {
          "name": "numbers",
          "description": "- An array of numbers to perform the operation on.",
          "parameters": [
            {}
          ]
        },
        {
          "name": "The",
          "description": "result of the operation.",
          "parameters": [
            {}
          ]
        }
      ]
    },
    {
      "slug": "github",
      "description": "This class provides methods to interact with Github.",
      "methods": [
        {
          "name": "GithubCoach",
          "description": "",
          "parameters": []
        }
      ]
    },
    {
      "slug": "github",
      "description": "Constructor for GithubCoach class. Initializes the GithubCoach.",
      "methods": []
    },
    {
      "slug": "github",
      "description": "Initializes the GithubCoach.",
      "methods": [
        {
          "name": "",
          "description": "",
          "parameters": []
        }
      ]
    },
    {
      "slug": "github",
      "description": "Creates a new repository.",
      "methods": [
        {
          "name": "repositoryName",
          "description": "- The name of the repository.",
          "parameters": [
            {}
          ]
        },
        {
          "name": "The",
          "description": "response from the Github API.",
          "parameters": [
            {}
          ]
        }
      ]
    },
    {
      "slug": "github",
      "description": "Clones a repository.",
      "methods": [
        {
          "name": "repositoryUrl",
          "description": "- The URL of the repository.",
          "parameters": [
            {}
          ]
        }
      ]
    },
    {
      "slug": "github",
      "description": "Lists the repositories of the authenticated user.",
      "methods": [
        {
          "name": "An",
          "description": "array of repository names and descriptions.",
          "parameters": [
            {}
          ]
        }
      ]
    },
    {
      "slug": "github",
      "description": "Lists the repositories of a user.",
      "methods": [
        {
          "name": "username",
          "description": "- The username of the user.",
          "parameters": [
            {}
          ]
        },
        {
          "name": "An",
          "description": "array of repository names and descriptions.",
          "parameters": [
            {}
          ]
        }
      ]
    },
    {
      "slug": "github",
      "description": "Gets the project ID from a URL.",
      "methods": [
        {
          "name": "url",
          "description": "- The URL of the project.",
          "parameters": [
            {}
          ]
        },
        {
          "name": "The",
          "description": "project ID, or null if the project was not found.",
          "parameters": [
            {}
          ]
        }
      ]
    },
    {
      "slug": "github",
      "description": "Lists the projects of a user.",
      "methods": [
        {
          "name": "username",
          "description": "- The username of the user.",
          "parameters": [
            {}
          ]
        },
        {
          "name": "A",
          "description": "stringified array of project nodes.",
          "parameters": [
            {}
          ]
        }
      ]
    },
    {
      "slug": "github",
      "description": "Lists the project columns and cards of a project.",
      "methods": [
        {
          "name": "projectId",
          "description": "- The ID of the project.",
          "parameters": [
            {}
          ]
        },
        {
          "name": "A",
          "description": "stringified array of project nodes.",
          "parameters": [
            {}
          ]
        }
      ]
    },
    {
      "slug": "github",
      "description": "Adds a draft issue to a project.",
      "methods": [
        {
          "name": "projectId",
          "description": "- The ID of the project.",
          "parameters": [
            {}
          ]
        },
        {
          "name": "issueTitle",
          "description": "- The title of the issue.",
          "parameters": [
            {}
          ]
        },
        {
          "name": "issueBody",
          "description": "- The body of the issue.",
          "parameters": [
            {}
          ]
        },
        {
          "name": "A",
          "description": "stringified response from the Github API.",
          "parameters": [
            {}
          ]
        }
      ]
    },
    {
      "slug": "github",
      "description": "Creates a branch in a repository.",
      "methods": [
        {
          "name": "repositoryFullName",
          "description": "- The full name of the repository, in the format of owner/repo.",
          "parameters": [
            {}
          ]
        },
        {
          "name": "branchName",
          "description": "- The name of the branch.",
          "parameters": [
            {}
          ]
        },
        {
          "name": "The",
          "description": "response from the Github API.",
          "parameters": [
            {}
          ]
        }
      ]
    },
    {
      "slug": "github",
      "description": "Lists the branches of a repository.",
      "methods": [
        {
          "name": "repositoryName",
          "description": "- The name of the repository.",
          "parameters": [
            {}
          ]
        },
        {
          "name": "An",
          "description": "array of branch objects.",
          "parameters": [
            {}
          ]
        }
      ]
    },
    {
      "slug": "github",
      "description": "Creates a file in a repository.",
      "methods": [
        {
          "name": "repositoryName",
          "description": "- The name of the repository.",
          "parameters": [
            {}
          ]
        },
        {
          "name": "filePath",
          "description": "- The path of the file.",
          "parameters": [
            {}
          ]
        },
        {
          "name": "content",
          "description": "- The content of the file.",
          "parameters": [
            {}
          ]
        },
        {
          "name": "commitMessage",
          "description": "- The commit message.",
          "parameters": [
            {}
          ]
        },
        {
          "name": "The",
          "description": "response from the Github API.",
          "parameters": [
            {}
          ]
        }
      ]
    },
    {
      "slug": "github",
      "description": "Creates a gist.",
      "methods": [
        {
          "name": "fileName",
          "description": "- The name of the file.",
          "parameters": [
            {}
          ]
        },
        {
          "name": "description",
          "description": "- The description of the gist.",
          "parameters": [
            {}
          ]
        },
        {
          "name": "contentString",
          "description": "- The content of the gist.",
          "parameters": [
            {}
          ]
        },
        {
          "name": "A",
          "description": "message containing the URL of the created gist.",
          "parameters": [
            {}
          ]
        }
      ]
    },
    {
      "slug": "github",
      "description": "Edits a file in a repository.",
      "methods": [
        {
          "name": "repositoryName",
          "description": "- The name of the repository.",
          "parameters": [
            {}
          ]
        },
        {
          "name": "filePath",
          "description": "- The path of the file.",
          "parameters": [
            {}
          ]
        },
        {
          "name": "newContent",
          "description": "- The new content of the file.",
          "parameters": [
            {}
          ]
        },
        {
          "name": "commitMessage",
          "description": "- The commit message.",
          "parameters": [
            {}
          ]
        },
        {
          "name": "The",
          "description": "response from the Github API.",
          "parameters": [
            {}
          ]
        }
      ]
    },
    {
      "slug": "github",
      "description": "Deletes a file in a repository.",
      "methods": [
        {
          "name": "repositoryName",
          "description": "- The name of the repository.",
          "parameters": [
            {}
          ]
        },
        {
          "name": "filePath",
          "description": "- The path of the file.",
          "parameters": [
            {}
          ]
        },
        {
          "name": "commitMessage",
          "description": "- The commit message.",
          "parameters": [
            {}
          ]
        },
        {
          "name": "The",
          "description": "response from the Github API.",
          "parameters": [
            {}
          ]
        }
      ]
    },
    {
      "slug": "github",
      "description": "Creates a pull request in a repository.",
      "methods": [
        {
          "name": "repositoryName",
          "description": "- The name of the repository.",
          "parameters": [
            {}
          ]
        },
        {
          "name": "title",
          "description": "- The title of the pull request.",
          "parameters": [
            {}
          ]
        },
        {
          "name": "headBranch",
          "description": "- The name of the head branch.",
          "parameters": [
            {}
          ]
        },
        {
          "name": "baseBranch",
          "description": "- The name of the base branch.",
          "parameters": [
            {}
          ]
        },
        {
          "name": "description",
          "description": "- The description of the pull request.",
          "parameters": [
            {}
          ]
        },
        {
          "name": "The",
          "description": "response from the Github API.",
          "parameters": [
            {}
          ]
        }
      ]
    },
    {
      "slug": "github",
      "description": "Reads the contents of a file in a repository.",
      "methods": [
        {
          "name": "repositoryName",
          "description": "- The name of the repository.",
          "parameters": [
            {}
          ]
        },
        {
          "name": "filePath",
          "description": "- The path of the file.",
          "parameters": [
            {}
          ]
        },
        {
          "name": "The",
          "description": "response from the Github API.",
          "parameters": [
            {}
          ]
        }
      ]
    },
    {
      "slug": "wolframalpha",
      "description": "This function gives you the ability to ask Wolfram Alpha questions and get answers.",
      "methods": [
        {
          "name": "",
          "description": "",
          "parameters": []
        },
        {
          "name": "askWolframAlpha",
          "description": "",
          "parameters": []
        },
        {
          "name": "question",
          "description": "- The question to ask Wolfram Alpha.",
          "parameters": [
            {}
          ]
        },
        {
          "name": "The",
          "description": "answer from Wolfram Alpha, or an error message if an error occurred.",
          "parameters": [
            {}
          ]
        }
      ]
    }
  ]
}