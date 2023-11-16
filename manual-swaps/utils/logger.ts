import { format, createLogger, transports } from "winston";
const { combine, timestamp, printf } = format;

const logFormat = printf(({ level, message, timestamp }) => {
  return `[${timestamp}]: ${message}`;
});

export const logger = createLogger({
  level: "info",
  format: combine(
    timestamp({
      format: "DD-MM-YYYY HH:mm:ss",
    }),
    logFormat
  ),
  transports: [
    new transports.Console(),
    new transports.File({ filename: "arbs.log", dirname: "." }),
  ],
});
