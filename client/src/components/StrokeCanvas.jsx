import { useEffect, useRef } from 'react';
import { replayStrokes } from '../lib/utils';

export default function StrokeCanvas({ strokes = [], style }) {
  const canvasRef = useRef(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    const dpr = window.devicePixelRatio || 1;
    // Resizing canvas.width/height clears the buffer and resets the transform,
    // so we re-apply the DPR scale before replaying strokes.
    canvas.width = 800 * dpr;
    canvas.height = 500 * dpr;
    const ctx = canvas.getContext('2d');
    ctx.scale(dpr, dpr);
    replayStrokes(ctx, strokes);
  }, [strokes]);

  return (
    <canvas
      ref={canvasRef}
      style={{
        border: '2px solid var(--ink)',
        borderRadius: 8,
        background: '#fff',
        width: '100%',
        aspectRatio: '800 / 500',
        display: 'block',
        ...style,
      }}
    />
  );
}
