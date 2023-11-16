import fs from "fs";
import winston, { format, Logger } from "winston";
import fetch from "cross-fetch";
import SlackHook from "winston-slack-webhook-transport";
import { SAVE_TX_ENDPOINT, TRANSACTION_LOGS_DIR } from "../constants";
import WebSocket from "ws";
import { WebSocketTransport } from "./WebSocketTransport";

export const ANSI_REGEX = [
    "[\\u001B\\u009B][[\\]()#;?]*(?:(?:(?:(?:;[-a-zA-Z\\d\\/#&.:=?%@~_]+)*|[a-zA-Z\\d]+(?:;[-a-zA-Z\\d\\/#&.:=?%@~_]*)*)?\\u0007)",
    "(?:(?:\\d{1,4}(?:;\\d{0,4})*)?[\\dA-PR-TZcf-ntqry=><~]))",
].join("|");

export async function saveTxSignature(publicKey: string, txid: string) {
    await fetch(SAVE_TX_ENDPOINT, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
            pubkey: publicKey,
            txid: txid,
        }),
    });
}

if (!fs.existsSync(TRANSACTION_LOGS_DIR)) {
    fs.mkdirSync(TRANSACTION_LOGS_DIR);
}

const wss = new WebSocket.Server({ port: 44000 });
const clients: WebSocket[] = [];

wss.on("connection", (ws) => {
    clients.push(ws);

    ws.on("close", () => {
        clients.splice(clients.indexOf(ws), 1);
    });
});

const customFormat = winston.format.printf(({ level, message, timestamp, ...meta }) => {
    let log = `${timestamp} - ${level}: ${message}`;
    const splat = meta[Symbol.for("splat") as unknown as string];
    try {
        if (splat) {
            splat.forEach((arg: any) => {
                if (typeof arg === "object") log += ` ${JSON.stringify(arg)}`;
                else log += ` ${arg}`;
            });
        }
    } catch (error) {
        logger.error(`[Logger error]`);
    }

    return log;
});

const logger: Logger = winston.createLogger({
    level: "debug",
    format: format.combine(
        format((info) => {
            info.level = info.level.toUpperCase();
            return info;
        })(),
        format.colorize(),
        format.timestamp({ format: "DD-MM-YYYY HH:mm:ss" }),
        customFormat,
    ),
    transports: [
        new winston.transports.File({ filename: "arbx.log", dirname: TRANSACTION_LOGS_DIR, level: "silly" }),
        new WebSocketTransport({ level: "info" }, clients),
    ],
});

export const arbLogger = winston.createLogger({
    level: "debug",
    format: format.combine(
        format((info) => {
            info.level = info.level.toUpperCase();
            return info;
        })(),
        format.colorize(),
        format.timestamp(),
        customFormat,
    ),
    transports: [
        new winston.transports.File({ filename: "arbfeed.log", dirname: TRANSACTION_LOGS_DIR, level: "silly" }),
    ],
});

if (process.env.NODE_ENV !== "production") {
    logger.add(new winston.transports.Console({ level: "silly" }));
}

if (process.env.NODE_ENV === "production") {
    logger.add(
        new SlackHook({
            webhookUrl: "https://hooks.slack.com/services/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",
            level: "error",
            formatter: (info) => {
                return { text: `${info.level.replace(new RegExp(ANSI_REGEX, "gi"), "")} - ${info.message}` };
            },
        }),
    );
    arbLogger.transports.forEach((t) => (t.silent = true));
}

export default logger;
