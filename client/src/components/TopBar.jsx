import { useState } from 'react';
import { colorFor, initials } from '../lib/utils';
import { Crown, Copy } from './Icons';

export default function TopBar({ roomCode, players, myId }) {
  const [copied, setCopied] = useState(false);

  const copyCode = () => {
    navigator.clipboard.writeText(roomCode).catch(() => {});
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  return (
    <div className="topbar">
      <span className="brand">inkogether</span>

      <button className="room-pill" onClick={copyCode} title="Copy room code">
        {roomCode}
        <Copy size={13} />
      </button>

      {copied && <span style={{ fontSize: 12, opacity: 0.6 }}>Copied!</span>}

      <div className="presence-row" style={{ marginLeft: 'auto' }}>
        {players.map(p => (
          <div key={p.id} style={{ position: 'relative' }} title={p.name}>
            <div
              className="avatar avatar-sm"
              style={{ background: colorFor(p.name) }}
            >
              {initials(p.name)}
            </div>
            {p.isHost && (
              <Crown
                size={10}
                style={{ position: 'absolute', top: -5, right: -4, color: 'var(--ink)' }}
              />
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
