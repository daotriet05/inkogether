export const TEAMS = {
  A: { name: 'Team Coral', accent: 'var(--coral)', emoji: '🪼' },
  B: { name: 'Team Sky',   accent: 'var(--sky)',   emoji: '🌊' },
};

const PALETTE = ['var(--coral)', 'var(--sky)', 'var(--lime)', 'var(--butter)', '#b5a9f5'];

export function colorFor(name) {
  let h = 0;
  for (const c of name) h = (h * 31 + c.charCodeAt(0)) & 0xffff;
  return PALETTE[h % PALETTE.length];
}

export function initials(name) {
  return name.split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2);
}

export function drawStroke(ctx, stroke) {
  const { x0, y0, x1, y1, color, size, tool } = stroke;
  ctx.save();
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  if (tool === 'eraser') {
    ctx.globalCompositeOperation = 'destination-out';
    ctx.strokeStyle = 'rgba(0,0,0,1)';
  } else {
    ctx.globalCompositeOperation = 'source-over';
    ctx.strokeStyle = color || '#1c1a17';
  }
  ctx.lineWidth = size || 3;
  ctx.beginPath();
  ctx.moveTo(x0, y0);
  ctx.lineTo(x1, y1);
  ctx.stroke();
  ctx.restore();
}

export function replayStrokes(ctx, strokes) {
  ctx.clearRect(0, 0, 800, 500);
  for (const stroke of strokes) drawStroke(ctx, stroke);
}
