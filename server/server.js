import express from "express";
import { randomBytes } from "node:crypto";
import { createServer } from "node:http";
import { Server } from "socket.io";

const app = express();
const httpServer = createServer(app);

const io = new Server(httpServer, {
  cors: {
    origin: "*",
  },
}); 

// app.post("/api/room", (req, res)=>{
//   const roomId = randomBytes(4).toString('hex');

//   // initialize room data in one Map entry
//   roomData.set(roomId, {
//     status: "lobby",
//     participants: new Map(),
//     messages: []
//   });
  

//   return res.status(201).json({
//     message: "created a new room successfully", 
//     roomId
//   })
// })

app.get("/api/room/:roomId", (req, res)=>{
  const roomId = req.params.roomId;

  const room = roomData.get(roomId);
  
  if (!room) {
    return res.status(404).json({ message: "room not found" });
  }

  if (room.status=="started"){
    return res.status(403).json({ message: "the game has started. Could not join."})
  }

  return res.status(200).json({
    roomId,
    status: room.status,
    participants: Array.from(room.participants.entries()).map(([userId, participant]) => ({
      userId,
      ...participant,
    })),
    messages: room.messages
  });
})

const roomData = new Map();

io.on("connection", (socket) => {
  console.log("connected: "+socket.id);
  let socketUserObject = {};
  let socketRoomId = null;

  // CREATE A ROOM
  socket.on("room:create", (userObject) =>{
    // check if the user is not in a room
    if (socketRoomId)
      return

    // setup user information
    socketUserObject = {
      ...userObject,
      teamId: 1,
      isHost: true,
      isReady: false,
    }
    console.log(`setup account ${socket.id} with nickname ${socketUserObject.nickname} and avatar ${socketUserObject.avatarId}`);

    // create a new room
    const roomId = randomBytes(4).toString('hex');
    socketRoomId =  roomId

    // initialize room data in one Map entry
    roomData.set(roomId, {
      status: "lobby",
      participants: new Map(),
      messages: []
    });
    
    // join the room channel
    socket.join(`room-${socketRoomId}`);
    roomData.get(roomId).participants.set(socket.id,socketUserObject);
    
    // notify that the room created
    io.to(`room-${socketRoomId}`).emit("room:created", {
      roomId: socketRoomId, 
      roomHostId: socket.id
    });

    // join the team channel
    socket.join(`room-${socketRoomId}-team-${socketUserObject.teamId}`)

    // log
    console.log(`user ${socket.id} created the room ${roomId}`);
    
  })

  // JOIN A ROOM
  socket.on("room:join", (userObject, roomId)=>{
    // check if the room allow to join
    if (!roomData.get(roomId) || !roomData.get(roomId).status=='lobby') {
      console.log(`user ${socket.id} cannot join the room ${roomId}`);
      
      return
    }

    // setup user information
    socketUserObject = {
      ...userObject,
      teamId: 1,
      isHost: false,
      isReady: false,
    }
    console.log(`setup account ${socket.id} with nickname ${socketUserObject.nickname} and avatar ${socketUserObject.avatarId}`);

    // join the room channel
    socketRoomId =  roomId;
    socket.join(`room-${socketRoomId}`);
    roomData.get(roomId).participants.set(socket.id,socketUserObject);
    
    // notify to all current participants
    io.to(`room-${socketRoomId}`).emit("room:joined", {
      userId: socket.id,
      ...socketUserObject
    });

    // join the team channel
    socket.join(`room-${socketRoomId}-team-${socketUserObject.teamId}`)

    // log
    console.log(`user ${socket.id} joined the room ${roomId}`);
  })


  // SWITCH TEAM (1 to 2, or vice versa)
  socket.on("team:toggle", () => {
    if (!roomData.get(socketRoomId).participants.has(socket.id)) 
      return;

    // leave the current team channel
    socket.leave(`room-${socketRoomId}-team-${socketUserObject.teamId}`)

    // get the new teamId and update
    socketUserObject.teamId = (socketUserObject.teamId=='1') ? '2' : '1';
    roomData.get(socketRoomId).participants.set(socket.id, socketUserObject)

    // join the new team channel
    socket.join(`room-${socketRoomId}-team-${socketUserObject.teamId}`)

    // notify to all current participants
    io.to(`room-${socketRoomId}`).emit("team:updated", socket.id);

    // log
    console.log(`user ${socket.id} moved to the team ${socketUserObject.teamId}`);

  })


  socket.on("message-lobby:send", (messageObject) => {
    
    // forward the message
    const newMessageObject = {
      userId: socket.id,
      ...messageObject,
    };

    roomData.get(socketRoomId).messages.push(newMessageObject);

    io.to(`room-${socketRoomId}`).emit("message-lobby:new",{
      ...newMessageObject
    })

    // log
    console.log(`message '${messageObject.content}' in the room ${socketRoomId} from the user ${socket.id}`);
    
  })

  socket.on("message-team:send", (messageObject) => {
    // forward the message
    io.to(`room-${socketRoomId}-team-${socketUserObject.teamId}`).emit("message-team:new", {
      userId: socket.id,
      ...messageObject
    })

    // log
    console.log(`message '${messageObject.content}' in the team ${socketUserObject.teamId} of the room ${socketRoomId} from the user ${socket.id}`);
    
  })

  // get ready
  socket.on("game:ready", ()=>{})

  // get started
  socket.on("game:start", ()=>{})

  socket.on("disconnect", ()=>{
    console.log("disconnected: "+socket.id);
    
    io.to(`room-${socketRoomId}`).emit("room:left", socket.id)

    roomData.get(socketRoomId).participants.delete(socket.id);
  })
  
})



const port = 3000;
httpServer.listen(port, () => {
  console.log(`Server is listening on http://localhost:${port}`);
});