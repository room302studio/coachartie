const winston = require("winston");
require('winston-syslog');
const os = require('os');
require("dotenv").config();

module.exports = function (serviceName) {
  let loggers = [];

  // Define a maximum message size
  const MAX_MESSAGE_SIZE = 1024 * 5; // 5KB, adjust as needed

  // Function to truncate message if it exceeds the maximum size
  const truncateMessage = (message) => {
    if (Buffer.byteLength(message, 'utf8') > MAX_MESSAGE_SIZE) {
      return message.substring(0, MAX_MESSAGE_SIZE) + '... [Message truncated]';
    }
    return message;
  };

  loggers.push(new winston.transports.Console({
    format: winston.format.combine(
      winston.format.timestamp(),
      winston.format.printf((info) => {
        const lineNumber = info.stack ? info.stack.split("\n")[2].trim() : "";
        const { level, message, timestamp } = info;
        // Truncate message if necessary
        const truncatedMessage = truncateMessage(message);
        return `${timestamp} ${serviceName} ${lineNumber} : ${truncatedMessage}`;
      }),
    ),
  }));

  // Only add console and file transports if local logs are not disabled
  if (!process.env.DISABLE_LOCAL_LOGS) {

    loggers.push(new winston.transports.File({
      filename: "coachartie.log",
      format: winston.format.combine(
        winston.format.timestamp(),
        winston.format.printf((info) => {
          const { level, message, timestamp } = info;
          // Truncate message if necessary
          const truncatedMessage = truncateMessage(message);
          return `${timestamp} ${level}: ${truncatedMessage}`;
        }),
      ),
    }));

    loggers.push(new winston.transports.File({
      filename: `coachartie-${serviceName}.log`,
      format: winston.format.combine(
        winston.format.timestamp(),
        winston.format.printf((info) => {
          const { level, message, timestamp } = info;
          // Truncate message if necessary
          const truncatedMessage = truncateMessage(message);
          return `${timestamp} ${level}: ${truncatedMessage}`;
        }),
      ),
    }));
  }

  // Add papertrail logger if environment variables are set
  if (process.env.PAPERTRAIL_HOST && process.env.PAPERTRAIL_PORT) {
    const papertrail = new winston.transports.Syslog({
      host: process.env.PAPERTRAIL_HOST,
      port: process.env.PAPERTRAIL_PORT,
      protocol: 'tls4',
      localhost: os.hostname(),
      eol: '\n',
    });

    papertrail.on('error', (err) => {
      console.error('Error in Papertrail logging:', err);
    });
    
    loggers.push(papertrail);
  }

  const winstonLogger = winston.createLogger({
    level: "info",
    defaultMeta: { service: serviceName || "default" },
    transports: loggers,
  });

  // set all loggers to silent if the environment variable is set
  if (process.env.DISABLE_LOCAL_LOGS) {
    winstonLogger.transports.forEach((transport) => {
      // make sure we leave papertrail alone
      if (transport.name !== 'Syslog') {
        transport.silent = true;
      }
    });
  }

  return {
    log: (message) => winstonLogger.log('info', truncateMessage(message)),
    info: (message) => winstonLogger.info(truncateMessage(message)),
    warn: (message) => winstonLogger.warn(truncateMessage(message)),
    error: (message) => winstonLogger.error("🚨 " + truncateMessage(message)),
  };
};