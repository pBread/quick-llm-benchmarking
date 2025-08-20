import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createLogger, format, transports } from "winston";
import kebabCase from "lodash/kebabCase.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const logsDir = path.resolve(__dirname, "..", "logs");

fs.mkdirSync(logsDir, { recursive: true });

export class BenchmarkLogger {
  constructor() {}

  start = new Date();
  get id() {
    return kebabCase(this.start.toISOString());
  }
}

const makeFileTransport = (sid) =>
  new transports.File({
    filename: path.join(logsDir, `${sid ?? "server"}.log`),
    level: "info",
    maxsize: 10 * 1024 * 1024, // 10MB
  });
