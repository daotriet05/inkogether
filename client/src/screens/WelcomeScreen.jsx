import { useState } from 'react';
import { useGame } from '../App';
import { ArrowRight, Plus } from '../components/Icons';

export default function WelcomeScreen() {
  const { emit, state } = useGame();
  const [mode, setMode] = useState(null); // null | 'create' | 'join'
  const [name, setName] = useState('');
  const [code, setCode] = useState('');

  const create = (e) => {
    e.preventDefault();
    emit('create_room', { name: name.trim() });
  };

  const join = (e) => {
    e.preventDefault();
    emit('join_room', { code: code.trim().toUpperCase(), name: name.trim() });
  };

  return (
    <div className="screen screen-enter" style={{ gap: 28 }}>
      <div style={{ textAlign: 'center' }}>
        <h1 className="h-display" style={{ fontSize: 56 }}>inkogether</h1>
        <p className="muted" style={{ marginTop: 8 }}>
          Draw. Swap. Guess.
        </p>
      </div>

      {!mode && (
        <div style={{ display: 'flex', gap: 12 }}>
          <button className="btn btn-primary btn-lg" onClick={() => setMode('create')}>
            <Plus size={20} /> Create room
          </button>
          <button className="btn btn-lg" onClick={() => setMode('join')}>
            Join room
          </button>
        </div>
      )}

      {mode && (
        <form
          className="card"
          style={{ width: 340, display: 'flex', flexDirection: 'column', gap: 14 }}
          onSubmit={mode === 'create' ? create : join}
        >
          <h2 className="h-display" style={{ fontSize: 22 }}>
            {mode === 'create' ? 'Create a room' : 'Join a room'}
          </h2>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            <label style={{ fontSize: 13, fontWeight: 600 }}>Your name</label>
            <input
              className="input"
              value={name}
              onChange={e => setName(e.target.value)}
              placeholder="e.g. Alex"
              maxLength={24}
              autoFocus
            />
          </div>

          {mode === 'join' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              <label style={{ fontSize: 13, fontWeight: 600 }}>Room code</label>
              <input
                className="input mono"
                value={code}
                onChange={e => setCode(e.target.value.toUpperCase())}
                placeholder="XXXXXX"
                maxLength={6}
                style={{ letterSpacing: '0.15em' }}
              />
            </div>
          )}

          {state.error && (
            <div className="error-banner">{state.error}</div>
          )}

          <div style={{ display: 'flex', gap: 10, justifyContent: 'space-between', alignItems: 'center' }}>
            <button type="button" className="btn btn-sm" onClick={() => setMode(null)}>
              Back
            </button>
            <button
              type="submit"
              className="btn btn-primary"
              disabled={!name.trim() || (mode === 'join' && code.length < 6)}
            >
              {mode === 'create' ? 'Create' : 'Join'} <ArrowRight size={16} />
            </button>
          </div>
        </form>
      )}
    </div>
  );
}
