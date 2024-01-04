const winston = require("winston");
const util = require("util");
module.exports = function (serviceName) {
  /**
   * Logger instance for logging messages.
   *
   * @type {winston.Logger}
   */
  const winstonLogger = winston.createLogger({
    level: "info",
    defaultMeta: { service: serviceName || "default" },
    transports: [
      new winston.transports.Console({
        format: winston.format.combine(
          winston.format.printf((info) => {
            const { level, message, ...meta } = info;
            return `${level}: ${message}`;
          }),
        ),
      }),
      new winston.transports.File({ filename: "coachartie.log" }),
      new winston.transports.File({
        filename: `coachartie-${serviceName}.log`,
      }),
    ],
  });

  return {
    log: (message) => winstonLogger.log(message),
    info: (message) => winstonLogger.info(message),
    warn: (message) => winstonLogger.warn(message),
    error: (message) => winstonLogger.error(message),
  };
};
