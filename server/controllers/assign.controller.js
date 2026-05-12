import { resolveRoomAssignment } from "../lib/room-assigner.js";

// Resolves the assigned replica URL for a room by using Redis owner lookup.
export async function getRoomAssignment(req, res) {
  const roomId = req.params.roomId;

  const assignment = await resolveRoomAssignment(roomId);
  if (!assignment) {
    return res.status(404).json({ message: "room not found", roomId });
  }

  return res.status(200).json({
    roomId,
    replicaName: assignment.replicaName,
    socketUrl: assignment.socketUrl,
  });
}
