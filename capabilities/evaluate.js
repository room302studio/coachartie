const vm = require("vm");
const sandbox = {
  // give it axios, lodash, etc
  axios: require("axios"),
  lodash: require("lodash"),
  cheerio: require("cheerio"),
  openai: require("openai"),
  chance: require("chance"),
};

function handleCapabilityMethod(_, args) {
  const [code] = args;

  // Create a new VM context for running the code

  vm.createContext(sandbox);

  // Run the code in the sandbox with a timeout
  let result;
  try {
    result = runCodeInSandbox(code, sandbox);
  } catch (err) {
    throw err;
  }

  return result;
}

/**
 * Runs the provided code in a sandboxed environment.
 * @param {string} code - The code to be executed.
 * @param {Object} sandbox - The sandbox object to provide the execution context.
 * @returns {*} - The result of the code execution.
 */
function runCodeInSandbox(code, sandbox) {
  return vm.runInContext(code, sandbox, { timeout: 20000 }); // timeout is in milliseconds
}

module.exports = {
  handleCapabilityMethod,
};
