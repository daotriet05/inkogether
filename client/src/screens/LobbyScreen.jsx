import { useGame } from '../App';
import TopBar from '../components/TopBar';
import ChatPanel from '../components/ChatPanel';
import { colorFor, initials, TEAMS } from '../lib/utils';
import { Crown, Check } from '../components/Icons';

function PlayerRow({ player }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '6px 0' }}>
      <div className="avatar" style={{ background: colorFor(player.name) }}>
        {initials(player.name)}
        {player.isHost && (
          <Crown size={10} style={{ position: 'absolute', top: -4, right: -4 }} />
        )}
      </div>
      <span style={{ flex: 1, fontWeight: 500 }}>{player.name}</span>
      {player.isHost && (
        <span className="sticker" style={{ fontSize: 11 }}>host</span>
      )}
      {player.ready && !player.isHost && (
        <Check size={15} style={{ color: 'var(--lime)' }} />
      )}
    </div>
  );
}

function TeamPanel({ team, players, myPlayer, onJoin }) {
  const cfg = TEAMS[team];
  const inTeam = myPlayer?.team === team;

  return (
    <div
      className="card"
      style={{
        flex: 1,
        minWidth: 220,
        borderColor: cfg.accent,
        boxShadow: `3px 3px 0 ${cfg.accent}`,
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 14 }}>
        <span style={{ fontSize: 24 }}>{cfg.emoji}</span>
        <span className="h-display" style={{ fontSize: 18 }}>{cfg.name}</span>
        <span className="muted" style={{ fontSize: 13, marginLeft: 'auto' }}>
          {players.length}/5
        </span>
      </div>

      <div style={{ minHeight: 80, display: 'flex', flexDirection: 'column', gap: 2 }}>
        {players.length === 0 && (
          <p className="muted" style={{ fontSize: 13 }}>Empty — join first!</p>
        )}
        {players.map(p => <PlayerRow key={p.id} player={p} />)}
      </div>

      {!inTeam && (
        <button
          className="btn btn-sm"
          style={{ marginTop: 14, width: '100%', borderColor: cfg.accent }}
          onClick={() => onJoin(team)}
          disabled={players.length >= 5}
        >
          Join {cfg.name}
        </button>
      )}
    </div>
  );
}

export default function LobbyScreen() {
  const { state, emit } = useGame();
  const { roomCode, players, myId, messages, error } = state;

  const myPlayer = players.find(p => p.id === myId);
  const isHost = myPlayer?.isHost ?? false;
  const teamA = players.filter(p => p.team === 'A');
  const teamB = players.filter(p => p.team === 'B');
  const withTeam = players.filter(p => p.team);
  const nonHostWithTeam = withTeam.filter(p => !p.isHost);
  const readyCount = nonHostWithTeam.filter(p => p.ready).length;
  const allReady = nonHostWithTeam.length === 0 || nonHostWithTeam.every(p => p.ready);
  const canStart = isHost && teamA.length > 0 && teamB.length > 0 && allReady;

  const globalMessages = messages.filter(m => m.scope === 'global' || m.scope === 'system');

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100vh' }}>
      <TopBar roomCode={roomCode} players={players} myId={myId} />

      <div style={{ flex: 1, display: 'flex', overflow: 'hidden' }}>
        {/* ── Main content ── */}
        <div
          style={{
            flex: 1,
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            padding: 32,
            gap: 24,
            overflow: 'auto',
          }}
        >
          <h2 className="h-display" style={{ fontSize: 28 }}>Pick your team</h2>

          <div style={{ display: 'flex', gap: 20, flexWrap: 'wrap', justifyContent: 'center' }}>
            <TeamPanel
              team="A"
              players={teamA}
              myPlayer={myPlayer}
              onJoin={(t) => emit('join_team', { team: t })}
            />
            <TeamPanel
              team="B"
              players={teamB}
              myPlayer={myPlayer}
              onJoin={(t) => emit('join_team', { team: t })}
            />
          </div>

          {nonHostWithTeam.length > 0 && (
            <p className="muted" style={{ fontSize: 13 }}>
              {readyCount}/{nonHostWithTeam.length} ready
            </p>
          )}

          {myPlayer?.team && !myPlayer.isHost && (
            <button
              className={`btn ${myPlayer.ready ? 'btn-primary' : ''}`}
              onClick={() => emit('player_ready', { ready: !myPlayer.ready })}
            >
              {myPlayer.ready ? '✓ Ready!' : 'Mark ready'}
            </button>
          )}

          {isHost && (
            <button
              className="btn btn-primary btn-lg"
              onClick={() => emit('start_game')}
              disabled={!canStart}
            >
              Start game
            </button>
          )}

          {isHost && !canStart && (
            <p className="muted" style={{ fontSize: 13, textAlign: 'center' }}>
              {teamA.length === 0 || teamB.length === 0
                ? 'Both teams need at least one player'
                : 'Waiting for all players to ready up'}
            </p>
          )}

          {error && <div className="error-banner">{error}</div>}
        </div>

        {/* ── Global chat ── */}
        <div style={{ width: 280, padding: 12, flexShrink: 0 }}>
          <ChatPanel
            title="Room chat"
            messages={globalMessages}
            onSend={(text) => emit('send_message', { text, scope: 'global' })}
          />
        </div>
      </div>
    </div>
  );
}
