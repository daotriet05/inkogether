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
import { getRoomAssignment } from "./controllers/assign.controller.js";

const app = express();
app.use(cors());
const httpServer = createServer(app);

export const io = new Server(httpServer, {
  cors: {
    origin: "*",
  },
}); 

app.get("/health", async (req, res) => {
  const appName = process.env.APP_NAME || "unknown";
  const port = process.env.PORT || "unknown";

  res.status(200).json({
    status: "ok",
    app: appName,
    port,
    uptime: process.uptime(),
    timestamp: new Date().toISOString()
  });
});

app.get("/api/room/:roomId", getRoomData);
app.get("/api/assign/:roomId", getRoomAssignment);



io.on("connection", (socket) => {
  console.log("connected: "+socket.id);
  let socketRoomId = null;

  // listen for creating a new room event
  socket.on("room:create", async (userObject) =>{
    socketRoomId = await handleCreateRoom(io, socket, userObject);
  });

  // listen for joining an existed room event
  socket.on("room:join", (userObject, roomId) => {
    socketRoomId = handleJoinRoom(io, socket, userObject, roomId);
  });

  // listen for changing team event (between team A and B)
  socket.on("room:team_toggle", () => {
    handleTeamToggle(io, socket, socketRoomId);
  });

  // listen for ready/unready event
  socket.on("room:ready_toggle", () => {
    handleReadyToggle(io, socket.id, socketRoomId);
  });

  // listen for new lobby messages
  socket.on("message-lobby:send", (messageObject) => {
    handleMessageLobby(io, socket.id, socketRoomId, messageObject);
  });

  // listen for new team message (broadcast to his team)
  socket.on("message-team:send", (messageObject) => {
    handleMessageTeam(io, socket.id, socketRoomId, messageObject);
  });

  // listen for starting the game event
  socket.on("game:start", async () => {
    await handleGameStart(io, socket.id, socketRoomId);
  });

  // listen for new draws (broadcast to his team)
  socket.on("game:draw:send", (drawObject) => {
    handleDraw(io, socket.id, socketRoomId, drawObject);
  })

  // listen for new guesses (broadcast to his team)
  socket.on("game:guess:send", async (guess) => {
    handleGuess(io, socket.id, socketRoomId, guess)
  })

  // listen for ending the game event
  socket.on("game:end", () => {
    handleGameEnd(io, socket.id, socketRoomId);
  })

  // listen for replaying (new game) event
  socket.on("room:replay", ()=>{
    handleRoomReplay(io, socketRoomId)
  })

  // listen for ending room 
  socket.on("room:end", async () =>{
    await handleEndRoom(io, socketRoomId)
  })
  
  socket.on("disconnect", async () => {
    await handleDisconnect(io, socket.id, socketRoomId)
  });

});



const port = process.env.PORT || 3000;
httpServer.listen(port, () => {
  console.log(`Server is listening on http://localhost:${port}`);
});

// add guard into functions
// add validators for event inputs
// add TTL to auto clean up room after max-time limit