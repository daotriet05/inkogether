import { roomData } from "../server";

const PROMPTS = [
  'a cat',
  'a cow',
  'a dog',
  'a bird'
]

const DRAW_PHASE_SECONDS = 10;
const GUESS_PHASE_SECONDS = 10;
const BEFORE_SUMMARY_PHASE_SECONDS = 30; // need a gap between GUESS_PHASE and SUMMARY_PHASE to finish all matching check by AI 


async function countDown(io, roomId, duration, phase){
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

export function startGame(io, roomId){
  startDrawPhase(io, roomId);
  startGuessPhase(io, roomId);
  startSummaryPhase(io, roomId);
  startEndPhase(io, roomId);
}

function startDrawPhase(io, roomId){
  const prompts = pickTwoPrompts();
  const room = roomData.get(roomId);

  // update data
  room.prompts.A = prompts.A
  room.prompts.B = prommpt.B

  // notify the prompts to the teams
  io.to(`room-${roomId}-team-A`).emit("game:prompts", prompts.A)
  io.to(`room-${roomId}-team-B`).emit("game:prompts", prompts.B)

  // start countdown
  countdown(io, roomId, "DRAW_PHASE", DRAW_PHASE_SECONDS);
  

}

function startGuessPhase(io, roomId){
  // swap drawings to the other teams
  io.to(`room-${roomId}-team-A`).emit("game:swap_drawing", room.strokes.B)
  io.to(`room-${roomId}-team-B`).emit("game:swap_drawing", room.strokes.A)

  // start countdown
  countDown(io, roomId, "GUESS_PHASE", GUESS_PHASE_SECONDS);
}

function startSummaryPhase(io, roomId){
  // start countdown
  countDown(io, roomId, "BEFORE_SUMMARY_PHASE", BEFORE_SUMMARY_PHASE_SECONDS);

  // send all drawings and guesses
  io.to(`room-${roomId}`).emit("game:summary", room.strokes, room.guesses)
}

function startEndPhase(io, roomId){
  io.to(`room-${roomId}`).emit("game:phase","END_PHASE")
}

export function cleanRoom(roomId){
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

  // reset room phase
  room.phase = "LOBBY";
}

// function replay(io, roomId){
//   // notify all participants
//   io.to(`room-${roomId}`).emit("game:replay");

//   // clean up data
//   cleanRoom(roomId)
// }

// function endRoom(io, roomId){
//   // notify all participants
//   io.to(`room-${roomId}`).emit("game:replay");

//   // delete room
//   roomData.delete(roomId);
// }

// need to add the notification of a phase start
// check the flow