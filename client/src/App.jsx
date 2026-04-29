import { createContext, useCallback, useContext, useEffect, useMemo, useReducer } from 'react';
import { io } from 'socket.io-client';
import WelcomeScreen from './screens/WelcomeScreen';
import LobbyScreen from './screens/LobbyScreen';
// import PromptScreen from './screens/PromptScreen';
// import DrawScreen from './screens/DrawScreen';
// import GuessScreen from './screens/GuessScreen';
// import SummaryScreen from './screens/SummaryScreen';
// import EndScreen from './screens/EndScreen';

// ── Contexts ──────────────────────────────────────────────────────────────────

const GameContext = createContext(null);
const SocketContext = createContext(null);

export const useGame = () => useContext(GameContext);
export const useSocket = () => useContext(SocketContext);

// ── State ─────────────────────────────────────────────────────────────────────

const initialState = {
  phase: 'welcome',
  roomCode: null,
  myId: null,
  players: [],
  prompt: null,
  opponentStrokes: [],
  guesses: [],
  summaryData: null,
  timer: null,
  messages: [],
  error: null,
};

function reducer(state, action) {
  switch (action.type) {
    case 'ROOM_CREATED':
    case 'ROOM_JOINED':
      return {
        ...initialState,
        phase: 'lobby',
        roomCode: action.roomCode,
        myId: action.myId,
        players: action.players,
      };

    case 'ROOM_UPDATE': {
      const next = { ...state, phase: action.phase, players: action.players };
      if (action.phase === 'lobby' && state.phase !== 'lobby') {
        return { ...next, prompt: null, opponentStrokes: [], guesses: [], summaryData: null, timer: null, messages: [] };
      }
      return next;
    }

    case 'PROMPT_REVEAL':
      return { ...state, prompt: action.prompt };

    case 'OPPONENT_DRAWING':
      return { ...state, opponentStrokes: action.strokes };

    case 'GUESS_RESULT':
      return { ...state, guesses: [...state.guesses, action.guess] };

    case 'SUMMARY_DATA':
      return { ...state, summaryData: action.data };

    case 'PHASE_TIMER':
      return { ...state, timer: action.secondsLeft };

    case 'MESSAGE':
      return { ...state, messages: [...state.messages, action.msg] };

    case 'ERROR':
      return { ...state, error: action.message };

    case 'CLEAR_ERROR':
      return { ...state, error: null };

    case 'ROOM_ENDED':
      return { ...initialState };

    default:
      return state;
  }
}

// ── App ───────────────────────────────────────────────────────────────────────

export default function App() {
  const [state, dispatch] = useReducer(reducer, initialState);

  const socket = useMemo(() => io('http://localhost:3000'), []);

  useEffect(() => {
    socket.on('room_created', ({ roomCode, myId, players }) => {
      dispatch({ type: 'ROOM_CREATED', roomCode, myId, players });
    });

    socket.on('room_joined', ({ roomCode, myId, players }) => {
      dispatch({ type: 'ROOM_JOINED', roomCode, myId, players });
    });

    socket.on('room_update', ({ phase, players }) => {
      dispatch({ type: 'ROOM_UPDATE', phase, players });
    });

    socket.on('prompt_reveal', ({ prompt }) => {
      dispatch({ type: 'PROMPT_REVEAL', prompt });
    });

    socket.on('opponent_drawing', ({ strokes }) => {
      dispatch({ type: 'OPPONENT_DRAWING', strokes });
    });

    socket.on('guess_result', (guess) => {
      dispatch({ type: 'GUESS_RESULT', guess });
    });

    socket.on('guess_matched', ({ team, who }) => {
      const teamName = team === 'A' ? 'Team Coral' : 'Team Sky';
      dispatch({
        type: 'MESSAGE',
        msg: { scope: 'system', msg: `✓ ${who} (${teamName}) guessed it!` },
      });
    });

    socket.on('summary_data', (data) => {
      dispatch({ type: 'SUMMARY_DATA', data });
    });

    socket.on('phase_timer', ({ secondsLeft }) => {
      dispatch({ type: 'PHASE_TIMER', secondsLeft });
    });

    socket.on('message', (msg) => {
      dispatch({ type: 'MESSAGE', msg });
    });

    socket.on('player_left', ({ name }) => {
      dispatch({ type: 'MESSAGE', msg: { scope: 'system', msg: `${name} left the room` } });
    });

    socket.on('became_host', () => {
      dispatch({ type: 'MESSAGE', msg: { scope: 'system', msg: 'You are now the host' } });
    });

    socket.on('room_ended', () => {
      dispatch({ type: 'ROOM_ENDED' });
    });

    socket.on('error', ({ message }) => {
      dispatch({ type: 'ERROR', message });
      setTimeout(() => dispatch({ type: 'CLEAR_ERROR' }), 4000);
    });

    return () => socket.removeAllListeners();
  }, [socket]);

  const emit = useCallback((event, data) => {
    socket.emit(event, data);
  }, [socket]);

  const screen = () => {
    switch (state.phase) {
      case 'lobby':   return <LobbyScreen />;
      // case 'prompt':  return <PromptScreen />;
      // case 'draw':    return <DrawScreen />;
      // case 'guess':   return <GuessScreen />;
      // case 'summary': return <SummaryScreen />;
      // case 'end':     return <EndScreen />;
      default:        return <WelcomeScreen />;
    }
  };

  return (
    <SocketContext.Provider value={socket}>
      <GameContext.Provider value={{ state, emit, dispatch }}>
        {screen()}
      </GameContext.Provider>
    </SocketContext.Provider>
  );
}
