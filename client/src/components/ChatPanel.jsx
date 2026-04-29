import { useEffect, useRef, useState } from 'react';
import { Send } from './Icons';

export default function ChatPanel({ title = 'Chat', messages, onSend }) {
  const [text, setText] = useState('');
  const bodyRef = useRef(null);

  useEffect(() => {
    if (bodyRef.current) {
      bodyRef.current.scrollTop = bodyRef.current.scrollHeight;
    }
  }, [messages]);

  const submit = (e) => {
    e.preventDefault();
    const trimmed = text.trim();
    if (!trimmed) return;
    onSend(trimmed);
    setText('');
  };

  return (
    <div className="chat">
      <div className="chat-head">{title}</div>
      <div className="chat-body" ref={bodyRef}>
        {messages.length === 0 && (
          <span className="muted" style={{ fontSize: 12 }}>No messages yet…</span>
        )}
        {messages.map((m, i) => (
          <div key={i} className={`chat-msg${m.scope === 'system' ? ' system' : ''}`}>
            {m.scope !== 'system' && (
              <span className="who" style={{ color: m.teamColor || 'inherit' }}>
                {m.who}
              </span>
            )}
            {m.msg}
          </div>
        ))}
      </div>
      <form className="chat-input" onSubmit={submit}>
        <input
          value={text}
          onChange={e => setText(e.target.value)}
          placeholder="Say something…"
          maxLength={200}
        />
        <button type="submit"><Send size={15} /></button>
      </form>
    </div>
  );
}
