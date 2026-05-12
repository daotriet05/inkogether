import { roomData } from "../data/store.js";
import { GoogleGenerativeAI } from "@google/generative-ai";
/*
const PROMPTS = [
  'a cat',
  'a cow',
  'a dog',
  'a bird'
]
*/

const DRAW_PHASE_SECONDS = 60;
const GUESS_PHASE_SECONDS = 60;
//const BEFORE_SUMMARY_PHASE_SECONDS = 30; // need a gap between GUESS_PHASE and SUMMARY_PHASE to finish all matching check by AI 

const _genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY); // init AI model
const _compareCache = new Map(); // handle same pairs

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

async function pickTwoPrompts() {
  const model = _genAI.getGenerativeModel({
    model: "gemini-2.0-flash-lite",
    generationConfig: { responseMimeType: "application/json", temperature: 0.8 }
  });

  try {
    const result = await model.generateContent(`
      Generate 2 simple drawing prompts for a game. 
      Format: "Subject + Action + Object". 
      Difficulty: Easy to draw. 
      Return JSON: {"prompts": ["phrase1", "phrase2"]}
    `);
    const data = JSON.parse(result.response.text());
    const prompts = data.prompts || [];
    if (prompts.length < 2) throw new Error("not enough prompts");
    return { A: prompts[0], B: prompts[1] };
  } catch (error) {
    console.error("[pickTwoPrompts Error]", error.message);
    return { A: "a cat", B: "a dog" };
  }
}

export async function handleGameStart(io, userId, roomId){
  // check if user is host
  const room = roomData.get(roomId);
  if (!room || !room.participants.get(userId).isHost) {
    return;
  }

  // check if the phase is lobby
  if (room.phase !== "LOBBY"){
    io.to(userId).emit("error", { message: "The game is not in the lobby phase." });
    return;
  }
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
  if (!roomData.get(roomId)) return;
  await startGuessPhase(io, roomId);
  if (!roomData.get(roomId)) return;
  startSummaryPhase(io, roomId);
}

async function startDrawPhase(io, roomId){
  const prompts = await pickTwoPrompts(); // add await mới chạy được á
  const room = roomData.get(roomId);
  if (!room) return;

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
  if (!room) return;

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
  if (!room) return;

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


async function compareText(guess, target) {
  const g = guess.toLowerCase().trim().replace(/\s+/g, " ");
  const t = target.toLowerCase().trim().replace(/\s+/g, " ");

  if (g === t) return 1.0;

  const key = `${g}|${t}`;
  if (_compareCache.has(key)) return _compareCache.get(key);

  // Word overlap (70%)
  const STOPWORDS = new Set(["the","and","for","are","but","a","an"]);
  const tokenize = str => str.split(" ").filter(w => w.length >= 3 && !STOPWORDS.has(w));
  const gWords = new Set(tokenize(g));
  const tWords = new Set(tokenize(t));
  let wordScore = 0;
  if (gWords.size > 0 && tWords.size > 0) {
    let hits = 0;
    for (const w of gWords) if (tWords.has(w)) hits++;
    const precision = hits / gWords.size;
    const recall = hits / tWords.size;
    wordScore = precision + recall > 0 ? (2 * precision * recall) / (precision + recall) : 0;
  }

  // Bigram Jaccard (30%)
  const bigrams = str => {
    const set = new Set();
    for (let i = 0; i < str.length - 1; i++) set.add(str.slice(i, i + 2));
    return set;
  };
  const gBi = bigrams(g.replace(/ /g, ""));
  const tBi = bigrams(t.replace(/ /g, ""));
  let charScore = 0;
  if (gBi.size > 0 && tBi.size > 0) {
    let intersection = 0;
    for (const b of gBi) if (tBi.has(b)) intersection++;
    charScore = intersection / (gBi.size + tBi.size - intersection);
  }

  const quickScore = parseFloat((0.7 * wordScore + 0.3 * charScore).toFixed(4));

  if (quickScore >= 0.5) {
    const score = Math.min(1.0, Math.max(0.1, quickScore));
    _compareCache.set(key, score);
    return score;
  }

  // AI with timeout 3s
  try {
    const model = _genAI.getGenerativeModel({
      model: "gemini-2.0-flash-lite",
      generationConfig: { temperature: 0, maxOutputTokens: 64, responseMimeType: "application/json" }
    });

    const aiResult = await Promise.race([
      model.generateContent(
        `You are a semantic similarity judge for a word-guessing game.
Secret: "${t}" — Guess: "${g}"
Return ONLY: {"score": <0.0 to 1.0>}`
      ),
      new Promise((_, reject) => setTimeout(() => reject(new Error("timeout")), 3000))
    ]);

    const parsed = JSON.parse(aiResult.response.text().trim());
    const score = typeof parsed?.score === "number"
      ? Math.min(1.0, Math.max(0.1, parsed.score))
      : quickScore;

    _compareCache.set(key, score);
    return score;
  } catch {
    _compareCache.set(key, quickScore);
    return quickScore;
  }
}

export async function handleGuess(io, userId, roomId, guess){
  const room = roomData.get(roomId)
  const teamId = roomData.get(roomId).participants.get(userId).teamId;
  const user = room.participants.get(userId);
  const oppositeTeamId = (teamId=='A') ? 'B' : 'A';

  // compare to the prompts
  const result = await compareText(guess, room.prompts[oppositeTeamId])

  // assign the matching result
  const guessId = room.guesses[teamId].length+1
  const guessObject = {
    guess,
    matching: result,
    id: guessId,
    userId: userId,
    nickname: user.nickname
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
