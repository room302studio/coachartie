const winston = require('winston');

const logger = winston.createLogger({
  level: 'info',
  format: winston.format.json(),
  transports: [
    new winston.transports.File({ filename: 'capability-chain.log' }),
    // Additional transports for verbose logging
  ],
});

module.exports = logger;