import { useState } from 'react';
import { useGame } from '../App';
import TopBar from '../components/TopBar';
import ChatPanel from '../components/ChatPanel';
import StrokeCanvas from '../components/StrokeCanvas';
import { TEAMS } from '../lib/utils';
import { Send, Check } from '../components/Icons';

export default function GuessScreen() {
  const { state, emit } = useGame();
  const { roomCode, players, myId, opponentStrokes, guesses, timer, messages } = state;

  const myPlayer = players.find(p => p.id === myId);
  const myTeam = myPlayer?.team;
  const oppTeam = myTeam === 'A' ? 'B' : 'A';
  const oppCfg = TEAMS[oppTeam];
  const myCfg = myTeam ? TEAMS[myTeam] : null;

  const [text, setText] = useState('');
  const hasMatch = guesses.some(g => g.match);

  const submit = (e) => {
    e.preventDefault();
    if (!text.trim()) return;
    emit('game:guess:send', text.trim());
    setText('');
  };

  const teamMessages = messages.filter(m => m.scope === 'team' || m.scope === 'global');

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100vh' }}>
      <TopBar roomCode={roomCode} players={players} myId={myId} />

      <div style={{ flex: 1, display: 'flex', overflow: 'hidden', padding: 16, gap: 16 }}>
        {/* ── Drawing + header ── */}
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 12, minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <span className="sticker" style={{ borderColor: oppCfg.accent, background: oppCfg.accent }}>
              {oppCfg.emoji} {oppCfg.name}'s drawing
            </span>
            <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 8 }}>
              {myCfg && (
                <span className="sticker" style={{ borderColor: myCfg.accent, background: myCfg.accent }}>
                  {myCfg.emoji} guessing
                </span>
              )}
              <div className={`timer-pill${timer !== null && timer <= 10 ? ' urgent' : ''}`}>
                {timer !== null ? `${timer}s` : '–'}
              </div>
            </div>
          </div>

          <StrokeCanvas strokes={opponentStrokes} />
        </div>

        {/* ── Guess panel ── */}
        <div style={{ width: 280, display: 'flex', flexDirection: 'column', gap: 12, flexShrink: 0 }}>
          <div className="card" style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 12, minHeight: 0 }}>
            <h3 className="h-display" style={{ fontSize: 17 }}>
              What are they drawing?
            </h3>

            <div
              style={{
                flex: 1,
                overflowY: 'auto',
                display: 'flex',
                flexDirection: 'column',
                gap: 6,
                minHeight: 0,
              }}
            >
              {guesses.length === 0 && (
                <p className="muted" style={{ fontSize: 13 }}>No guesses yet…</p>
              )}
              {guesses.map((g, i) => (
                <div
                  key={i}
                  className="guess-pop"
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 8,
                    padding: '6px 10px',
                    borderRadius: 8,
                    background: g.match ? 'var(--lime)' : '#f0ede8',
                    border: g.match ? 'var(--border)' : '2px solid transparent',
                    fontSize: 13,
                  }}
                >
                  {g.match && <Check size={14} />}
                  <span style={{ fontWeight: 600, marginRight: 2 }}>{g.who}:</span>
                  <span>{g.msg}</span>
                </div>
              ))}
            </div>

            {hasMatch ? (
              <div style={{ textAlign: 'center', padding: '10px 0', fontWeight: 700, color: 'var(--ink)' }}>
                ✓ Got it! Waiting for time to end…
              </div>
            ) : (
              <form onSubmit={submit} style={{ display: 'flex', gap: 8 }}>
                <input
                  className="input"
                  value={text}
                  onChange={e => setText(e.target.value)}
                  placeholder="Type your guess…"
                  maxLength={100}
                />
                <button type="submit" className="btn btn-sm btn-primary">
                  <Send size={14} />
                </button>
              </form>
            )}
          </div>

          {/* Team chat */}
          <div style={{ height: 200, flexShrink: 0 }}>
            <ChatPanel
              title="Team chat"
              messages={teamMessages}
              onSend={(t) => emit('message-team:send', { content: t })}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
