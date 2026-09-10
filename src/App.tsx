import { useState, useEffect, useCallback, useRef } from 'react';
import { Language, t } from './i18n';
import { playEatSound, playGameOverSound } from './sounds';
import { toggleMusic, isMusicPlaying, setVolume } from './music';
import ArcSlider from './ArcSlider';

type Direction = 'UP' | 'DOWN' | 'LEFT' | 'RIGHT';
type Position = { x: number; y: number };
type Difficulty = 'easy' | 'medium' | 'hard';
type GameState = 'idle' | 'playing' | 'paused' | 'gameover';
type FloatingText = { id: number; x: number; y: number };

const GRID_SIZE = 20;
const CELL_SIZE = 20;
const CANVAS_SIZE = GRID_SIZE * CELL_SIZE;

const SPEED_MAP: Record<Difficulty, number> = {
  easy: 150,
  medium: 100,
  hard: 60,
};

const DIFFICULTY_COLORS: Record<Difficulty, string> = {
  easy: 'from-green-400 to-emerald-500',
  medium: 'from-cyan-400 to-blue-500',
  hard: 'from-pink-400 to-rose-600',
};

function getRandomPosition(snake: Position[]): Position {
  let pos: Position;
  do {
    pos = {
      x: Math.floor(Math.random() * GRID_SIZE),
      y: Math.floor(Math.random() * GRID_SIZE),
    };
  } while (snake.some(seg => seg.x === pos.x && seg.y === pos.y));
  return pos;
}

export default function App() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const scoreContainerRef = useRef<HTMLDivElement>(null);
  const [snake, setSnake] = useState<Position[]>([{ x: 10, y: 10 }]);
  const [food, setFood] = useState<Position>({ x: 15, y: 10 });
  const [direction, setDirection] = useState<Direction>('RIGHT');
  const [gameState, setGameState] = useState<GameState>('idle');
  const [score, setScore] = useState(0);
  const [highScore, setHighScore] = useState(() => {
    const saved = localStorage.getItem('snake-high-score');
    return saved ? parseInt(saved, 10) : 0;
  });
  const [difficulty, setDifficulty] = useState<Difficulty>('medium');
  const [showDifficultyMenu, setShowDifficultyMenu] = useState(false);
  const [lang, setLang] = useState<Language>(() => {
    const saved = localStorage.getItem('snake-lang');
    return (saved === 'en' || saved === 'ru') ? saved : 'ru';
  });
  const [musicOn, setMusicOn] = useState(() => {
    return localStorage.getItem('snake-music') === 'on';
  });
  const [volume, setVolumeState] = useState(() => {
    const saved = localStorage.getItem('snake-volume');
    return saved ? parseFloat(saved) : 0.6;
  });
  const [scoreAnimating, setScoreAnimating] = useState(false);
  const [floatingTexts, setFloatingTexts] = useState<FloatingText[]>([]);
  const floatIdRef = useRef(0);

  const directionRef = useRef<Direction>(direction);
  const gameStateRef = useRef<GameState>(gameState);
  const touchStartRef = useRef<{ x: number; y: number } | null>(null);
  const lastDirectionRef = useRef<Direction>(direction);

  useEffect(() => { directionRef.current = direction; }, [direction]);
  useEffect(() => {
    gameStateRef.current = gameState;
    if (gameState === 'gameover') playGameOverSound();
  }, [gameState]);

  useEffect(() => {
    if (score > highScore) {
      setHighScore(score);
      localStorage.setItem('snake-high-score', score.toString());
    }
  }, [score, highScore]);

  const toggleLang = () => {
    const newLang = lang === 'ru' ? 'en' : 'ru';
    setLang(newLang);
    localStorage.setItem('snake-lang', newLang);
  };

  const handleMusicToggle = () => {
    const newState = toggleMusic();
    setMusicOn(newState);
    localStorage.setItem('snake-music', newState ? 'on' : 'off');
    if (newState) setVolume(volume);
  };

  const handleVolumeChange = (newVolume: number) => {
    const rounded = Math.round(newVolume * 10) / 10;
    setVolumeState(rounded);
    setVolume(rounded);
    localStorage.setItem('snake-volume', rounded.toString());
  };

  const triggerScoreAnimation = () => {
    setScoreAnimating(true);
    setTimeout(() => setScoreAnimating(false), 400);
    if (scoreContainerRef.current) {
      const rect = scoreContainerRef.current.getBoundingClientRect();
      const id = floatIdRef.current++;
      const newFloat: FloatingText = {
        id,
        x: rect.left + rect.width / 2,
        y: rect.top,
      };
      setFloatingTexts(prev => [...prev, newFloat]);
      setTimeout(() => {
        setFloatingTexts(prev => prev.filter(f => f.id !== id));
      }, 1000);
    }
  };

  const draw = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.fillStyle = '#0a0e1a';
    ctx.fillRect(0, 0, CANVAS_SIZE, CANVAS_SIZE);

    ctx.strokeStyle = 'rgba(74, 222, 128, 0.04)';
    ctx.lineWidth = 0.5;
    for (let i = 0; i <= GRID_SIZE; i++) {
      ctx.beginPath();
      ctx.moveTo(i * CELL_SIZE, 0);
      ctx.lineTo(i * CELL_SIZE, CANVAS_SIZE);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(0, i * CELL_SIZE);
      ctx.lineTo(CANVAS_SIZE, i * CELL_SIZE);
      ctx.stroke();
    }

    const foodX = food.x * CELL_SIZE + CELL_SIZE / 2;
    const foodY = food.y * CELL_SIZE + CELL_SIZE / 2;
    const glow = ctx.createRadialGradient(foodX, foodY, 0, foodX, foodY, CELL_SIZE * 1.2);
    glow.addColorStop(0, 'rgba(244, 114, 182, 0.5)');
    glow.addColorStop(0.5, 'rgba(244, 114, 182, 0.15)');
    glow.addColorStop(1, 'rgba(244, 114, 182, 0)');
    ctx.fillStyle = glow;
    ctx.fillRect(food.x * CELL_SIZE - CELL_SIZE, food.y * CELL_SIZE - CELL_SIZE, CELL_SIZE * 3, CELL_SIZE * 3);

    ctx.fillStyle = '#f472b6';
    ctx.shadowColor = '#f472b6';
    ctx.shadowBlur = 12;
    ctx.beginPath();
    ctx.arc(foodX, foodY, CELL_SIZE / 2 - 2, 0, Math.PI * 2);
    ctx.fill();
    ctx.shadowBlur = 0;

    snake.forEach((segment, index) => {
      const x = segment.x * CELL_SIZE;
      const y = segment.y * CELL_SIZE;
      const isHead = index === 0;

      if (isHead) {
        const gradient = ctx.createLinearGradient(x, y, x + CELL_SIZE, y + CELL_SIZE);
        gradient.addColorStop(0, '#4ade80');
        gradient.addColorStop(1, '#22d3ee');
        ctx.fillStyle = gradient;
        ctx.shadowColor = '#4ade80';
        ctx.shadowBlur = 10;
        ctx.beginPath();
        ctx.roundRect(x + 1, y + 1, CELL_SIZE - 2, CELL_SIZE - 2, 4);
        ctx.fill();
        ctx.shadowBlur = 0;

        ctx.fillStyle = '#fff';
        let eye1X: number, eye1Y: number, eye2X: number, eye2Y: number;
        const dir = directionRef.current;

        if (dir === 'RIGHT') {
          eye1X = x + CELL_SIZE - 6; eye1Y = y + 5;
          eye2X = x + CELL_SIZE - 6; eye2Y = y + CELL_SIZE - 7;
        } else if (dir === 'LEFT') {
          eye1X = x + 5; eye1Y = y + 5;
          eye2X = x + 5; eye2Y = y + CELL_SIZE - 7;
        } else if (dir === 'UP') {
          eye1X = x + 5; eye1Y = y + 5;
          eye2X = x + CELL_SIZE - 7; eye2Y = y + 5;
        } else {
          eye1X = x + 5; eye1Y = y + CELL_SIZE - 6;
          eye2X = x + CELL_SIZE - 7; eye2Y = y + CELL_SIZE - 6;
        }

        ctx.beginPath();
        ctx.arc(eye1X, eye1Y, 3, 0, Math.PI * 2);
        ctx.fill();
        ctx.beginPath();
        ctx.arc(eye2X, eye2Y, 3, 0, Math.PI * 2);
        ctx.fill();

        ctx.fillStyle = '#0a0e1a';
        ctx.beginPath();
        ctx.arc(eye1X, eye1Y, 1.5, 0, Math.PI * 2);
        ctx.fill();
        ctx.beginPath();
        ctx.arc(eye2X, eye2Y, 1.5, 0, Math.PI * 2);
        ctx.fill();
      } else {
        const alpha = 1 - (index / snake.length) * 0.5;
        const t = index / snake.length;
        const r = Math.floor(74 - t * 40);
        const g = Math.floor(222 - t * 40);
        const b = Math.floor(128 + t * 110);
        ctx.fillStyle = `rgba(${r}, ${g}, ${b}, ${alpha})`;
        ctx.beginPath();
        ctx.roundRect(x + 2, y + 2, CELL_SIZE - 4, CELL_SIZE - 4, 3);
        ctx.fill();
      }
    });
  }, [snake, food]);

  useEffect(() => {
    if (gameState !== 'playing') return;
    const interval = setInterval(() => {
      setSnake(prevSnake => {
        const head = { ...prevSnake[0] };
        const dir = directionRef.current;
        lastDirectionRef.current = dir;

        switch (dir) {
          case 'UP': head.y -= 1; break;
          case 'DOWN': head.y += 1; break;
          case 'LEFT': head.x -= 1; break;
          case 'RIGHT': head.x += 1; break;
        }

        if (head.x < 0 || head.x >= GRID_SIZE || head.y < 0 || head.y >= GRID_SIZE) {
          setGameState('gameover');
          return prevSnake;
        }

        if (prevSnake.some(seg => seg.x === head.x && seg.y === head.y)) {
          setGameState('gameover');
          return prevSnake;
        }

        const newSnake = [head, ...prevSnake];

        if (head.x === food.x && head.y === food.y) {
          setScore(s => s + 10);
          setFood(getRandomPosition(newSnake));
          playEatSound();
          triggerScoreAnimation();
        } else {
          newSnake.pop();
        }

        return newSnake;
      });
    }, SPEED_MAP[difficulty]);

    return () => clearInterval(interval);
  }, [gameState, difficulty, food]);

  useEffect(() => { draw(); }, [draw]);

  useEffect(() => {
    if (musicOn && gameState === 'playing') {
      setVolume(volume);
      if (!isMusicPlaying()) toggleMusic();
    }
  }, [gameState, musicOn]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const key = e.key.toLowerCase();
      const code = e.code;

      if (['arrowup', 'arrowdown', 'arrowleft', 'arrowright', ' '].includes(key) ||
          ['KeyW', 'KeyA', 'KeyS', 'KeyD'].includes(code)) {
        e.preventDefault();
      }

      if (key === ' ') {
        if (gameStateRef.current === 'playing') setGameState('paused');
        else if (gameStateRef.current === 'paused') setGameState('playing');
        return;
      }

      if (gameStateRef.current !== 'playing') return;

      const lastDir = lastDirectionRef.current;
      const dir = directionRef.current;

      if (key === 'arrowup' || code === 'KeyW') {
        if (dir !== 'DOWN' && lastDir !== 'DOWN') setDirection('UP');
      } else if (key === 'arrowdown' || code === 'KeyS') {
        if (dir !== 'UP' && lastDir !== 'UP') setDirection('DOWN');
      } else if (key === 'arrowleft' || code === 'KeyA') {
        if (dir !== 'RIGHT' && lastDir !== 'RIGHT') setDirection('LEFT');
      } else if (key === 'arrowright' || code === 'KeyD') {
        if (dir !== 'LEFT' && lastDir !== 'LEFT') setDirection('RIGHT');
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  const handleTouchStart = (e: React.TouchEvent) => {
    const touch = e.touches[0];
    touchStartRef.current = { x: touch.clientX, y: touch.clientY };
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (touchStartRef.current && gameStateRef.current === 'playing') {
      e.preventDefault();
    }
  };

  const handleTouchEnd = (e: React.TouchEvent) => {
    if (!touchStartRef.current) return;
    const touch = e.changedTouches[0];
    const dx = touch.clientX - touchStartRef.current.x;
    const dy = touch.clientY - touchStartRef.current.y;
    const minSwipe = 30;

    if (Math.abs(dx) < minSwipe && Math.abs(dy) < minSwipe) {
      touchStartRef.current = null;
      return;
    }

    if (gameStateRef.current !== 'playing') {
      touchStartRef.current = null;
      return;
    }

    const dir = directionRef.current;
    const lastDir = lastDirectionRef.current;

    if (Math.abs(dx) > Math.abs(dy)) {
      if (dx > 0 && dir !== 'LEFT' && lastDir !== 'LEFT') setDirection('RIGHT');
      else if (dx < 0 && dir !== 'RIGHT' && lastDir !== 'RIGHT') setDirection('LEFT');
    } else {
      if (dy > 0 && dir !== 'UP' && lastDir !== 'UP') setDirection('DOWN');
      else if (dy < 0 && dir !== 'DOWN' && lastDir !== 'DOWN') setDirection('UP');
    }

    touchStartRef.current = null;
  };

  const handleTouchCancel = () => { touchStartRef.current = null; };

  const startGame = () => {
    setSnake([{ x: 10, y: 10 }]);
    setFood(getRandomPosition([{ x: 10, y: 10 }]));
    setDirection('RIGHT');
    setScore(0);
    setGameState('playing');
    setShowDifficultyMenu(false);
  };

  const togglePause = () => {
    if (gameState === 'playing') setGameState('paused');
    else if (gameState === 'paused') setGameState('playing');
  };

  const resetGame = () => {
    setSnake([{ x: 10, y: 10 }]);
    setFood(getRandomPosition([{ x: 10, y: 10 }]));
    setDirection('RIGHT');
    setScore(0);
    setGameState('idle');
  };

  return (
    <div
      className="min-h-screen bg-gradient-to-br from-[#050816] via-[#0a0e1a] to-[#050816] flex flex-col items-center justify-center p-3 select-none overflow-hidden relative"
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
      onTouchCancel={handleTouchCancel}
    >
      <div className="pointer-events-none absolute top-1/4 left-1/4 w-96 h-96 bg-green-500/10 rounded-full blur-3xl" />
      <div className="pointer-events-none absolute bottom-1/4 right-1/4 w-96 h-96 bg-cyan-500/10 rounded-full blur-3xl" />

      {floatingTexts.map(ft => (
        <div
          key={ft.id}
          className="fixed pointer-events-none z-50 animate-float-up neon-text-green font-bold text-lg"
          style={{ left: ft.x, top: ft.y }}
        >
          +10
        </div>
      ))}

      <div className="w-full max-w-sm mb-3 relative z-10">
        <div className="flex items-center justify-between mb-3">
          <h1 className="text-2xl md:text-3xl font-bold bg-gradient-to-r from-green-400 via-cyan-400 to-pink-400 bg-clip-text text-transparent">
            {t('title', lang)}
          </h1>
          <div className="flex items-center gap-2">
            {musicOn && (
              <div className="flex items-center gap-1 bg-slate-900/60 rounded-lg border border-green-500/20 px-2 py-1">
                <ArcSlider value={volume} onChange={handleVolumeChange} size={40} />
              </div>
            )}
            <button
              onClick={handleMusicToggle}
              className={`text-sm px-2.5 py-1.5 rounded-lg border transition-all duration-300 ${
                musicOn ? 'neon-btn-cyan text-cyan-300' : 'neon-btn text-slate-500'
              }`}
            >
              {volume === 0 ? '🔇' : volume < 0.4 ? '🔈' : volume < 0.7 ? '🔉' : '🔊'}
            </button>
            <button
              onClick={toggleLang}
              className="neon-btn text-slate-300 text-xs px-2.5 py-1.5 rounded-lg"
            >
              {lang === 'ru' ? 'EN' : 'RU'}
            </button>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <div
            ref={scoreContainerRef}
            className={`neon-panel rounded-lg px-3 py-2 flex-1 relative ${scoreAnimating ? 'animate-score-pop' : ''}`}
          >
            <div className="text-[10px] uppercase tracking-widest text-green-400/60 font-medium">{t('score', lang)}</div>
            <div className="neon-text-green font-bold text-2xl leading-tight tabular-nums">{score}</div>
          </div>
          <div className="neon-panel-best rounded-lg px-3 py-2 flex-1">
            <div className="text-[10px] uppercase tracking-widest text-yellow-400/60 font-medium">{t('highScore', lang)}</div>
            <div className="neon-text-yellow font-bold text-2xl leading-tight tabular-nums">{highScore}</div>
          </div>
          <div className="neon-panel rounded-lg px-3 py-2">
            <div className="text-[10px] uppercase tracking-widest text-slate-400/60 font-medium">{t('difficulty', lang)}</div>
            <div className={`font-bold text-sm leading-tight bg-gradient-to-r ${DIFFICULTY_COLORS[difficulty]} bg-clip-text text-transparent`}>
              {t(difficulty, lang)}
            </div>
          </div>
        </div>
      </div>

      <div
        className="game-frame relative rounded-xl overflow-hidden"
        style={{ touchAction: 'none' }}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
        onTouchCancel={handleTouchCancel}
      >
        <div className="corner-accent corner-tl" />
        <div className="corner-accent corner-tr" />
        <div className="corner-accent corner-bl" />
        <div className="corner-accent corner-br" />

        <canvas
          ref={canvasRef}
          width={CANVAS_SIZE}
          height={CANVAS_SIZE}
          className="block"
          style={{ width: `min(85vw, 380px)`, height: `min(85vw, 380px)` }}
        />

        {gameState === 'idle' && !showDifficultyMenu && (
          <div className="absolute inset-0 bg-black/80 backdrop-blur-sm flex flex-col items-center justify-center gap-3 animate-fade-in">
            <div className="text-5xl mb-1 animate-bounce-slow">🐍</div>
            <p className="text-white text-lg font-semibold">{t('readyToPlay', lang)}</p>
            <button onClick={startGame} className="neon-btn-primary px-6 py-2.5 text-white font-bold rounded-lg text-sm">
              {t('startGame', lang)}
            </button>
            <button
              onClick={() => setShowDifficultyMenu(true)}
              className="neon-btn-cyan neon-btn px-5 py-2 text-cyan-300 rounded-lg text-xs"
            >
              {t('selectDifficulty', lang)}
            </button>
          </div>
        )}

        {showDifficultyMenu && (
          <div className="absolute inset-0 bg-black/85 backdrop-blur-sm flex flex-col items-center justify-center gap-3 animate-fade-in">
            <p className="text-white text-base font-semibold">{t('chooseDifficulty', lang)}</p>
            {(['easy', 'medium', 'hard'] as Difficulty[]).map(d => (
              <button
                key={d}
                onClick={() => setDifficulty(d)}
                className={`px-6 py-2 rounded-lg font-bold text-white bg-gradient-to-r ${DIFFICULTY_COLORS[d]} shadow-lg active:scale-95 transition-all duration-300 text-sm ${
                  difficulty === d ? 'ring-2 ring-white/50 scale-105' : ''
                }`}
              >
                {t(d, lang)}
              </button>
            ))}
            <button
              onClick={() => setShowDifficultyMenu(false)}
              className="neon-btn px-4 py-1.5 text-slate-400 rounded-lg text-xs mt-1"
            >
              {t('back', lang)}
            </button>
          </div>
        )}

        {gameState === 'paused' && (
          <div className="absolute inset-0 bg-black/80 backdrop-blur-sm flex flex-col items-center justify-center gap-3 animate-fade-in">
            <div className="text-4xl">⏸️</div>
            <p className="text-cyan-300 text-lg font-semibold neon-text-cyan">{t('paused', lang)}</p>
            <button onClick={togglePause} className="neon-btn-cyan neon-btn px-6 py-2.5 text-cyan-300 font-bold rounded-lg text-sm">
              {t('continue', lang)}
            </button>
          </div>
        )}

        {gameState === 'gameover' && (
          <div className="absolute inset-0 bg-black/85 backdrop-blur-sm flex flex-col items-center justify-center gap-2 animate-fade-in">
            <div className="text-4xl mb-1">💀</div>
            <p className="neon-text-pink text-xl font-bold">{t('gameOver', lang)}</p>
            <p className="text-white text-base">
              {t('score', lang)}: <span className="neon-text-green font-bold text-lg">{score}</span>
            </p>
            {score >= highScore && score > 0 && (
              <p className="neon-text-yellow text-xs font-semibold animate-pulse">{t('newRecord', lang)}</p>
            )}
            <div className="flex gap-2 mt-2">
              <button onClick={startGame} className="neon-btn-primary px-5 py-2 text-white font-bold rounded-lg text-sm">
                {t('again', lang)}
              </button>
              <button onClick={resetGame} className="neon-btn-pink neon-btn px-5 py-2 text-pink-300 font-bold rounded-lg text-sm">
                {t('menu', lang)}
              </button>
            </div>
          </div>
        )}
      </div>

      <div className="hidden md:flex justify-center gap-2 mt-3">
        {gameState === 'playing' && (
          <button onClick={togglePause} className="neon-btn-cyan neon-btn px-3 py-1.5 text-cyan-300 rounded-lg text-xs">
            ⏸ {t('pause', lang)}
          </button>
        )}
        {gameState === 'paused' && (
          <button onClick={togglePause} className="neon-btn-cyan neon-btn px-3 py-1.5 text-cyan-300 rounded-lg text-xs">
            ▶ {t('continue', lang)}
          </button>
        )}
        {(gameState === 'playing' || gameState === 'paused') && (
          <button onClick={resetGame} className="neon-btn-pink neon-btn px-3 py-1.5 text-pink-300 rounded-lg text-xs">
            🔄 {t('restart', lang)}
          </button>
        )}
      </div>

      <div className="text-center mt-3 text-slate-600 text-[10px] uppercase tracking-wider">
        <p className="hidden md:block">{t('desktopControls', lang)}</p>
        <p className="md:hidden">{t('controls', lang)}</p>
      </div>
    </div>
  );
}
