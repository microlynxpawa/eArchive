const winston = require('winston');
const path = require('path');

const logger = winston.createLogger({
  level: 'error',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.printf(({ timestamp, level, message }) => {
      return `${timestamp} [${level.toUpperCase()}]: ${message}`;
    })
  ),
  transports: [
    new winston.transports.File({
      filename: path.join(__dirname, 'error.log'),
      level: 'error',
      maxsize: 10 * 1024 * 1024, // 10MB
      maxFiles: 5, // keep last 5 log files
    })
  ]
});

// Patch console.error to also log to winston, but keep original behavior
const origError = console.error;
console.error = function (...args) {
  logger.error(args.map(String).join(' '));
  origError.apply(console, args);
};

module.exports = logger;
