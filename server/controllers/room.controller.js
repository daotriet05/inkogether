import { roomData } from "../data/store.js";

export function getRoomData(req, res){
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

export function create_room(user_Object){
  
}