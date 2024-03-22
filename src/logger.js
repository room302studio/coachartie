const winston = require("winston");
require('winston-syslog');
const os = require('os');
require("dotenv").config();

module.exports = function (serviceName) {
  let loggers = [];

  loggers.push(new winston.transports.Console({
    format: winston.format.combine(
      winston.format.timestamp(),
      winston.format.printf((info) => {
        const lineNumber = info.stack ? info.stack.split("\n")[2].trim() : "";
        const { level, message, timestamp } = info;
        return `${timestamp} ${serviceName} ${lineNumber} : ${message}`;
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
          return `${timestamp} ${level}: ${message}`;
        }),
      ),
    }));

    loggers.push(new winston.transports.File({
      filename: `coachartie-${serviceName}.log`,
      format: winston.format.combine(
        winston.format.timestamp(),
        winston.format.printf((info) => {
          const { level, message, timestamp } = info;
          return `${timestamp} ${level}: ${message}`;
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
    log: (message) => winstonLogger.log('info', message),
    info: (message) => winstonLogger.info(message),
    warn: (message) => winstonLogger.warn(message),
    error: (message) => winstonLogger.error("🚨 " + message),
  };
};