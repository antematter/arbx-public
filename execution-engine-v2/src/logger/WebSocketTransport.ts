import WebSocket from "ws";
import Transport from "winston-transport";
import { TransformableInfo } from "winston-slack-webhook-transport";
import { ANSI_REGEX } from "./index";

export class WebSocketTransport extends Transport {
    private clients: WebSocket[];

    constructor(opts: Transport.TransportStreamOptions, clients: WebSocket[]) {
        super(opts);
        this.clients = clients;
    }

    log(info: TransformableInfo, callback: () => void) {
        setImmediate(() => {
            this.emit("logged", info);
        });

        this.clients.forEach((client) => {
            if (client.readyState === WebSocket.OPEN) {
                client.send(`${info.level.replace(new RegExp(ANSI_REGEX, "gi"), "")} - ${info.message}`);
            }
        });

        callback();
    }
}
