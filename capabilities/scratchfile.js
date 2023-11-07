const fs = require('fs');
const path = require('path');

const scratchFilePath = path.join(__dirname, 'scratch.txt');

function handleCapabilityMethod(args) {
  const [operation, ...content] = args;

  switch (operation) {
    case "read":
      return fs.readFileSync(scratchFilePath, 'utf8');
    case "write":
      fs.writeFileSync(scratchFilePath, content.join(' '), { flag: 'a' });
      return "Content written to scratch file";
    case "clear":
      fs.writeFileSync(scratchFilePath, '');
      return "Scratch file cleared";
    default:
      throw new Error("Invalid operation");
  }
}

module.exports = {
  handleCapabilityMethod,
};