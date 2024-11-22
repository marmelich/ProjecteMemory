let socket;
let socketConnected = false;

function connect(protocol, ip, port) {

    socket = new WebSocket(`${protocol}://${ip}:${port}`)

    socket.onopen = function(e) {
        console.log("Socket connected")
        socketConnected = true
    }
    
    socket.onmessage = function(event) {
        let obj = JSON.parse(event.data)
        document.querySelector('game-ws').getViewShadow('game-view-playing').onServerMessage(obj)
    }

    socket.onerror = function(error) {
        console.log(`WebSocket error: ${error}`)
    }

    socket.onclose = async function(event) {

        if (event.wasClean) {
            console.log(`[close] Connection closed cleanly`)
        } else {
            console.log('[close] Connection died')
        }

        socketConnected = false 
        await document.querySelector('game-ws').getViewShadow('game-view-playing').showDisconnecting()
    }
}

function disconnect() {
    console.log("Socket disconnected")
    socket.close()
}

function sendServer(obj) {
    let msg = JSON.stringify(obj)
    if (msg == null || msg === "{}") return
    socket.send(msg) 
}