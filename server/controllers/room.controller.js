import { roomData } from "../data/store.js";
import { randomBytes } from "node:crypto";
// GET ROOM DATA
export function getRoomData(req, res){
  const roomId = req.params.roomId;

  const room = roomData.get(roomId);
  
  if (!room) {
    return res.status(404).json({ message: "room not found" });
  }

  if (room.phase!=="LOBBY"){
    return res.status(403).json({ message: "the game has started. Could not join."})
  }

  return res.status(200).json({
    roomId,
    phase: room.phase,
    participants: Array.from(room.participants.entries()).map(([userId, participant]) => ({
      userId,
      ...participant,
    })),
    messages_lobby: room.messages_lobby,
    message_teams: room.message_teams,
    strokes: room.strokes,
    guesses: room.guesses,
    prompts: room.prompts
  });
}

// CREATE ROOM
export function handleCreateRoom(io, socket, userObject){
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

  return roomId;
}

// JOIN ROOM
export function handleJoinRoom(io, socket, userObject, roomId){
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

  return roomId ;
}

// CHANGE TEAM
export function handleTeamToggle(io, socket, socketRoomId){
  if (!socketRoomId) return;

  const userId = socket.id;
  const socketUserObject = roomData.get(socketRoomId).participants.get(userId)

  // leave the current team channel
  socket.leave(`room-${socketRoomId}-team-${socketUserObject.teamId}`);

  // update and join the new team channel
  socketUserObject.teamId = (socketUserObject.teamId=='A') ? 'B' : 'A';
  roomData.get(socketRoomId).participants.set(userId, socketUserObject);
  socket.join(`room-${socketRoomId}-team-${socketUserObject.teamId}`);

  // notify to all room participants
  io.to(`room-${socketRoomId}`).emit("room:updated", {
    userId,
    ...socketUserObject
  });

  // log
  console.log(`user ${userId} moved to the team ${socketUserObject.teamId}`);
}

// SET READY OR UNREADY
export function handleReadyToggle(io, userId, socketRoomId){
  if (!socketRoomId) return;

  const socketUserObject = roomData.get(socketRoomId).participants.get(userId)

  // update the new status
  socketUserObject.isReady = !socketUserObject.isReady;
  roomData.get(socketRoomId).participants.set(userId, socketUserObject);

  // notify to all room participants
  io.to(`room-${socketRoomId}`).emit("room:updated", {
    userId,
    ...socketUserObject
  });

  // log
  console.log(`user ${userId} set isReady to ${socketUserObject.isReady}`);
}


// CLEAN UP ROOM DATA
function cleanRoom(roomId){
  const room = roomData.get(roomId);

  // reset isReady of all participants
  room.participants.forEach(participant => {
    participant.isReady = false;
  });

  // reset strokes
  room.strokes.A = [];
  room.strokes.B = [];

  // reset guesses
  room.guesses.A = [];
  room.guesses.B = [];

  // reset prompts
  room.prompts.A = null;
  room.prompts.B = null;

  // reset room phase
  room.phase = "LOBBY";
}

// REPLAY AGAIN
export function handleRoomReplay(io, roomId){
  // notify all room participants
  io.to(`room-${roomId}`).emit("room:replay");

  // clean up data
  cleanRoom(roomId);
}

// END ROOM
export function handleEndRoom(io, roomId){
  if (roomData.get(roomId).phase !== "END" && roomData.get(roomId).phase !== "LOBBY")
    return

  // notify all room participants
  io.to(`room-${roomId}`).emit("room:ended");

  // delete data
  roomData.delete(roomId);
}

// DISCONNECT
export function handleDisconnect(io, userId, socketRoomId){
  if (!socketRoomId) return;

  const room = roomData.get(socketRoomId);
  if (!room) return;

  const leavingPlayer = room.participants.get(userId);
  if (leavingPlayer.isHost) {
    let nextHostId = null;
    let nextHostUserObject = null;

    for (const [participantUserId, participant] of room.participants.entries()) {
      if (participantUserId !== userId && !participant.isHost) {
        participant.isHost = true;
        nextHostId = participantUserId;
        nextHostUserObject = participant
        break;
      }
    }

    if (nextHostId) {
      io.to(`room-${socketRoomId}`).emit("room:host_changed", {
        userId: nextHostId,
        ...nextHostUserObject
      });
    } else {
      // this means this player is the last player in the room
      roomData.delete(socketRoomId);
      console.log(`room ${socketRoomId} deleted because the last player left`);
      return
    }
  }

  // remove this player
  console.log("disconnected: " + userId);
  room.participants.delete(userId);
  io.to(`room-${socketRoomId}`).emit("room:left", userId);
}



