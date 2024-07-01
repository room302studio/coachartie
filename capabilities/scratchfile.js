const fs = require("fs");
const path = require("path");
const { countTokens } = require("../helpers");
const logger = require("../src/logger.js")("scratchfile");

const scratchFilePath = path.join(__dirname, "cache", "scratch.txt");

/**
 * Reads the content of the scratch file.
 *
 * @returns {string} - The content of the scratch file.
 * @throws {Error} - If the file read operation fails.
 *
 * @example
 * // To read the content of the scratch file:
 * scratchfile:read()
 */
function read() {
  return fs.readFileSync(scratchFilePath, "utf8");
}

/**
 * Writes content to the scratch file.
 *
 * @param {string} content - The content to write to the scratch file.
 * @returns {string} - A success message.
 * @throws {Error} - If the file write operation fails.
 *
 * @example
 * // To write content to the scratch file:
 * scratchfile:write("Hello, world!")
 */
function write(content) {
  fs.writeFileSync(scratchFilePath, content, { flag: "a" });
  return "Content written to scratch file";
}

/**
 * Clears the content of the scratch file.
 *
 * @returns {string} - A success message.
 * @throws {Error} - If the file write operation fails.
 *
 * @example
 * // To clear the content of the scratch file:
 * scratchfile:clear()
 */
function clear() {
  fs.writeFileSync(scratchFilePath, "");
  return "Scratch file cleared";
}

/**
 * Gets the current size of the scratch file in tokens.
 *
 * @returns {number} - The size of the scratch file in tokens.
 * @throws {Error} - If the file read operation fails.
 *
 * @example
 * // To get the size of the scratch file in tokens:
 * scratchfile:size()
 */
function size() {
  const content = read();
  const tokens = countTokens(content);
  return tokens;
}

/**
 * Handles the capability method.
 *
 * @param {string} methodName - The name of the method to call.
 * @param {string} args - The arguments passed to the method, as a string.
 * @returns {string|number} - The result of the operation.
 * @throws {Error} - If the operation is invalid.
 */
function handleCapabilityMethod(methodName, args) {
  logger.info(
    `Scratchfile handleCapabilityMethod called with method: ${methodName}, args: ${args}`
  );
  const parsedArgs = JSON.parse(args || "[]");
  logger.info(`Parsed args: ${JSON.stringify(parsedArgs)}`);

  switch (methodName) {
    case "read":
      return read();
    case "write":
      return write(parsedArgs[0]);
    case "clear":
      return clear();
    case "size":
      return size();
    default:
      throw new Error("Invalid operation");
  }
}

module.exports = {
  handleCapabilityMethod,
};
