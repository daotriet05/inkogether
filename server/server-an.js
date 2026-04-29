import express from "express";
import {Server} from 'socket.io';
import http from 'http';
import cors from 'cors';


const app = express();
app.use(cors());
const server = http.createServer(app);
const io = new Server(server, {
  cors: { origin: 'http://localhost:5173', methods: ['GET', 'POST'] },
});

// ==== prompts=======

const PROMPTS = [
  'A cat eating a sandwich',
  'A ghost on a skateboard',
  'A wizard doing laundry',
  'A dinosaur using a smartphone',
  'A penguin at a beach party',
  'A robot making coffee',
  'A snail racing a car',
];

function pickTwoPrompts() {
  const shuffled = [...PROMPTS].sort(() => Math.random() - 0.5);
  return { A: shuffled[0], B: shuffled[1] };
}

// ==== room management ====

const rooms = new Map();

function generateCode() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let code;
  do {
    code = Array.from({ length: 6 }, () => chars[Math.floor(Math.random() * chars.length)]).join('');
  } while (rooms.has(code));
  return code;
}

function createRoom(hostSocketId, hostName) {
  const code = generateCode();
  const room = {
    code,
    phase: 'lobby',
    players: new Map(),
    prompts: null,
    strokes: { A: [], B: [] },
    guesses: { A: [], B: [] },
    timer: null,
  };
  room.players.set(hostSocketId, {
    id: hostSocketId,
    name: hostName,
    team: null,
    ready: false,
    isHost: true,
  });
  rooms.set(code, room);
  return room;
}

function roomPlayers(room) {
  return Array.from(room.players.values());
}

function broadcastRoom(room) {
  io.to(`room:${room.code}`).emit('room_update', {
    phase: room.phase,
    players: roomPlayers(room),
  });
}

// ==== Phase transitions ====

const PROMPT_REVEAL_MS = 8000;
const DRAW_SECONDS = 60;
const GUESS_SECONDS = 45;

function clearRoomTimer(room) {
  if (room.timer) {
    clearTimeout(room.timer);
    room.timer = null;
  }
}

function startCountdown(room, seconds, onEnd) {
  let remaining = seconds;

  const tick = () => {
    io.to(`room:${room.code}`).emit('phase_timer', { secondsLeft: remaining });
    if (remaining === 0) {
      onEnd();
      return;
    }
    remaining--;
    room.timer = setTimeout(tick, 1000);
  };

  tick();
}

function startPromptPhase(room) {
  room.phase = 'prompt';
  room.prompts = pickTwoPrompts();
  room.strokes = { A: [], B: [] };
  room.guesses = { A: [], B: [] };

  const allPlayers = roomPlayers(room);
  const teamA = allPlayers.filter(p => p.team === 'A');
  const teamB = allPlayers.filter(p => p.team === 'B');

  // send each team only their own prompt, before phase broadcast
  for (const p of teamA) io.to(p.id).emit('prompt_reveal', { prompt: room.prompts.A });
  for (const p of teamB) io.to(p.id).emit('prompt_reveal', { prompt: room.prompts.B });

  broadcastRoom(room);

  clearRoomTimer(room);
  room.timer = setTimeout(() => startDrawPhase(room), PROMPT_REVEAL_MS);
}

function startDrawPhase(room) {
  room.phase = 'draw';
  clearRoomTimer(room);
  broadcastRoom(room);
  startCountdown(room, DRAW_SECONDS, () => startGuessPhase(room));
}

function startGuessPhase(room) {
  room.phase = 'guess';
  clearRoomTimer(room);

  const allPlayers = roomPlayers(room);
  const teamA = allPlayers.filter(p => p.team === 'A');
  const teamB = allPlayers.filter(p => p.team === 'B');

  // Send opponent strokes before phase broadcast so client has data when screen mounts
  for (const p of teamA) io.to(p.id).emit('opponent_drawing', { strokes: room.strokes.B });
  for (const p of teamB) io.to(p.id).emit('opponent_drawing', { strokes: room.strokes.A });

  broadcastRoom(room);
  startCountdown(room, GUESS_SECONDS, () => startSummaryPhase(room));
}

function startSummaryPhase(room) {
  room.phase = 'summary';
  clearRoomTimer(room);

  // Send summary data before phase broadcast
  io.to(`room:${room.code}`).emit('summary_data', {
    teamA: {
      prompt: room.prompts.A,
      strokes: room.strokes.A,
      guesses: room.guesses.B, // team B guessed team A's drawing
    },
    teamB: {
      prompt: room.prompts.B,
      strokes: room.strokes.B,
      guesses: room.guesses.A, // team A guessed team B's drawing
    },
  });

  broadcastRoom(room);
}

function startEndPhase(room) {
  room.phase = 'end';
  clearRoomTimer(room);
  broadcastRoom(room);
}

function resetToLobby(room) {
  room.phase = 'lobby';
  room.prompts = null;
  room.strokes = { A: [], B: [] };
  room.guesses = { A: [], B: [] };
  clearRoomTimer(room);

  for (const player of room.players.values()) {
    player.ready = false;
  }

  broadcastRoom(room);
}

// ==== Socket.IO ====

io.on('connection', (socket) => {
  console.log(`+ ${socket.id}`);

  let myRoomCode = null;

  const getRoom = () => (myRoomCode ? rooms.get(myRoomCode) : null);
  const getPlayer = () => getRoom()?.players.get(socket.id) ?? null;

  socket.on('create_room', ({ name }) => {
    if (!name?.trim()) return socket.emit('error', { message: 'Name is required' });

    const room = createRoom(socket.id, name.trim());
    myRoomCode = room.code;
    socket.join(`room:${room.code}`);

    socket.emit('room_created', {
      roomCode: room.code,
      myId: socket.id,
      players: roomPlayers(room),
      phase: room.phase,
    });
  });

  socket.on('join_room', ({ code, name }) => {
    const room = rooms.get(code?.toUpperCase?.());
    if (!room) return socket.emit('error', { message: 'Room not found' });
    if (room.phase !== 'lobby') return socket.emit('error', { message: 'Game already in progress' });
    if (room.players.size >= 10) return socket.emit('error', { message: 'Room is full (10 max)' });
    if (!name?.trim()) return socket.emit('error', { message: 'Name is required' });

    room.players.set(socket.id, {
      id: socket.id,
      name: name.trim(),
      team: null,
      ready: false,
      isHost: false,
    });

    myRoomCode = room.code;
    socket.join(`room:${room.code}`);

    socket.emit('room_joined', {
      roomCode: room.code,
      myId: socket.id,
      players: roomPlayers(room),
      phase: room.phase,
    });

    broadcastRoom(room);
  });

  socket.on('join_team', ({ team }) => {
    const room = getRoom();
    const player = getPlayer();
    if (!room || !player || room.phase !== 'lobby') return;
    if (team !== 'A' && team !== 'B') return;

    const teamCount = roomPlayers(room).filter(p => p.team === team && p.id !== socket.id).length;
    if (teamCount >= 5) return socket.emit('error', { message: 'Team is full (5 max)' });

    if (player.team) socket.leave(`room:${room.code}:${player.team}`);

    player.team = team;
    player.ready = false;
    socket.join(`room:${room.code}:${team}`);

    broadcastRoom(room);
  });

  socket.on('player_ready', ({ ready }) => {
    const room = getRoom();
    const player = getPlayer();
    if (!room || !player || room.phase !== 'lobby' || !player.team) return;

    player.ready = !!ready;
    broadcastRoom(room);
  });

  socket.on('start_game', () => {
    const room = getRoom();
    const player = getPlayer();
    if (!room || !player || !player.isHost || room.phase !== 'lobby') return;

    const players = roomPlayers(room);
    const teamA = players.filter(p => p.team === 'A');
    const teamB = players.filter(p => p.team === 'B');

    if (teamA.length === 0 || teamB.length === 0) {
      return socket.emit('error', { message: 'Both teams need at least one player' });
    }

    const nonHostWithTeam = players.filter(p => p.team && !p.isHost);
    if (!nonHostWithTeam.every(p => p.ready)) {
      return socket.emit('error', { message: 'Not all players are ready' });
    }

    startPromptPhase(room);
  });

  socket.on('draw', ({ x0, y0, x1, y1, color, size, tool }) => {
    const room = getRoom();
    const player = getPlayer();
    if (!room || !player || room.phase !== 'draw' || !player.team) return;

    const stroke = { x0, y0, x1, y1, color, size, tool };
    room.strokes[player.team].push(stroke);

    // Broadcast to teammates only (not sender)
    socket.to(`room:${room.code}:${player.team}`).emit('draw', stroke);
  });

  socket.on('send_message', ({ text, scope }) => {
    const room = getRoom();
    const player = getPlayer();
    if (!room || !player || !text?.trim()) return;

    const msg = { who: player.name, msg: text.trim() };

    if (scope === 'team' && player.team) {
      io.to(`room:${room.code}:${player.team}`).emit('message', { ...msg, scope: 'team', team: player.team });
    } else {
      io.to(`room:${room.code}`).emit('message', { ...msg, scope: 'global' });
    }
  });

  socket.on('submit_guess', ({ text }) => {
    const room = getRoom();
    const player = getPlayer();
    if (!room || !player || room.phase !== 'guess' || !player.team || !text?.trim()) return;

    // Team A guesses Team B's prompt, and vice versa
    const targetTeam = player.team === 'A' ? 'B' : 'A';
    const correctPrompt = room.prompts[targetTeam];

    const normalize = (s) => s.toLowerCase().replace(/[^a-z0-9 ]/g, '').replace(/\s+/g, ' ').trim();
    const isMatch = normalize(text.trim()) === normalize(correctPrompt);

    const guess = { who: player.name, msg: text.trim(), match: isMatch };
    room.guesses[player.team].push(guess);

    // Broadcast to the guessing team so all teammates see live guesses
    io.to(`room:${room.code}:${player.team}`).emit('guess_result', guess);

    if (isMatch) {
      io.to(`room:${room.code}`).emit('guess_matched', { team: player.team, who: player.name });
    }
  });

  socket.on('advance_summary', () => {
    // Host triggers end after summary animation completes
    const room = getRoom();
    const player = getPlayer();
    if (!room || !player || !player.isHost || room.phase !== 'summary') return;
    startEndPhase(room);
  });

  socket.on('play_again', () => {
    const room = getRoom();
    const player = getPlayer();
    if (!room || !player || !player.isHost || room.phase !== 'end') return;
    resetToLobby(room);
  });

  socket.on('end_room', () => {
    const room = getRoom();
    const player = getPlayer();
    if (!room || !player || !player.isHost) return;

    clearRoomTimer(room);
    io.to(`room:${room.code}`).emit('room_ended');
    rooms.delete(room.code);
  });

  socket.on('disconnect', () => {
    console.log(`- ${socket.id}`);

    const room = getRoom();
    if (!room) return;

    const player = room.players.get(socket.id);
    if (!player) return;

    room.players.delete(socket.id);

    if (room.players.size === 0) {
      clearRoomTimer(room);
      rooms.delete(room.code);
      return;
    }

    // reassign host if host left
    if (player.isHost) {
      const next = room.players.values().next().value;
      if (next) {
        next.isHost = true;
        io.to(next.id).emit('became_host');
      }
    }

    socket.to(`room:${room.code}`).emit('player_left', { playerId: socket.id, name: player.name });
    broadcastRoom(room);
  });
});

// ==== Start ====

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => console.log(`Server running on http://localhost:${PORT}`));
