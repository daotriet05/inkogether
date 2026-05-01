import express from "express";
import cors from "cors";
import { createServer } from "node:http";
import { Server } from "socket.io";
import { 
  getRoomData, 
  handleCreateRoom, 
  handleJoinRoom, 
  handleTeamToggle, 
  handleReadyToggle, 
  handleDisconnect, 
  handleEndRoom, 
  handleRoomReplay 
} from "./controllers/room.controller.js";
import { 
  handleGameStart, 
  handleDraw, 
  handleGameEnd, 
  handleGuess 
} from "./controllers/game.controller.js";
import { 
  handleMessageLobby, 
  handleMessageTeam 
} from "./controllers/message.controller.js";
import { roomData } from "./data/store.js";

const app = express();
app.use(cors());
const httpServer = createServer(app);

export const io = new Server(httpServer, {
  cors: {
    origin: "*",
  },
}); 


app.get("/api/room/:roomId", getRoomData);



io.on("connection", (socket) => {
  console.log("connected: "+socket.id);
  let socketRoomId = null;

  socket.on("room:create", async (userObject) =>{
    socketRoomId = handleCreateRoom(io, socket, userObject);
  });

  socket.on("room:join", (userObject, roomId) => {
    socketRoomId = handleJoinRoom(io, socket, userObject, roomId);
  });

  socket.on("room:team_toggle", () => {
    handleTeamToggle(io, socket, socketRoomId);
  });

  socket.on("room:ready_toggle", () => {
    handleReadyToggle(io, socket.id, socketRoomId);
  });

  socket.on("message-lobby:send", (messageObject) => {
    handleMessageLobby(io, socket.id, socketRoomId, messageObject);
  });

  socket.on("message-team:send", (messageObject) => {
    handleMessageTeam(io, socket.id, socketRoomId, messageObject);
  });

  socket.on("game:start", async () => {
    await handleGameStart(io, socket.id, socketRoomId);
  });

  socket.on("game:draw:send", (drawObject) => {
    handleDraw(io, socket.id, socketRoomId, drawObject);
  })

  socket.on("game:guess:send", async (guess) => {
    handleGuess(io, socket.id, socketRoomId, guess)
  })

  socket.on("game:end", () => {
    handleGameEnd(io, socket.id, socketRoomId);
  })

  socket.on("room:replay", ()=>{
    handleRoomReplay(io, socketRoomId)
  })

  socket.on("room:end", () =>{
    handleEndRoom(io, socketRoomId)
  })

  socket.on("disconnect", () => {
    handleDisconnect(io, socket.id, socketRoomId)
  });

});



const port = 3000;
httpServer.listen(port, () => {
  console.log(`Server is listening on http://localhost:${port}`);
});

// add guard into functions
// add validators for event inputs
// add TTL to auto clean up room after max-time limit
// add AI compare text
// add AI generate prompts