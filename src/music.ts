let audioCtx: AudioContext | null = null;
let isPlaying = false;
let masterGain: GainNode | null = null;
let schedulerInterval: number | null = null;
let nextNoteTime = 0;
let currentChordIndex = 0;
let currentVolume = 0.6;

const chordProgressions = [
  [261.63, 329.63, 392.00],
  [349.23, 440.00, 523.25],
  [392.00, 493.88, 587.33],
  [220.00, 261.63, 329.63],
  [293.66, 369.99, 440.00],
  [329.63, 415.30, 493.88],
];

function getAudioContext(): AudioContext {
  if (!audioCtx) {
    audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
  }
  if (audioCtx.state === 'suspended') {
    audioCtx.resume();
  }
  return audioCtx;
}

function playChord(chord: number[], startTime: number, duration: number) {
  if (!audioCtx || !masterGain) return;

  chord.forEach((freq, index) => {
    const osc = audioCtx!.createOscillator();
    const gain = audioCtx!.createGain();
    
    osc.type = 'sine';
    osc.frequency.setValueAtTime(freq, startTime);
    
    const vibrato = audioCtx!.createOscillator();
    const vibratoGain = audioCtx!.createGain();
    vibrato.frequency.setValueAtTime(0.5 + index * 0.1, startTime);
    vibratoGain.gain.setValueAtTime(2, startTime);
    vibrato.connect(vibratoGain);
    vibratoGain.connect(osc.frequency);
    
    gain.gain.setValueAtTime(0, startTime);
    gain.gain.linearRampToValueAtTime(0.04, startTime + 0.8);
    gain.gain.setValueAtTime(0.04, startTime + duration - 1.2);
    gain.gain.linearRampToValueAtTime(0, startTime + duration);
    
    osc.connect(gain);
    gain.connect(masterGain!);
    
    osc.start(startTime);
    osc.stop(startTime + duration);
    vibrato.start(startTime);
    vibrato.stop(startTime + duration);
  });
}

function scheduleNotes() {
  if (!audioCtx || !isPlaying) return;

  const currentTime = audioCtx.currentTime;
  const chordDuration = 4.0;

  while (nextNoteTime < currentTime + 2) {
    const chord = chordProgressions[currentChordIndex % chordProgressions.length];
    playChord(chord, nextNoteTime, chordDuration);
    
    nextNoteTime += chordDuration;
    currentChordIndex++;
  }
}

export function startMusic() {
  if (isPlaying) return;
  
  try {
    const ctx = getAudioContext();
    isPlaying = true;
    
    masterGain = ctx.createGain();
    masterGain.gain.setValueAtTime(currentVolume, ctx.currentTime);
    masterGain.connect(ctx.destination);
    
    nextNoteTime = ctx.currentTime;
    currentChordIndex = 0;
    
    scheduleNotes();
    schedulerInterval = window.setInterval(scheduleNotes, 500);
  } catch (e) {}
}

export function stopMusic() {
  isPlaying = false;
  
  if (schedulerInterval !== null) {
    clearInterval(schedulerInterval);
    schedulerInterval = null;
  }
  
  if (masterGain && audioCtx) {
    masterGain.gain.linearRampToValueAtTime(0, audioCtx.currentTime + 0.5);
    setTimeout(() => {
      if (masterGain) {
        masterGain.disconnect();
        masterGain = null;
      }
    }, 600);
  }
}

export function toggleMusic(): boolean {
  if (isPlaying) {
    stopMusic();
    return false;
  } else {
    startMusic();
    return true;
  }
}

export function isMusicPlaying(): boolean {
  return isPlaying;
}

export function setVolume(volume: number) {
  currentVolume = Math.max(0, Math.min(1, volume));
  if (masterGain && audioCtx) {
    masterGain.gain.linearRampToValueAtTime(currentVolume, audioCtx.currentTime + 0.1);
  }
}
