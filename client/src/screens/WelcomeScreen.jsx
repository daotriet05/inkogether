import { useState } from 'react';
import { useGame } from '../App';
import { ArrowRight, Plus } from '../components/Icons';

export default function WelcomeScreen() {
  const { emit, state, dispatch, connectToSocketUrl } = useGame();
  const [mode, setMode] = useState(null);
  const [name, setName] = useState('');
  const [code, setCode] = useState('');

  const create = (e) => {
    e.preventDefault();
    emit('room:create', { nickname: name.trim(), avatarId: 'fixed-avatar' });
  };

  const join = async (e) => {
    e.preventDefault();
    const roomCode = code.trim();
    
    try {
      const assignRes = await fetch(`http://localhost:3000/api/assign/${roomCode}`);
      if (!assignRes.ok) {
        dispatch({ type: 'ERROR', message: 'room not found or game in progress' });
        setTimeout(() => dispatch({ type: 'CLEAR_ERROR' }), 4000);
        return;
      }

      const assignment = await assignRes.json();
      const assignedSocket = await connectToSocketUrl(assignment.socketUrl);

      const res = await fetch(`${assignment.socketUrl}/api/room/${roomCode}`);
      if (!res.ok) {
        dispatch({ type: 'ERROR', message: 'room not found or game in progress' });
        setTimeout(() => dispatch({ type: 'CLEAR_ERROR' }), 4000);
        return;
      }

      const data = await res.json();
      dispatch({ type: 'HYDRATE_ROOM', data });
      dispatch({ type: 'SET_MY_ID', myId: assignedSocket.id });
      assignedSocket.emit('room:join', { nickname: name.trim(), avatarId: 'fixed-avatar' }, roomCode);
    } catch (err) {
      dispatch({ type: 'ERROR', message: 'failed to connect to server' });
      setTimeout(() => dispatch({ type: 'CLEAR_ERROR' }), 4000);
    }
  };

  return (
    <div className="screen screen-enter" style={{ gap: 28 }}>
      <div style={{ textAlign: 'center' }}>
        <h1 className="h-display" style={{ fontSize: 56 }}>inkogether</h1>
        <p className="muted" style={{ marginTop: 8 }}>Draw. Swap. Guess.</p>
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
              placeholder="e.g. ann"
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
                onChange={e => setCode(e.target.value)}
                placeholder="XXXXXXXX"
                maxLength={8}
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
              disabled={!name.trim() || (mode === 'join' && code.length < 8)}
            >
              {mode === 'create' ? 'Create' : 'Join'} <ArrowRight size={16} />
            </button>
          </div>
        </form>
      )}
    </div>
  );
}