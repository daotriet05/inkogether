import express from "express";
import cors from "cors";
import { createServer } from "node:http";
import { Server } from "socket.io";
import { createClient } from "redis";
import { createAdapter } from "@socket.io/redis-adapter";
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

// Initialize Redis adapter for multi-replica broadcasts
const redisUrl = process.env.REDIS_URL || "redis://localhost:6379";
const pubClient = createClient({ url: redisUrl });
const subClient = pubClient.duplicate();

Promise.all([pubClient.connect(), subClient.connect()]).then(() => {
  io.adapter(createAdapter(pubClient, subClient));
  console.log("Redis adapter connected");
}).catch((err) => {
  console.error("Failed to connect to Redis:", err);
});


app.get("/api/room/:roomId", getRoomData);
app.get("/api/assign/:roomId", getRoomAssignment);



io.on("connection", (socket) => {
  console.log("connected: "+socket.id);
  let socketRoomId = null;

  socket.on("room:create", async (userObject) =>{
    socketRoomId = await handleCreateRoom(io, socket, userObject);
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