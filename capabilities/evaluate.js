const vm = require('vm');

function handleCapabilityMethod(args) {
  const [code] = args;

  // Create a new VM context for running the code
  const sandbox = {
    console: console, // Provide console.log, etc if needed
    // give it axios, lodash, etc
    axios: require('axios'),
    lodash: require('lodash'),
    cheerio: require('cheerio'),
    openai: require('openai'),
    chance: require('chance'),
  };
  vm.createContext(sandbox);

  // Run the code in the sandbox with a timeout
  let result;
  try {
    result = vm.runInContext(code, sandbox, { timeout: 60000 }); // timeout is in milliseconds
  } catch (err) {
    if (err instanceof vm.Timeout) {
      throw new Error('The script execution timed out.');
    }
    throw err;
  }

  return result;
}

module.exports = {
  handleCapabilityMethod,
};