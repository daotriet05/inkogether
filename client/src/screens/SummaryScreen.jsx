import { useEffect, useState } from 'react';
import { useGame } from '../App';
import TopBar from '../components/TopBar';
import ChatPanel from '../components/ChatPanel';
import StrokeCanvas from '../components/StrokeCanvas';
import { TEAMS } from '../lib/utils';
import { ArrowRight } from '../components/Icons';

function TeamResult({ teamKey, data, revealedCount }) {
  const cfg = TEAMS[teamKey];
  const guesses = data.guesses || [];

  return (
    <div
      className="card"
      style={{
        flex: 1,
        minWidth: 300,
        borderColor: cfg.accent,
        boxShadow: `3px 3px 0 ${cfg.accent}`,
        display: 'flex',
        flexDirection: 'column',
        gap: 14,
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <span style={{ fontSize: 22 }}>{cfg.emoji}</span>
        <span className="h-display" style={{ fontSize: 18 }}>{cfg.name}</span>
      </div>

      <div>
        <p className="muted" style={{ fontSize: 12, marginBottom: 4 }}>The prompt was</p>
        <p style={{ fontWeight: 700, fontSize: 16 }}>{data.prompt}</p>
      </div>

      <StrokeCanvas strokes={data.strokes || []} />

      <div>
        <p className="muted" style={{ fontSize: 12, marginBottom: 6 }}>
          Guesses from {TEAMS[teamKey === 'A' ? 'B' : 'A'].name}
        </p>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
          {guesses.slice(0, revealedCount).map((g, i) => (
            <div
              key={i}
              className="guess-pop"
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 8,
                padding: '5px 10px',
                borderRadius: 8,
                background: g.match ? 'var(--lime)' : '#f0ede8',
                border: g.match ? 'var(--border)' : '2px solid transparent',
                fontSize: 13,
              }}
            >
              <span style={{ fontWeight: 600 }}>{g.who}:</span>
              <span style={{ flex: 1 }}>{g.msg}</span>
              {g.match && <span>✓</span>}
            </div>
          ))}
          {revealedCount < guesses.length && (
            <div className="muted" style={{ fontSize: 12, padding: '4px 0' }}>…</div>
          )}
        </div>
      </div>
    </div>
  );
}

export default function SummaryScreen() {
  const { state, emit } = useGame();
  const { roomCode, players, myId, summaryData, messages } = state;

  const myPlayer = players.find(p => p.id === myId);
  const isHost = myPlayer?.isHost ?? false;

  const [revealedA, setRevealedA] = useState(0);
  const [revealedB, setRevealedB] = useState(0);
  const [done, setDone] = useState(false);

  const mapGuesses = (rawGuesses) => {
    if (!rawGuesses) return [];
    return rawGuesses.map(g => ({
      who: g.nickname || 'Unknown',
      msg: g.guess,
      match: g.matching >= 0.85,
    }));
  };

  const mappedTeamA = summaryData ? {
    prompt: summaryData.prompts?.A,
    strokes: summaryData.strokes?.A || [],
    guesses: mapGuesses(summaryData.guesses?.B)
  } : null;

  const mappedTeamB = summaryData ? {
    prompt: summaryData.prompts?.B,
    strokes: summaryData.strokes?.B || [],
    guesses: mapGuesses(summaryData.guesses?.A)
  } : null;

  // Use the mapped arrays to get the correct totals for the interval logic
  const totalA = mappedTeamA?.guesses?.length ?? 0;
  const totalB = mappedTeamB?.guesses?.length ?? 0;
  const total = totalA + totalB;

  useEffect(() => {
    if (!summaryData) return;
    let step = 0;
    const interval = setInterval(() => {
      step++;
      if (step <= totalA) {
        setRevealedA(step);
      } else if (step <= total) {
        setRevealedB(step - totalA);
      } else {
        clearInterval(interval);
        setDone(true);
      }
    }, 1000);
    return () => clearInterval(interval);
  }, [summaryData, total, totalA]);

  const globalMessages = messages.filter(m => m.scope === 'global' || m.scope === 'system');

  if (!summaryData) {
    return (
      <div className="screen">
        <p className="muted">Loading summary…</p>
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100vh' }}>
      <TopBar roomCode={roomCode} players={players} myId={myId} />

      <div style={{ flex: 1, display: 'flex', overflow: 'hidden' }}>
        {/* ── Scrollable summary content ── */}
        <div style={{ flex: 1, overflow: 'auto', padding: '24px 32px', display: 'flex', flexDirection: 'column', gap: 24 }}>
          <h2 className="h-display" style={{ fontSize: 28, textAlign: 'center' }}>
            Round summary
          </h2>

          <div style={{ display: 'flex', gap: 20, flexWrap: 'wrap', justifyContent: 'center' }}>
            <TeamResult teamKey="A" data={mappedTeamA} revealedCount={revealedA} />
            <TeamResult teamKey="B" data={mappedTeamB} revealedCount={revealedB} />
          </div>

          <div style={{ textAlign: 'center', paddingBottom: 24 }}>
            {isHost ? (
              <button
                className="btn btn-primary btn-lg"
                onClick={() => emit('game:end')}
                disabled={!done}
              >
                Continue <ArrowRight size={18} />
              </button>
            ) : (
              <p className="muted" style={{ fontSize: 14 }}>Waiting for host to continue…</p>
            )}
          </div>
        </div>

        {/* ── Global chat ── */}
        <div style={{ width: 280, padding: 12, flexShrink: 0 }}>
          <ChatPanel
            title="Room chat"
            messages={globalMessages}
            onSend={(text) => emit('message-lobby:send', { content: text })}
          />
        </div>
      </div>
    </div>
  );
}