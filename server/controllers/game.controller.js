import { roomData } from "../data/store.js";

const PROMPTS = [
  'a cat',
  'a cow',
  'a dog',
  'a bird'
]

const DRAW_PHASE_SECONDS = 10;
const GUESS_PHASE_SECONDS = 10;
//const BEFORE_SUMMARY_PHASE_SECONDS = 30; // need a gap between GUESS_PHASE and SUMMARY_PHASE to finish all matching check by AI 



async function countDown(io, roomId, phase, duration){
  io.to(`room-${roomId}`).emit("game:countdown", phase, "START")

  const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));
  while (duration){
    io.to(`room-${roomId}`).emit("game:countdown", phase, duration);
    
    duration--;
    await sleep(1000);
  }
  io.to(`room-${roomId}`).emit("game:countdown", phase, "END");
  
  return;
}

function pickTwoPrompts(){
  const shuffled = [...PROMPTS].sort(() => Math.random() - 0.5);
  return { A: shuffled[0], B: shuffled[1] };
}

export async function handleGameStart(io, userId, roomId){
  // check if user is host
  const room = roomData.get(roomId);
  if (!room || !room.participants.get(userId).isHost) {
    return;
  }

  // check if the phase is lobby
  if (room.phase !== "LOBBY")
    return;

  // check if all non-host players are ready and have a team
  const participants = Array.from(room.participants.values());
  const nonHostPlayers = participants.filter(p => !p.isHost);
  
  if (!nonHostPlayers.every(p => p.isReady)) {
    return; // not all non-host players are ready
  }

  // check both teams have at least one player
  const teamA = participants.filter(p => p.teamId === 'A');
  const teamB = participants.filter(p => p.teamId === 'B');
  if (teamA.length === 0 || teamB.length === 0) {
    return; // need players in both teams
  }

  // update room phase and start game flow
  await startDrawPhase(io, roomId);
  await startGuessPhase(io, roomId);
  startSummaryPhase(io, roomId);
}

async function startDrawPhase(io, roomId){
  const prompts = pickTwoPrompts();
  const room = roomData.get(roomId);
  
  //update phase
  room.phase = "DRAW"

  // notify to all room participants
  io.to(`room-${roomId}`).emit("game:phase", "DRAW")

  // update data
  room.prompts.A = prompts.A
  room.prompts.B = prompts.B

  // notify the prompts to the teams
  io.to(`room-${roomId}-team-A`).emit("game:prompts", prompts.A)
  io.to(`room-${roomId}-team-B`).emit("game:prompts", prompts.B)

  // start countdown
  await countDown(io, roomId, "DRAW", DRAW_PHASE_SECONDS);
  

}

async function startGuessPhase(io, roomId){
  const room = roomData.get(roomId);

  //update phase
  room.phase = "GUESS"

  // notify to all room participants
  io.to(`room-${roomId}`).emit("game:phase", "GUESS")

  // swap drawings to the other teams
  io.to(`room-${roomId}-team-A`).emit("game:swap_drawing", room.strokes.B)
  io.to(`room-${roomId}-team-B`).emit("game:swap_drawing", room.strokes.A)

  // start countdown
  await countDown(io, roomId, "GUESS", GUESS_PHASE_SECONDS);
}

function startSummaryPhase(io, roomId){
  const room = roomData.get(roomId);
  
  // update phase
  room.phase = "SUMMARY";

  // notify to all room participants
  io.to(`room-${roomId}`).emit("game:phase", "SUMMARY")

  // send all drawings and guesses
  io.to(`room-${roomId}`).emit("game:summary", room.prompts, room.strokes, room.guesses)

}

export function handleGameEnd(io, userId, roomId){
  if (!roomData.get(roomId).participants.get(userId).isHost)
    return

  // update phase
  roomData.get(roomId).phase = "END";

  // notify to all participants
  io.to(`room-${roomId}`).emit("game:phase", "END")
}

export function handleDraw(io, userId, roomId, drawObject){
  const teamId = roomData.get(roomId).participants.get(userId).teamId;
  const room = roomData.get(roomId)
  
  // update data
  room.strokes[teamId].push(drawObject)

  // forward the draw object
  io.to(`room-${roomId}-team-${teamId}`).emit("game:draw:new", drawObject)

  // log
  console.log(`user ${userId} in team ${teamId} of room ${roomId} draw`);
}


async function compareText(guess, prompts){
  if (guess === prompts) return 1.0;
  else return 0.1;
}

export async function handleGuess(io, userId, roomId, guess){
  const room = roomData.get(roomId)
  const teamId = roomData.get(roomId).participants.get(userId).teamId;
  const oppositeTeamId = (teamId=='A') ? 'B' : 'A';

  // compare to the prompts
  const result = await compareText(guess, room.prompts[oppositeTeamId])

  // assign the matching result
  const guessId = room.guesses[teamId].length+1
  const guessObject = {
    guess,
    matching: result,
    id: guessId
  }
  
  // update data
  room.guesses[teamId].push(guessObject)

  // notify to all team participant
  io.to(`room-${roomId}-team-${teamId}`).emit("game:guess:new", guessObject)

  // log
  console.log(`user ${userId} in team ${teamId} of room ${roomId} guesses '${guess}' with the matching ${result}`);
}



// need to add the notification of a phase start
// check the flow