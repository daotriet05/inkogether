import { roomData } from "../data/store.js";

// LOBBY MESSAGE
export function handleMessageLobby(io, userId, socketRoomId, messageObject){
  if (!socketRoomId) return;

  const room = roomData.get(socketRoomId);
  const user = room.participants.get(userId);

  const newMessageObject = { userId, nickname: user?.nickname || userId, ...messageObject };

  // add the new message to the data
  room.messages_lobby.push(newMessageObject);

  // forward the message
  io.to(`room-${socketRoomId}`).emit("message-lobby:new", newMessageObject);

  // log
  console.log(`message '${messageObject.content}' in the room ${socketRoomId} from the user ${userId}`);
}

// TEAM MESSAGE
export function handleMessageTeam(io, userId, socketRoomId, messageObject){
  if (!socketRoomId) return;

  const room = roomData.get(socketRoomId);
  const user = room.participants.get(userId);
  const socketTeamId = user.teamId;

  const newMessageObject = { 
    userId, 
    nickname: user?.nickname || userId,
    ...messageObject 
  };

  // add the new message to the data
  room.message_teams[socketTeamId].push(newMessageObject)

  // forward the message
  io.to(`room-${socketRoomId}-team-${socketTeamId}`).emit("message-team:new", newMessageObject);

  // log
  console.log(`message '${messageObject.content}' in the team ${socketTeamId} of the room ${socketRoomId} from the user ${userId}`);
}