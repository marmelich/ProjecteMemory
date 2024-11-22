// Description: WebSocket server for the app

const WebSocket = require('ws')
const { v4: uuidv4 } = require('uuid')

class Obj {

    init (httpServer, port) {      

        // Define empty callbacks
        this.onConnection = (socket, id) => {}
        this.onMessage = (socket, id, obj) => { }
        this.onClose = (socket, id) => { }

        // Run WebSocket server
        this.ws = new WebSocket.Server({ server: httpServer })
        this.socketsClients = new Map()
        console.log(`Listening for WebSocket queries on ${port}`)

        // What to do when a websocket client connects
        this.ws.on('connection', (ws) => { this.newConnection(ws) })
    }

    end () {
        this.ws.close()
    }

    // A websocket client connects
    newConnection (con) {

        console.log("Client connected")

        // Add client to the clients list
        const id = uuidv4().substring(0, 5)
        const color = Math.floor(Math.random() * 360)
        const metadata = { id, color }
        this.socketsClients.set(con, metadata)

        // Send clients list to everyone
        if (this.onConnection && typeof this.onConnection === "function") {
            this.onConnection(con, id)
        }

        // What to do when a client is disconnected
        con.on("close", () => {
            this.closeConnection(con)
            this.socketsClients.delete(con)  
        })

        // What to do when a client message is received
        con.on('message', (bufferedMessage) => { this.newMessage(con, id, bufferedMessage)})
    }

    closeConnection (con) {
        if (this.onClose && typeof this.onClose === "function") {
            var id = this.socketsClients.get(con).id
            this.onClose(con, id)
        }
    }

 
    // Send a message to all websocket clients
    broadcast (msg) {
        this.ws.clients.forEach((client) => {
            if (client.readyState === WebSocket.OPEN) {
                client.send(msg)
            }
        })
    }

    // A message is received from a websocket client
    newMessage (ws, id, bufferedMessage) {
        var messageAsString = bufferedMessage.toString()
        if (this.onMessage && typeof this.onMessage === "function") {
            this.onMessage(ws, id, messageAsString)
        }
    }

    getClients() {
        let clients = [];
        this.socketsClients.forEach((value, key) => {
            clients.push(value.id);
        });
        return clients;
    }

    getClientById(id) {
        for (let [client, metadata] of this.socketsClients.entries()) {
            if (metadata.id === id) {
                return client;
            }
        }
        return null;
    }
    
}

module.exports = Obj