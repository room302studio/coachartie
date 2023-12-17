const fs = require("fs");
const path = require("path");
const { countTokens } = require("../helpers");

const scratchFilePath = path.join(__dirname, "cache", "scratch.txt");

/**
 * Reads the content of the scratch file.
 *
 * @returns {string} - The content of the scratch file.
 * @throws {Error} - If the file read operation fails.
 */
function readScratchFile() {
  return fs.readFileSync(scratchFilePath, "utf8");
}

/**
 * Writes content to the scratch file.
 *
 * @param {string} content - The content to write to the scratch file.
 * @returns {string} - A success message.
 * @throws {Error} - If the file write operation fails.
 */
function writeScratchFile(content) {
  fs.writeFileSync(scratchFilePath, content, { flag: "a" });
  return "Content written to scratch file";
}

/**
 * Clears the content of the scratch file.
 *
 * @returns {string} - A success message.
 * @throws {Error} - If the file write operation fails.
 */
function clearScratchFile() {
  fs.writeFileSync(scratchFilePath, "");
  return "Scratch file cleared";
}

/**
 * Finds the current size of the scratch file in tokens.
 *
 * @returns {number} - The size of the scratch file in tokens.
 * @throws {Error} - If the file read operation fails.
 */
function getScratchFileSize() {
  const content = readScratchFile();
  const tokens = countTokens(content);
  return tokens;
}

/**
 * Handles the capability method.
 *
 * @param {Array} args - The arguments passed to the method.
 * @returns {string} - The result of the operation.
 * @throws {Error} - If the operation is invalid.
 */
function handleCapabilityMethod(methodName, args) {
  const [content] = args;

  switch (methodName) {
    case "read":
      return readScratchFile();
    case "write":
      return writeScratchFile(content);
    case "clear":
      return clearScratchFile();
    case "size":
      return getScratchFileSize();
    default:
      throw new Error("Invalid operation");
  }
}

module.exports = {
  handleCapabilityMethod,
};
