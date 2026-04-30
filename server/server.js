import express from "express";
import { randomBytes } from "node:crypto";
import { createServer } from "node:http";
import { Server } from "socket.io";
import { getRoomData } from "./controllers/room.controller.js";
import { roomData } from "./data/store.js";
import { cleanRoom } from "./controllers/game.controller.js";

const app = express();
const httpServer = createServer(app);

export const io = new Server(httpServer, {
  cors: {
    origin: "*",
  },
}); 


app.get("/api/room/:roomId", getRoomData);

// CREATE ROOM
async function handleCreateRoom(socket, userObject){
  if (!socket || !userObject) return null;
  // setup user information
  const socketUserObject = {
    ...userObject,
    teamId: "A",
    isHost: true,
    isReady: false,
  };

  // create a new room
  const roomId = randomBytes(4).toString('hex');

  // initialize room data
  roomData.set(roomId, {
    phase: "LOBBY",
    participants: new Map(),
    messages_lobby: [],
    message_teams: { A: [], B: [] },
    strokes: { A: [], B: [] },
    guesses: { A: [], B: [] },
    prompts: {
      A: null,
      B: null
    }
  });

  // join the room/team channel and update
  socket.join(`room-${roomId}`);
  socket.join(`room-${roomId}-team-${socketUserObject.teamId}`);
  roomData.get(roomId).participants.set(socket.id, socketUserObject);

  // notify that the room created
  io.to(`room-${roomId}`).emit("room:created", {
    roomId,
    roomHostId: socket.id
  });

  // log
  console.log(`user ${socket.id} created the room ${roomId}`);

  return { socketUserObject, socketRoomId: roomId };
}

// JOIN ROOM
function handleJoinRoom(socket, userObject, roomId){
  // check if the room allows to join
  if (!roomData.get(roomId) || roomData.get(roomId).phase !== 'LOBBY'){
    console.log(`user ${socket.id} cannot join the room ${roomId}`);
    return null;
  }

  // init the user data
  const socketUserObject = {
    ...userObject,
    teamId: "A",
    isHost: false,
    isReady: false,
  };

  // join room/team channel and update
  socket.join(`room-${roomId}`);
  socket.join(`room-${roomId}-team-${socketUserObject.teamId}`);
  roomData.get(roomId).participants.set(socket.id, socketUserObject);

  // notify to all participants about the newcomer
  io.to(`room-${roomId}`).emit("room:joined", {
    userId: socket.id,
    ...socketUserObject
  });

  // log
  console.log(`user ${socket.id} joined the room ${roomId}`);

  return { socketUserObject, socketRoomId: roomId };
}

// CHANGE TEAM
function handleTeamToggle(socket, socketUserObject, socketRoomId){
  // leave the current team channel
  socket.leave(`room-${socketRoomId}-team-${socketUserObject.teamId}`);

  // update and join the new team channel
  socketUserObject.teamId = (socketUserObject.teamId=='A') ? 'B' : 'A';
  roomData.get(socketRoomId).participants.set(socket.id, socketUserObject);
  socket.join(`room-${socketRoomId}-team-${socketUserObject.teamId}`);

  // notify to all room participants
  io.to(`room-${socketRoomId}`).emit("team:updated", {
    userId: socket.id,
    ...socketUserObject
  });

  // log
  console.log(`user ${socket.id} moved to the team ${socketUserObject.teamId}`);
  return socketUserObject;
}

// LOBBY MESSAGE
function handleMessageLobby(userId, socketRoomId, messageObject){
  const newMessageObject = { userId, ...messageObject };
  const room = roomData.get(socketRoomId);

  // add the new message to the data
  room.messages_lobby.push(newMessageObject);

  // forward the message
  io.to(`room-${socketRoomId}`).emit("message-lobby:new", newMessageObject);

  // log
  console.log(`message '${messageObject.content}' in the room ${socketRoomId} from the user ${userId}`);
}

// TEAM MESSAGE
function handleMessageTeam(userId, socketUserObject, socketRoomId, messageObject){
  const newMessageObject = { userId, ...messageObject };
  const room = roomData.get(socketRoomId)

  // add the new message to the data
  room.message_teams[socketUserObject.teamId].push(newMessageObject)

  // forward the message
  io.to(`room-${socketRoomId}-team-${socketUserObject.teamId}`).emit("message-team:new", newMessageObject);

  // log
  console.log(`message '${messageObject.content}' in the team ${socketUserObject.teamId} of the room ${socketRoomId} from the user ${userId}`);
}

// SET READY OR UNREADY
function handleReadyToggle(userId, socketUserObject, socketRoomId){
  // update the new status
  socketUserObject.isReady = !socketUserObject.isReady;
  roomData.get(socketRoomId).participants.set(userId, socketUserObject);

  // notify to all room participants
  io.to(`room-${socketRoomId}`).emit("team:updated", {
    userId,
    ...socketUserObject
  });

  // log
  console.log(`user ${userId} set isReady to ${socketUserObject.isReady}`);
  return socketUserObject;
}

// START GAME
function handleGameStart(socketRoomId){
  if (socketUserObject.isHost==false) return
  const room = roomData.get(socketRoomId);

  // check if the room is able to start the game
  let start=true;
  room.participants.forEach(participant => { 
    if (participant.isHost==false && participant.isReady==false){
      start=false;
      break;
    }
  });

  // update status
  room.phase = 'DRAW'
  // bruh need to finish this step
}

function handleDisconnect(userId, socketRoomId){
  console.log("disconnected: "+userId);
  if (socketRoomId) io.to(`room-${socketRoomId}`).emit("room:left", userId);
  if (socketRoomId) {
    const room = roomData.get(socketRoomId);
    if (room) room.participants.delete(userId);
  }
}

async function compareText(guess, prompts){
  if (guess === prompts) return 1.0;
  else return 0.1;
}

io.on("connection", (socket) => {
  console.log("connected: "+socket.id);
  let socketUserObject = {};
  let socketRoomId = null;

  socket.on("room:create", async (userObject) =>{
    const result = await handleCreateRoom(socket, userObject);
    if (result){ socketUserObject = result.socketUserObject; socketRoomId = result.socketRoomId; }
  });

  socket.on("room:join", (userObject, roomId) => {
    const result = handleJoinRoom(socket, userObject, roomId);
    if (result){ socketUserObject = result.socketUserObject; socketRoomId = result.socketRoomId; }
  });

  socket.on("room:team_toggle", () => {
    socketUserObject = handleTeamToggle(socket, socketUserObject, socketRoomId);
  });

  socket.on("message-lobby:send", (messageObject) => {
    handleMessageLobby(socket.id, socketRoomId, messageObject);
  });

  socket.on("message-team:send", (messageObject) => {
    handleMessageTeam(socket.id, socketUserObject, socketRoomId, messageObject);
  });

  socket.on("room:ready_toggle", () => {
    socketUserObject = handleReadyToggle(socket.id, socketUserObject, socketRoomId);
  });

  socket.on("game:start", () => {
    handleGameStart(socketRoomId);
  });

  socket.on("game:draw:send", (drawObject) => {
    const room = roomData.get(socketRoomId)

    // update data
    room.strokes[socketUserObject.teamId].push(drawObject)

    // forward the draw object
    io.to(`room-${socketRoomId}-team-${socketUserObject.teamId}`).emit("game:draw:new", drawObject)

    // log
    console.log(`user ${socket.id} in team ${socketUserObject.teamId} of room ${socketRoomId} draw`);
    
  })

  socket.on("game:guess:send", async (guess) => {
    const room = roomData.get(socketRoomId)
    const oppositeTeamId = (socketUserObject.teamId=='A') ? 'B' : 'A';

    // compare to the prompts
    const result = await compareText(guess, room.prompts[oppositeTeamId])

    // assign the matching result
    const guessId = room.guess[socketUserObject.teamId].length
    const guessObject = {
      guess,
      matching: result,
      id: guessId
    }
    
    // update data
    room.guess[socketUserObject.teamId].push(guessObject)

    // notify to all team participant
    io.to(`room-${socketRoomId}-team-${socketUserObject.teamId}`).emit("game:guess:new", guessObject)

    // log
    console.log(`user ${socket.id} in team ${socketUserObject.teamId} of room ${socketRoomId} guesses '${guess}' with the matching ${result}`);
  })

  socket.on("room:replay", ()=>{
    // notify all room participants
    io.to(`room-${roomId}`).emit("room:replay");

    // clean up data
    cleanRoom(socketRoomId);
  })

  socket.on("room:end", () =>{
    // notify all room participants
    io.to(`room-${roomId}`).emit("room:end");

    // delete data
    roomData.delete(roomId);
  })

  socket.on("disconnect", () => {
    handleDisconnect(socket.id, socketRoomId);
  });

});



const port = 3000;
httpServer.listen(port, () => {
  console.log(`Server is listening on http://localhost:${port}`);
});