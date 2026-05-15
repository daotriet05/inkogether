import { useGame } from '../lib/gameContext';
import TopBar from '../components/TopBar';
import ChatPanel from '../components/ChatPanel';
import { Refresh, Door } from '../components/Icons';

export default function EndScreen() {
  const { state, emit } = useGame();
  const { roomCode, players, myId, messages } = state;

  const myPlayer = players.find(p => p.id === myId);
  const isHost = myPlayer?.isHost ?? false;

  const globalMessages = messages.filter(m => m.scope === 'global' || m.scope === 'system');

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100vh' }}>
      <TopBar roomCode={roomCode} players={players} myId={myId} />

      <div style={{ flex: 1, display: 'flex', overflow: 'hidden' }}>
        {/* ── Centered end content ── */}
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 28 }}>
          <h1 className="h-display" style={{ fontSize: 52 }}>Good game.</h1>

          {isHost ? (
            <div style={{ display: 'flex', gap: 14 }}>
              <button className="btn btn-primary btn-lg" onClick={() => emit('room:replay')}>
                <Refresh size={20} /> Play again
              </button>
              <button className="btn btn-lg" onClick={() => emit('room:end')}>
                <Door size={20} /> End room
              </button>
            </div>
          ) : (
            <p className="muted" style={{ fontSize: 15 }}>Waiting for host…</p>
          )}
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
