import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { useGame, useSocket } from '../lib/gameContext';
import { useSound } from '../lib/soundContext';
import TopBar from '../components/TopBar';
import ChatPanel from '../components/ChatPanel';
import { colorFor, initials, replayStrokes, TEAMS } from '../lib/utils';
import { Brush, Eraser } from '../components/Icons';

const COLORS = ['#1c1a17', '#e05b3c', '#3b82f6', '#22c55e', '#f59e0b', '#9b59b6'];
const SIZES = [3, 8, 16];

export default function DrawScreen() {
  const { state, emit } = useGame();
  const socket = useSocket();
  const sound = useSound();
  const { roomCode, players, myId, timer, prompt, messages } = state;

  const myPlayer = players.find(p => p.id === myId);
  const myTeam = myPlayer?.team;
  const cfg = myTeam ? TEAMS[myTeam] : null;
  const teammates = players.filter(p => p.team === myTeam);

  const canvasRef = useRef(null);
  const isDrawing = useRef(false);
  const lastPos = useRef(null);
  const lastDrawSound = useRef(0);

  // crdt states
  const localStrokes = useRef([]);
  const localClock = useRef(0);

  const [tool, setTool] = useState('brush');
  const [color, setColor] = useState(COLORS[0]);
  const [size, setSize] = useState(SIZES[0]);
  const [cursor, setCursor] = useState(null);


  useLayoutEffect(() => {
    const canvas = canvasRef.current;
    const dpr = window.devicePixelRatio || 1;
    canvas.width = 800 * dpr;
    canvas.height = 500 * dpr;
    canvas.getContext('2d').scale(dpr, dpr);
  }, []);

  // CRDT process and redraw 
  const processAndRedrawStrokes = () => {
    // sort by Lamport timestamp then by Client ID for ties
    //  V8's Timsort is heavily optimized for nearly-sorted arrays making this O(N) practically
    localStrokes.current.sort((a, b) => {
      if (a.timestamp !== b.timestamp) return a.timestamp - b.timestamp;
      return a.clientId.localeCompare(b.clientId);
    });

    const ctx = canvasRef.current.getContext('2d');
    replayStrokes(ctx, localStrokes.current);
  };

  useEffect(() => {
    const onStroke = (incomingStroke) => {
      if (incomingStroke.clientId === myId) return;

      // Lamport clocks: max(local, incoming)
      localClock.current = Math.max(localClock.current, incomingStroke.timestamp);

      localStrokes.current.push(incomingStroke);
      processAndRedrawStrokes();
    };

    socket.on('game:draw:new', onStroke);
    return () => socket.off('game:draw:new', onStroke);
  }, [socket, myId]);

  const getPos = (e) => {
    const rect = canvasRef.current.getBoundingClientRect();
    return {
      x: (e.clientX - rect.left) * (800 / rect.width),
      y: (e.clientY - rect.top)  * (500 / rect.height),
    };
  };


  const handleLocalStroke = (pos) => {
    // lamport Clocks: increment local clock before send
    localClock.current += 1;

    const stroke = {
      // unique ID for idempotency  
      id: `${myId}-${localClock.current}`,
      clientId: myId,
      timestamp: localClock.current,
      x0: lastPos.current.x, 
      y0: lastPos.current.y,
      x1: pos.x, 
      y1: pos.y,
      color: tool === 'eraser' ? null : color,
      size: tool === 'eraser' ? 30 : size,
      tool,
    };

    localStrokes.current.push(stroke);
    processAndRedrawStrokes();

    emit('game:draw:send', stroke);
    playDrawSound();
    lastPos.current = pos;
  };

  const handleMouseDown = (e) => {
    if (e.button !== 0) return;
    isDrawing.current = true;
    lastPos.current = getPos(e);
    sound?.play('click');
  };

  const handleMouseMove = (e) => {
    const rect = canvasRef.current.getBoundingClientRect();
    setCursor({ x: e.clientX - rect.left, y: e.clientY - rect.top, scale: rect.width / 800 });
    
    if (!isDrawing.current || !lastPos.current) return;
    handleLocalStroke(getPos(e));
  };

  const stopDrawing = () => {
    isDrawing.current = false;
    lastPos.current = null;
  };

  const handleMouseLeave = () => {
    stopDrawing();
    setCursor(null);
  };

  const handleMouseEnter = (e) => {
    const rect = canvasRef.current.getBoundingClientRect();
    setCursor({ x: e.clientX - rect.left, y: e.clientY - rect.top, scale: rect.width / 800 });
  };

  // Touch support
  const handleTouchStart = (e) => {
    e.preventDefault();
    const touch = e.touches[0];
    isDrawing.current = true;
    lastPos.current = getTouchPos(touch);
    sound?.play('click');
  };

  const handleTouchMove = (e) => {
    e.preventDefault();
    if (!isDrawing.current || !lastPos.current) return;
    handleLocalStroke(getTouchPos(e.touches[0]));
  };

  const getTouchPos = (touch) => {
    const rect = canvasRef.current.getBoundingClientRect();
    return {
      x: (touch.clientX - rect.left) * (800 / rect.width),
      y: (touch.clientY - rect.top)  * (500 / rect.height),
    };
  };

  const playDrawSound = () => {
    const now = performance.now();
    if (now - lastDrawSound.current < 90) return;
    lastDrawSound.current = now;
    sound?.play('draw');
  };

  const teamMessages = messages.filter(m => m.scope === 'team' || m.scope === 'global');

  const cursorPx = cursor
    ? Math.max((tool === 'eraser' ? 30 : size) * cursor.scale, 6)
    : 6;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100vh' }}>
      <TopBar roomCode={roomCode} players={players} myId={myId} />

      <div style={{ flex: 1, display: 'flex', overflow: 'hidden' }}>
        {/* ── Tool bar ── */}
        <div style={{ padding: 12, display: 'flex', alignItems: 'flex-start' }}>
          <div className="tool-bar">
            <button
              className={`tool-btn${tool === 'brush' ? ' active' : ''}`}
              onClick={() => setTool('brush')}
              title="Brush"
            >
              <Brush size={18} />
            </button>
            <button
              className={`tool-btn${tool === 'eraser' ? ' active' : ''}`}
              onClick={() => setTool('eraser')}
              title="Eraser"
            >
              <Eraser size={18} />
            </button>

            <div className="tool-divider" />

            {SIZES.map(s => (
              <button
                key={s}
                className={`tool-btn${tool === 'brush' && size === s ? ' active' : ''}`}
                onClick={() => { setTool('brush'); setSize(s); }}
                title={`Size ${s}`}
              >
                <div style={{
                  width: Math.max(4, s * 0.8),
                  height: Math.max(4, s * 0.8),
                  borderRadius: '50%',
                  background: 'var(--ink)',
                }} />
              </button>
            ))}

            <div className="tool-divider" />

            {COLORS.map(c => (
              <div
                key={c}
                className={`swatch${color === c && tool === 'brush' ? ' active' : ''}`}
                style={{ background: c }}
                onClick={() => { setColor(c); setTool('brush'); }}
              />
            ))}
          </div>
        </div>

        {/* ── Canvas area ── */}
        <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', overflow: 'hidden', padding: '12px 8px 12px 0' }}>
          {/* Presence row */}
          <div className="presence-row" style={{ padding: '0 0 8px 0' }}>
            <span className="muted" style={{ fontSize: 12 }}>Drawing with:</span>
            {teammates.map(p => (
              <div key={p.id} title={p.name} style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                <div className="avatar avatar-sm" style={{ background: colorFor(p.name) }}>
                  {initials(p.name)}
                </div>
                {p.id === myId && (
                  <span style={{ fontSize: 11, fontWeight: 600 }}>you</span>
                )}
              </div>
            ))}
            <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 8 }}>
              {cfg && (
                <span className="sticker" style={{ borderColor: cfg.accent, background: cfg.accent }}>
                  {cfg.emoji} {cfg.name}
                </span>
              )}
              <div className={`timer-pill${timer !== null && timer <= 10 ? ' urgent' : ''}`}>
                {timer !== null ? `${timer}s` : '–'}
              </div>
            </div>
          </div>

          {/* Canvas */}
          <div style={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
            <div style={{ position: 'relative', flex: 1, minHeight: 0 }}>
              <canvas
                ref={canvasRef}
                style={{
                  border: '2px solid var(--ink)',
                  background: '#fff',
                  cursor: 'none',
                  width: '100%',
                  maxHeight: '100%',
                  aspectRatio: '800 / 500',
                  display: 'block',
                  touchAction: 'none',
                }}
                onMouseDown={handleMouseDown}
                onMouseMove={handleMouseMove}
                onMouseUp={stopDrawing}
                onMouseLeave={handleMouseLeave}
                onMouseEnter={handleMouseEnter}
                onTouchStart={handleTouchStart}
                onTouchMove={handleTouchMove}
                onTouchEnd={stopDrawing}
              />
              {cursor && (
                <div
                  style={{
                    position: 'absolute',
                    left: cursor.x,
                    top: cursor.y,
                    pointerEvents: 'none',
                    transform: 'translate(-50%, -50%)',
                    width: cursorPx,
                    height: cursorPx,
                    borderRadius: tool === 'eraser' ? 2 : '50%',
                    border: tool === 'eraser'
                      ? '1.5px dashed var(--ink)'
                      : `2px solid ${color}`,
                    boxShadow: '0 0 0 1px #fff, 0 0 0 2.5px #1c1a17',
                    background: tool === 'eraser' ? 'transparent' : `${color}30`,
                  }}
                />
              )}
            </div>
            <div className="prompt-bar">
              Draw: <em>{prompt || '…'}</em>
            </div>
          </div>
        </div>

        {/* ── Chat panel ── */}
        <div style={{ width: 240, padding: 12, flexShrink: 0 }}>
          <ChatPanel
            title={`${cfg?.name || 'Team'} chat`}
            messages={teamMessages}
            onSend={(text) => emit('message-team:send', { content: text })}
          />
        </div>
      </div>
    </div>
  );
}
