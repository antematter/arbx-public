const WebSocketClient = require('websocket').client;

const client = new WebSocketClient();

client.on('connect', (connection) => {
  connection.on('message', (message) => {
    //@ts-ignore
    console.log(`Arbitrage received: ${message.utf8Data}`);
  });
});

client.on('connectFailed', (error) => {
  console.log(`Connect Error: ${error.toString()}`);
});

client.connect('ws://3.88.158.93:8084');
