import { createContext, useCallback, useContext, useEffect, useReducer } from 'react';
import { io } from 'socket.io-client';
import WelcomeScreen from './screens/WelcomeScreen';
import LobbyScreen from './screens/LobbyScreen';
import DrawScreen from './screens/DrawScreen';
import GuessScreen from './screens/GuessScreen';
import SummaryScreen from './screens/SummaryScreen';
import EndScreen from './screens/EndScreen';

const socket = io('http://localhost:3000');

const GameContext = createContext(null);
const SocketContext = createContext(null);

export const useGame = () => useContext(GameContext);
export const useSocket = () => useContext(SocketContext);

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
    case 'HYDRATE_ROOM':
      return {
        ...state,
        roomCode: action.data.roomId,
        phase: action.data.phase,
        error: null,
        players: action.data.participants.map(p => ({
          id: p.userId, name: p.nickname, team: p.teamId, ready: p.isReady, isHost: p.isHost
        }))
      };
    case 'ROOM_CREATED':
      return {
        ...state,
        phase: 'LOBBY',
        roomCode: action.roomId,
        myId: action.myId,
        error: null,
        players: [{ 
          id: action.host.userId, 
          name: action.host.nickname, 
          team: action.host.teamId, 
          ready: action.host.isReady, 
          isHost: action.host.isHost 
        }]
      };
    case 'SET_MY_ID':
      return { ...state, myId: action.myId };
    case 'ROOM_JOINED': {
      const exists = state.players.find(p => p.id === action.user.userId);
      if (exists) return state;
      return {
        ...state,
        players: [...state.players, {
          id: action.user.userId, name: action.user.nickname, team: action.user.teamId, ready: action.user.isReady, isHost: action.user.isHost
        }]
      };
    }
    case 'ROOM_UPDATED':
      return {
        ...state,
        players: state.players.map(p => p.id === action.user.userId ? {
          ...p, team: action.user.teamId, ready: action.user.isReady, isHost: action.user.isHost
        } : p)
      };
    case 'ROOM_LEFT':
      return { ...state, players: state.players.filter(p => p.id !== action.userId) };
    case 'GAME_PHASE':
      if (action.phase === 'LOBBY') {
        return { 
          ...state, 
          phase: action.phase, 
          players: state.players.map(p => ({ ...p, ready: false })), 
          prompt: null, 
          opponentStrokes: [], 
          guesses: [], 
          summaryData: null, 
          timer: null, 
          messages: [], 
          error: null };
      }
      return { ...state, phase: action.phase };
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

export default function App() {
  const [state, dispatch] = useReducer(reducer, initialState);

  useEffect(() => {
    socket.on('error', ({ message }) => {
      dispatch({ type: 'ERROR', message });
      setTimeout(() => dispatch({ type: 'CLEAR_ERROR' }), 4000);
    });

    socket.on('room:created', ({ roomId, roomHostId, host }) => {
      dispatch({ type: 'ROOM_CREATED', roomId, myId: socket.id, host});
    });

    socket.on('room:joined', (user) => {
      dispatch({ type: 'ROOM_JOINED', user });
    });

    socket.on('room:updated', (user) => {
      dispatch({ type: 'ROOM_UPDATED', user });
    });

    socket.on('room:host_changed', (user) => {
      dispatch({ type: 'ROOM_UPDATED', user });
    });

    socket.on('room:left', (userId) => {
      dispatch({ type: 'ROOM_LEFT', userId });
      dispatch({ type: 'MESSAGE', msg: { scope: 'system', msg: `A player left the room` } });
    });

    socket.on('game:phase', (phase) => {
      dispatch({ type: 'GAME_PHASE', phase });
    });

    socket.on('game:prompts', (prompt) => {
      dispatch({ type: 'PROMPT_REVEAL', prompt });
    });

    socket.on('game:countdown', (phase, duration) => {
      if (duration !== 'START' && duration !== 'END') {
        dispatch({ type: 'PHASE_TIMER', secondsLeft: duration });
      }
    });

    socket.on('game:draw:new', (stroke) => {
      // Backend doesn't differentiate self strokes in broadcast, so we rely on socket channel isolation
      // FE DrawScreen will handle it
    });

    socket.on('game:swap_drawing', (strokes) => {
      dispatch({ type: 'OPPONENT_DRAWING', strokes });
    });

    socket.on('game:guess:new', (guessObj) => {
      dispatch({ 
        type: 'GUESS_RESULT', 
        guess: { 
          who: guessObj.nickname, 
          msg: guessObj.guess, 
          match: guessObj.matching >= 0.5 } });
    });

    socket.on('game:summary', (prompts, strokes, guesses) => {
      dispatch({ type: 'SUMMARY_DATA', data: { prompts, strokes, guesses } });
    });

    socket.on('message-lobby:new', (msg) => {
      dispatch({ 
        type: 'MESSAGE', 
        msg: { scope: 'global', who: msg.nickname, msg: msg.content } 
      });
    });

    socket.on('message-team:new', (msg) => {
      dispatch({ 
        type: 'MESSAGE', 
        msg: { scope: 'team', who: msg.nickname, msg: msg.content } 
      });
    });

    socket.on('room:replay', () => {
      dispatch({ type: 'GAME_PHASE', phase: 'LOBBY' });
    });

    socket.on('room:ended', () => {
      dispatch({ type: 'ROOM_ENDED' });
    });

    return () => socket.removeAllListeners();
  }, []);

  const emit = useCallback((event, ...args) => {
    socket.emit(event, ...args);
  }, []);

  const screen = () => {
    switch (state.phase) {
      case 'LOBBY':   return <LobbyScreen />;
      case 'DRAW':    return <DrawScreen />;
      case 'GUESS':   return <GuessScreen />;
      case 'SUMMARY': return <SummaryScreen />;
      case 'END':     return <EndScreen />;
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