/*

We want to create a global Winston logger that we can use throughout our application.

In addition, error-level logs will be sent to a supabase logging table.

We will also enhance the presentation of logs when they are printed to the console when bot.js is being run in the development environment.

We will export the logger with .info, .warn, and .error methods.

*/
const winston = require("winston");
// Create a new logger instance
const winstonLogger = winston.createLogger({
  level: "info",
  format: winston.format.json(),
  defaultMeta: { service: "user-service" },
  transports: [
    new winston.transports.File({ filename: "capability-chain.log" }),
  ],
});

const logger = {
  log: (message) => {
    winstonLogger.log(message);
    console.log(message);
  },
  info: (message) => {
    winstonLogger.info(message);
    console.log(`ℹ️ ${message}`);
  },
  warn: (message) => {
    winstonLogger.warn(message);
    console.log(`⚠️ ${message}`);
  },
  error: (message) => {
    winstonLogger.error(message);
    console.error(`🚨 ${message}`);
  },
};

module.exports = logger;