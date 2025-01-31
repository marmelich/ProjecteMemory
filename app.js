const express = require('express') //servidor http
const shadowsObj = require('./utilsShadows.js') //maneja html css js del shadowdom
const webSockets = require('./utilsWebSockets.js') //gestiona conexiones websocket

/*
    WebSockets server, example of messages:

    From client to server:
        - Mouse over cell       { "type": "cellOver", "value", 0 }
        - Choosen cell          { "type": "cellChoice", "value", 0 }

    From server to client:
        - socketId              { "type": "socketId", "value": "001" }
        - initMatch             { "type": "initMatch", "value": match }
        - gameRound             { "type": "gameRound", "value": match }
        - opponentOver          { "type": "opponentOver", value: 0 }
        - gameOver              { "type": "gameOver", "winner": "X", "value": match }

    match objects are like: 
        { 
            playerX: "001", 
            playerO: "002", 
            board: ["X", "", "", "", "", "", "", "", ""],
            nextTurn: "O"
        }
    cell values are like:
        0 1 2
        3 4 5
        6 7 8
    winner values are like:
        "X" or "O" or "" (in case of tie)
 */

var ws = new webSockets() //instancia servidor websocket
let shadows = new shadowsObj() //instancia gestion de archivos de recursos

// Jugadors i partides
let matches = [] //lista global partidas



// CONFIGURAR HTTP SERVER
const app = express() //instancia de Express que maneja HTTP
const port = process.env.PORT || 8888 //adjudicamos puerto

// Publish static files from 'public' folder
app.use(express.static('public')) //pone disponible la carpeta public



// INICIALIZAR SERVIDOR HTTP
const httpServer = app.listen(port, appListen)
async function appListen() {
  await shadows.init('./public/index.html', './public/shadows') //procesa los archivos que formaran las paginas
  console.log(`Listening for HTTP queries on: http://localhost:${port}`)
  console.log(`Development queries on: http://localhost:${port}/index-dev.html`)
}

// CIERRE DEL SERVIDOR cuando el proceso termina
process.on('SIGTERM', shutDown);
process.on('SIGINT', shutDown);
function shutDown() {
  console.log('Received kill signal, shutting down gracefully');
  httpServer.close()
  ws.end()
  process.exit(0);
}

// INICIALIZACION SERVIDOR WEBSOCKET
ws.init(httpServer, port) //vincula servidor websocket con servidor HTTP


//MANEJO DE NUEVAS CONEXIONES
ws.onConnection = (socket, id) => {

  console.log("WebSocket client connected: " + id)
  idMatch = -1
  playersReady = false

  //BUSCA PARTIDA

  // Si no hi ha partides, en creem una de nova
  if (matches.length == 0) {
    idMatch = 0
    matches.push({
      playerX: id,
      playerO: "",
      board: createboard(),
      selected_card: -1,
      selected_card2: -1,
      nextTurn: "X",
      playerXPoints: 0,
      playerOPoints: 0,
      playerXName: "",
      playerOName: ""
    })
  }

  // Si hi ha partides, mirem si n'hi ha alguna en espera de jugador
  else {
    for (let i = 0; i < matches.length; i++) {

      //Si no hay jugador X, se mete al player en X
      if (matches[i].playerX == "") {
        idMatch = i
        matches[i].playerX = id
        playersReady = true //pone PLAYERSREADY
        break
      }

      //Si no hay jugador O, se mete al player en O
      else if (matches[i].playerO == "") {
        idMatch = i
        matches[i].playerO = id
        playersReady = true //pone PLAYERSREADY
        break
      }
    }

    // Si hi ha partides, però totes ocupades creem una de nova
    if (idMatch == -1) {
      idMatch = matches.length
      matches.push({
        playerX: id,
        playerO: "",
        board: createboard(),
        selected_card: -1,
        selected_card2: -1,
        nextTurn: "X",
        playerXPoints: 0,
        playerOPoints: 0,
        playerXName: "",
        playerOName: ""
      })
    }
  }


  // Enviem l'identificador de client socket
  socket.send(JSON.stringify({
    type: "socketId",
    value: id //le manda el id de jugador
  }))

  // Enviem l'estat inicial de la partida
  socket.send(JSON.stringify({
    type: "initMatch",
    value: matches[idMatch] //le manda el id de la partida del jugador y su estado inicial
  }))

  // ------------- COMIENZA LA PARTIDA ----------------------------------------------------------
  // Si ja hi ha dos jugadors
  if (playersReady) {
    let idOpponent = ""
    matches[idMatch].playerXPoints= 0;
    matches[idMatch].playerOPoints= 0;
    if (matches[idMatch].playerX == id) {
      idOpponent = matches[idMatch].playerO
    } else {
      idOpponent = matches[idMatch].playerX
    }

    //Se manda notificación de empezar a jugar
    let wsOpponent = ws.getClientById(idOpponent)
    if (wsOpponent != null) {
      // Informem al oponent que ja té rival
      wsOpponent.send(JSON.stringify({
        type: "initMatch",
        value: matches[idMatch]
      }))

      // Informem al oponent que toca jugar
      wsOpponent.send(JSON.stringify({
        type: "gameRound",
        value: matches[idMatch]
      }))

      // Informem al player que toca jugar
      socket.send(JSON.stringify({
        type: "gameRound",
        value: matches[idMatch]
      }))
    }
  }
}

//MANEJO DE MENSAJES
ws.onMessage = (socket, id, msg) => {
  let obj = JSON.parse(msg)
  let idMatch = -1
  let playerTurn = ""
  let idSend = ""
  let wsSend = null

  console.log(obj)

  // Busquem la partida a la que pertany el client
  for (let i = 0; i < matches.length; i++) {
    if (matches[i].playerX == id || matches[i].playerO == id) {
      idMatch = i
      console.log(idMatch)
      break
    }
  }

  // Processar el missatge rebut
  if (idMatch != -1) {
    switch (obj.type) {
      case "setName":
        if (matches[idMatch].playerX == id) {
          matches[idMatch].playerXName = obj.value
          if (matches[idMatch].playerX != "" && matches[idMatch].playerO != "") {
            socket.send(JSON.stringify({
              type: "gameRound",
              value: matches[idMatch]
            }))
            let idOpponent = matches[idMatch].playerO
            let wsOpponent = ws.getClientById(idOpponent)
            wsOpponent.send(JSON.stringify({
              type: "gameRound",
              value: matches[idMatch]
            }))
          }
        } else {
          matches[idMatch].playerOName = obj.value
          if (matches[idMatch].playerX != "" && matches[idMatch].playerO != "") {
            socket.send(JSON.stringify({
              type: "gameRound",
              value: matches[idMatch]
            }))
            let idOpponent = matches[idMatch].playerX
            let wsOpponent = ws.getClientById(idOpponent)
            wsOpponent.send(JSON.stringify({
              type: "gameRound",
              value: matches[idMatch]
            }))
          }
        }
        break

      case "cellOver":
        // Si revem la posició del mouse de qui està jugant, l'enviem al rival
        playerTurn = matches[idMatch].nextTurn
        idSend = matches[idMatch].playerX
        if (playerTurn == "X") idSend = matches[idMatch].playerO

        wsSend = ws.getClientById(idSend)
        if (wsSend != null) {
          wsSend.send(JSON.stringify({
            type: "opponentOver",
            value: obj.value
          }))
        }
        break
      case "cellChoice":
        console.log("EL CASO DEL CELLCHOICE")
        // Si rebem la posició de la cel·la triada, actualitzem la partida
        playerTurn = matches[idMatch].nextTurn
        //matches[idMatch].board[obj.value] = playerTurn
        if (matches[idMatch].selected_card == -1) {
          matches[idMatch].selected_card = obj.value
        } else {
          matches[idMatch].selected_card2 = obj.value
        }
        // Comprovem si hi ha guanyador
        let winner = ""

        let board = matches[idMatch].board
        /*
  
        // Verificar files
        if (board[0] == board[1] && board[0] == board[2]) winner = board[0]
        else if (board[3] == board[4] && board[3] == board[5]) winner = board[3]
        else if (board[6] == board[7] && board[6] == board[8]) winner = board[6]
  
        // Verificar columnes
        else if (board[0] == board[3] && board[0] == board[6]) winner = board[0]
        else if (board[1] == board[4] && board[1] == board[7]) winner = board[1]
        else if (board[2] == board[5] && board[2] == board[8]) winner = board[2]
  
        // Verificar diagonals
        else if (board[0] == board[4] && board[0] == board[8]) winner = board[0]
        else if (board[2] == board[4] && board[2] == board[6]) winner = board[2]
        */

        // Comprovem si hi ha empat (ja no hi ha cap espai buit)
        let tie = false
        let gameFinished = true
        for (let i = 0; i < board.length; i++) {
          if (board[i] != "") {
            gameFinished = false;
            console.log("gameFinished:", gameFinished)
            break
          }
        }


        if (gameFinished) {
          if (matches[idMatch].playerOPoints == matches[idMatch].playerXPoints) {
            tie = true;
            console.log("empateeeeeeeeeeeeeeeeeeeee")
          } else if (matches[idMatch].playerOPoints > matches[idMatch].playerXPoints) {
            winner = playerOName;
            console.log("ha ganado O aaaaaaaaaaaaaaaaaaaa")
            console.log("el winner es: ", winner);
            break;
          } else {
            winner = playerXName;
            console.log("ha ganado X aaaaaaaaaaaaaaaaaaaa")
            console.log("el winner es: ", winner);
            break;
          }


          console.log('XXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX')
        }
        else {
          console.log("El juego no ha terminado aún.");
        }

        if (winner == "" && !tie) {
          // Si no hi ha guanyador ni empat, canviem el torn
          if (matches[idMatch].selected_card != -1 && matches[idMatch].selected_card2 != -1) {
            setTimeout(() => {
              if (matches[idMatch].board[matches[idMatch].selected_card] == matches[idMatch].board[matches[idMatch].selected_card2] && matches[idMatch].selected_card != "" && matches[idMatch].selected_card != "") {
                if (matches[idMatch].nextTurn == "X") {
                  matches[idMatch].playerXPoints++
                  matches[idMatch].board[matches[idMatch].selected_card] = ""
                  matches[idMatch].board[matches[idMatch].selected_card2] = ""
                } else {
                  matches[idMatch].playerOPoints++
                  matches[idMatch].board[matches[idMatch].selected_card] = ""
                  matches[idMatch].board[matches[idMatch].selected_card2] = ""
                }
              }
              matches[idMatch].selected_card = -1
              matches[idMatch].selected_card2 = -1
              let gameFinished = true
              for (let i = 0; i < board.length; i++) {
                if (board[i] != "") {
                  gameFinished = false;
                  console.log("gameFinished:", gameFinished)
                  break
                }
              }
              if (gameFinished) {
                if (matches[idMatch].playerOPoints == matches[idMatch].playerXPoints) {
                  tie = true;
                  console.log("empateeeeeeeeeeeeeeeeeeeee")
                  // Informem al jugador de la partida
                  socket.send(JSON.stringify({
                    type: "gameOver",
                    value: matches[idMatch],
                    winner: winner
                  }))
                } else if (matches[idMatch].playerOPoints > matches[idMatch].playerXPoints) {
                  winner = "O"
                  console.log("ha ganado O aaaaaaaaaaaaaaaaaaaa")
                  // Informem al jugador de la partida
                    socket.send(JSON.stringify({
                      type: "gameOver",
                      value: matches[idMatch],
                      winner: winner
                    }))
                  } else {
                  winner = "X"
                  console.log("ha ganado X aaaaaaaaaaaaaaaaaaaa")
                  // Informem al jugador de la partida
                  socket.send(JSON.stringify({
                    type: "gameOver",
                    value: matches[idMatch],
                    winner: winner
                  }))
                }
              }

              if (matches[idMatch].nextTurn == "X") {
                matches[idMatch].nextTurn = "O"
                idOpponent = matches[idMatch].playerO
              } else {
                matches[idMatch].nextTurn = "X"
                idOpponent = matches[idMatch].playerX
              }
              let wsOpponent = ws.getClientById(idOpponent)
              wsOpponent.send(JSON.stringify({
                type: "gameRound",
                value: matches[idMatch]
              }))
              socket.send(JSON.stringify({
                type: "gameRound",
                value: matches[idMatch]
              }))
            }, 1000)
          }
          // Informem al jugador de la partida
          socket.send(JSON.stringify({
            type: "gameRound",
            value: matches[idMatch]
          }))

          // Informem al rival de la partida
          let idOpponent = ""
          if (matches[idMatch].playerX == id) {
            idOpponent = matches[idMatch].playerO
          } else {
            idOpponent = matches[idMatch].playerX
          }
          let wsOpponent = ws.getClientById(idOpponent)
          if (wsOpponent != null) {
            wsOpponent.send(JSON.stringify({
              type: "gameRound",
              value: matches[idMatch]
            }))
          }

        } else {
          console.log("AAAAAAAAAAAAAAAAAAAAAAAAAAAAAA ")
          // Si hi ha guanyador o empat, acabem la partida

          // Informem al jugador de la partida
          socket.send(JSON.stringify({
            type: "gameOver",
            value: matches[idMatch],
            winner: winner
            
          }))

          // Informem al rival de la partida
          let idOpponent = ""
          if (matches[idMatch].playerX == id) {
            idOpponent = matches[idMatch].playerO
          } else {
            idOpponent = matches[idMatch].playerX
          }
          let wsOpponent = ws.getClientById(idOpponent)
          if (wsOpponent != null) {
            wsOpponent.send(JSON.stringify({
              type: "gameOver",
              value: matches[idMatch],
              winner: winner
            }))
          }
        }

        break
    }
  }
}

//MANEJA DESCONEXION DE UN CLIENTE AL WEBSOCKET
ws.onClose = (socket, id) => {
  console.log("WebSocket client disconnected: " + id)

  // Busquem la partida a la que pertany el client
  idMatch = -1
  for (let i = 0; i < matches.length; i++) {
    if (matches[i].playerX == id || matches[i].playerO == id) {
      idMatch = i
      break
    }
  }
  // Informem al rival que s'ha desconnectat
  if (idMatch != -1) {

    if (matches[idMatch].playerX == "" && matches[idMatch].playerO == "") {
      // Esborrar la partida per falta de jugadors
      matches.splice(idMatch, 1)
    }


    //si todavia hay 1 player    
    else {
      // Reiniciem el taulell
      matches[idMatch].board = createboard()

      // Esborrar el jugador de la partida
      let rival = ""
      if (matches[idMatch].playerX == id) {
        matches[idMatch].playerX = ""
        rival = matches[idMatch].playerO
      } else {
        matches[idMatch].playerO = ""
        rival = matches[idMatch].playerX
      }

      // Informar al rival que s'ha desconnectat
      let rivalSocket = ws.getClientById(rival)
      if (rivalSocket != null) {
        rivalSocket.send(JSON.stringify({
          type: "opponentDisconnected"
        }))
      }
    }
  }
}

// Configurar la direcció '/index-dev.html' per retornar
// la pàgina que descarrega tots els shadows (desenvolupament)
app.get('/index-dev.html', getIndexDev) //genera html
async function getIndexDev(req, res) {
  res.setHeader('Content-Type', 'text/html'); //configura el type del encabezado 
  res.send(shadows.getIndexDev()) //coge el contenido html y lo envia como respuesta al cliente
}

// Configurar la direcció '/shadows.js' per retornar
// tot el codi de les shadows en un sol arxiu
app.get('/shadows.js', getShadows) //aplica js
async function getShadows(req, res) {
  res.setHeader('Content-Type', 'application/javascript'); //configura el type del encabezado 
  res.send(shadows.getShadows()) //coge el contenido js y lo envia como respuesta al cliente
}



//FUNCION PARA CREAR EL TABLERO:
function createboard() {
  let board = [
    "", "", "", "",
    "", "", "", "",
    "", "", "", "",
    "", "", "", "",
  ]
  for (let i = 0; i < 9; i++) {
    while (true) {
      let pos = Math.floor(Math.random() * 16)
      if (board[pos] == "") {
        board[pos] = i
        break;
      }
    }
    while (true) {
      let pos = Math.floor(Math.random() * 16)
      if (board[pos] == "") {
        board[pos] = i
        break;
      }
    }
  }

  return board;
}