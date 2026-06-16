import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { SoundContext, useSound } from './soundContext';

const STORAGE_KEY = 'inkogether:sound-muted';
const BACKGROUND_MUSIC_VOLUME = 0.1;
const BACKGROUND_MUSIC_URL = '/audio/background_music.mp3';

const clamp = (value, min, max) => Math.min(Math.max(value, min), max);

function createSynth() {
  let audioContext = null;
  let masterGain = null;

  const getContext = () => {
    if (!audioContext) {
      const AudioContext = window.AudioContext || window.webkitAudioContext;
      if (!AudioContext) return null;

      audioContext = new AudioContext();
      masterGain = audioContext.createGain();
      masterGain.gain.value = 0.8;
      masterGain.connect(audioContext.destination);
    }

    return audioContext;
  };

  const unlock = async () => {
    const ctx = getContext();
    if (!ctx) return false;
    if (ctx.state === 'suspended') {
      await ctx.resume();
    }
    return ctx.state === 'running';
  };

  const tone = ({ frequency, duration = 0.12, type = 'sine', volume = 0.5, start = 0 }) => {
    const ctx = getContext();
    if (!ctx || !masterGain || ctx.state !== 'running') return;

    const now = ctx.currentTime + start;
    const oscillator = ctx.createOscillator();
    const gain = ctx.createGain();

    oscillator.type = type;
    oscillator.frequency.setValueAtTime(frequency, now);
    gain.gain.setValueAtTime(0.0001, now);
    gain.gain.exponentialRampToValueAtTime(clamp(volume, 0.001, 1), now + 0.012);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + duration);

    oscillator.connect(gain);
    gain.connect(masterGain);
    oscillator.start(now);
    oscillator.stop(now + duration + 0.03);
  };

  const slide = ({ from, to, duration = 0.16, type = 'triangle', volume = 0.45 }) => {
    const ctx = getContext();
    if (!ctx || !masterGain || ctx.state !== 'running') return;

    const now = ctx.currentTime;
    const oscillator = ctx.createOscillator();
    const gain = ctx.createGain();

    oscillator.type = type;
    oscillator.frequency.setValueAtTime(from, now);
    oscillator.frequency.exponentialRampToValueAtTime(to, now + duration);
    gain.gain.setValueAtTime(0.0001, now);
    gain.gain.exponentialRampToValueAtTime(clamp(volume, 0.001, 1), now + 0.01);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + duration);

    oscillator.connect(gain);
    gain.connect(masterGain);
    oscillator.start(now);
    oscillator.stop(now + duration + 0.03);
  };

  const noise = ({ duration = 0.08, volume = 0.25, lowpass = 900 }) => {
    const ctx = getContext();
    if (!ctx || !masterGain || ctx.state !== 'running') return;

    const sampleCount = Math.floor(ctx.sampleRate * duration);
    const buffer = ctx.createBuffer(1, sampleCount, ctx.sampleRate);
    const data = buffer.getChannelData(0);

    for (let i = 0; i < sampleCount; i++) {
      data[i] = (Math.random() * 2 - 1) * (1 - i / sampleCount);
    }

    const source = ctx.createBufferSource();
    const filter = ctx.createBiquadFilter();
    const gain = ctx.createGain();
    const now = ctx.currentTime;

    filter.type = 'lowpass';
    filter.frequency.value = lowpass;
    gain.gain.setValueAtTime(volume, now);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + duration);

    source.buffer = buffer;
    source.connect(filter);
    filter.connect(gain);
    gain.connect(masterGain);
    source.start(now);
  };

  const play = (name) => {
    switch (name) {
      case 'click':
        tone({ frequency: 560, duration: 0.045, type: 'square', volume: 0.16 });
        break;
      case 'join':
        tone({ frequency: 440, duration: 0.07, type: 'triangle', volume: 0.28 });
        tone({ frequency: 660, duration: 0.09, type: 'triangle', volume: 0.22, start: 0.055 });
        break;
      case 'leave':
        slide({ from: 300, to: 160, duration: 0.16, type: 'sine', volume: 0.22 });
        break;
      case 'chat':
        tone({ frequency: 720, duration: 0.045, type: 'sine', volume: 0.2 });
        break;
      case 'draw':
        noise({ duration: 0.035, volume: 0.08, lowpass: 550 });
        break;
      case 'phase':
        tone({ frequency: 330, duration: 0.08, type: 'triangle', volume: 0.25 });
        tone({ frequency: 495, duration: 0.08, type: 'triangle', volume: 0.22, start: 0.075 });
        tone({ frequency: 660, duration: 0.11, type: 'triangle', volume: 0.2, start: 0.15 });
        break;
      case 'prompt':
        slide({ from: 520, to: 880, duration: 0.15, type: 'triangle', volume: 0.26 });
        break;
      case 'guess':
        tone({ frequency: 520, duration: 0.055, type: 'square', volume: 0.18 });
        tone({ frequency: 390, duration: 0.055, type: 'square', volume: 0.14, start: 0.055 });
        break;
      case 'correct':
        tone({ frequency: 523.25, duration: 0.08, type: 'triangle', volume: 0.26 });
        tone({ frequency: 659.25, duration: 0.08, type: 'triangle', volume: 0.24, start: 0.08 });
        tone({ frequency: 783.99, duration: 0.16, type: 'triangle', volume: 0.22, start: 0.16 });
        break;
      case 'tick':
        tone({ frequency: 880, duration: 0.04, type: 'square', volume: 0.4 });
        break;
      case 'urgent':
        tone({ frequency: 1046.5, duration: 0.05, type: 'square', volume: 0.2 });
        break;
      case 'end':
        tone({ frequency: 660, duration: 0.1, type: 'triangle', volume: 0.25 });
        tone({ frequency: 440, duration: 0.18, type: 'triangle', volume: 0.22, start: 0.11 });
        break;
      default:
        break;
    }
  };

  return { unlock, play };
}

export function SoundProvider({ children }) {
  const synth = useMemo(() => createSynth(), []);
  const backgroundMusicRef = useRef(null);
  const backgroundMusicAvailableRef = useRef(null);
  const [muted, setMuted] = useState(false);
  const [unlocked, setUnlocked] = useState(false);
  const [backgroundMusicEnabled, setBackgroundMusicEnabled] = useState(false);

  const unlock = useCallback(async () => {
    const ready = await synth.unlock();
    if (ready) setUnlocked(true);
  }, [synth]);

  useEffect(() => {
    const handleFirstGesture = () => {
      unlock();
    };

    window.addEventListener('pointerdown', handleFirstGesture, { once: true });
    window.addEventListener('keydown', handleFirstGesture, { once: true });
    return () => {
      window.removeEventListener('pointerdown', handleFirstGesture);
      window.removeEventListener('keydown', handleFirstGesture);
    };
  }, [unlock]);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, String(muted));
  }, [muted]);

  useEffect(() => {
    return () => {
      const backgroundMusic = backgroundMusicRef.current;
      if (!backgroundMusic) return;

      backgroundMusic.pause();
      backgroundMusicRef.current = null;
    };
  }, []);

  useEffect(() => {
    const backgroundMusic = backgroundMusicRef.current;
    if (!backgroundMusic) return;

    backgroundMusic.volume = clamp(BACKGROUND_MUSIC_VOLUME, 0, 1);
  });

  useEffect(() => {
    let cancelled = false;

    const playBackgroundMusic = async () => {
      if (backgroundMusicAvailableRef.current === false) return;

      if (backgroundMusicAvailableRef.current === null) {
        try {
          const response = await fetch(BACKGROUND_MUSIC_URL, { method: 'HEAD' });
          backgroundMusicAvailableRef.current = response.ok;
        } catch {
          backgroundMusicAvailableRef.current = false;
        }
      }

      if (cancelled || backgroundMusicAvailableRef.current === false) return;

      if (!backgroundMusicRef.current) {
        const backgroundMusic = new Audio(BACKGROUND_MUSIC_URL);
        backgroundMusic.loop = true;
        backgroundMusic.preload = 'auto';
        backgroundMusicRef.current = backgroundMusic;
      }

      const backgroundMusic = backgroundMusicRef.current;
      backgroundMusic.volume = clamp(BACKGROUND_MUSIC_VOLUME, 0, 1);
      backgroundMusic.play().catch(() => {
        backgroundMusic.pause();
      });
    };

    if (!backgroundMusicEnabled || !unlocked || muted) {
      backgroundMusicRef.current?.pause();
      return;
    }

    playBackgroundMusic();
    return () => {
      cancelled = true;
    };
  }, [backgroundMusicEnabled, muted, unlocked]);

  const play = useCallback((name) => {
    if (muted) return;
    unlock();
    synth.play(name);
  }, [muted, synth, unlock]);

  const toggleMuted = useCallback(() => {
    setMuted((value) => !value);
    unlock();
  }, [unlock]);

  const value = useMemo(
    () => ({ muted, unlocked, play, toggleMuted, setBackgroundMusicEnabled }),
    [muted, unlocked, play, toggleMuted]
  );

  return (
    <SoundContext.Provider value={value}>
      {children}
    </SoundContext.Provider>
  );
}

export function GameSoundEffects({ state }) {
  const sound = useSound();
  const previous = useRef(null);

  useEffect(() => {
    sound?.setBackgroundMusicEnabled(Boolean(state.roomCode));
  }, [sound, state.roomCode]);

  useEffect(() => {
    if (!sound) return;

    const last = previous.current;
    if (!last) {
      previous.current = {
        phase: state.phase,
        prompt: state.prompt,
        timer: state.timer,
        guessCount: state.guesses.length,
        messageCount: state.messages.length,
        players: state.players,
      };
      return;
    }

    if (state.phase !== last.phase) {
      sound.play(state.phase === 'END' ? 'end' : 'phase');
    }

    if (state.prompt && state.prompt !== last.prompt) {
      sound.play('prompt');
    }

    if (state.guesses.length > last.guessCount) {
      const latestGuess = state.guesses[state.guesses.length - 1];
      sound.play(latestGuess?.highAccuracy ? 'correct' : 'guess');
    }

    if (state.messages.length > last.messageCount) {
      const latestMessage = state.messages[state.messages.length - 1];
      sound.play(latestMessage?.scope === 'system' ? 'leave' : 'chat');
    }

    if (state.players.length > last.players.length) {
      sound.play('join');
    } else if (state.players.length < last.players.length) {
      sound.play('leave');
    }

    const timerMovedDown = typeof state.timer === 'number'
      && typeof last.timer === 'number'
      && state.timer < last.timer;

    if (timerMovedDown && state.timer <= 10 && state.timer > 0) {
      sound.play(state.timer <= 3 ? 'urgent' : 'tick');
    }

    previous.current = {
      phase: state.phase,
      prompt: state.prompt,
      timer: state.timer,
      guessCount: state.guesses.length,
      messageCount: state.messages.length,
      players: state.players,
    };
  }, [sound, state]);

  return null;
}
