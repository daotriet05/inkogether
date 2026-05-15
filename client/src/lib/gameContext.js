import { createContext, useContext } from 'react';

export const GameContext = createContext(null);
export const SocketContext = createContext(null);

export const useGame = () => useContext(GameContext);
export const useSocket = () => useContext(SocketContext);
