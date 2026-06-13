import React, { useState, useEffect, useRef } from 'react';
import { Play, Pause, RotateCcw, Trophy, User, Calendar, Volume2, Shield, Flame, Activity, ChevronRight, HelpCircle } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { Character, GameState } from './types';
import { CHARACTERS, TENNIS_COURT_BG } from './data/characters';
import { playHitSound } from './utils/audio';

export default function App() {
  const [gameState, setGameState] = useState<GameState>({
    playerScore: 0,
    opponentScore: 0,
    gameState: 'MENU',
    selectedPlayer: CHARACTERS[0],
    selectedOpponent: CHARACTERS[1],
    ballX: 400,
    ballY: 250,
    ballSpeedX: 4,
    ballSpeedY: 2,
    ballSpeedMultiplier: 1.0,
    playerPaddleY: 200,
    opponentPaddleY: 200,
    serveTurn: 'PLAYER',
    rallyCount: 0,
    winnerId: null,
    matchDifficulty: 'MEDIUM'
  });

  const [soundEnabled, setSoundEnabled] = useState(true);
  const [showTutorial, setShowTutorial] = useState(false);
  const [isServing, setIsServing] = useState(true);
  const [cameraZoom, setCameraZoom] = useState(1);
  const [trailEffect, setTrailEffect] = useState<{ x: number; y: number }[]>([]);

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animationFrameId = useRef<number | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  // Settings
  const PADDLE_HEIGHT = 80;
  const PADDLE_WIDTH = 12;
  const BALL_RADIUS = 8;
  const COURT_WIDTH = 800;
  const COURT_HEIGHT = 500;

  // Sound triggering proxy helper
  const triggerSound = (type: 'paddle' | 'wall' | 'score' | 'lose' | 'select' | 'win') => {
    if (soundEnabled) {
      playHitSound(type);
    }
  };

  // Keyboard controls for game
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (gameState.gameState !== 'PLAYING') return;
      
      const speed = 25 * (gameState.selectedPlayer?.speed || 1);
      if (e.key === 'ArrowUp' || e.key === 'w' || e.key === 'W') {
        setGameState(prev => ({
          ...prev,
          playerPaddleY: Math.max(0, prev.playerPaddleY - speed)
        }));
      }
      if (e.key === 'ArrowDown' || e.key === 's' || e.key === 'S') {
        setGameState(prev => ({
          ...prev,
          playerPaddleY: Math.min(COURT_HEIGHT - PADDLE_HEIGHT, prev.playerPaddleY + speed)
        }));
      }
      // Enter or Space key to serve when ready
      if ((e.key === ' ' || e.key === 'Enter') && isServing) {
        serveBall();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [gameState.gameState, gameState.selectedPlayer, isServing]);

  // Touch & Mouse Movement tracking relative to container boundaries
  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    if (gameState.gameState !== 'PLAYING' || isServing) return;
    if (!containerRef.current) return;
    
    const rect = containerRef.current.getBoundingClientRect();
    // Calculate Y within canvas boundary scaled
    const relativeY = e.clientY - rect.top;
    
    // Scale factor in case canvas is dynamically sized
    const scale = COURT_HEIGHT / rect.height;
    const targetY = (relativeY * scale) - (PADDLE_HEIGHT / 2);
    
    setGameState(prev => ({
      ...prev,
      playerPaddleY: Math.max(0, Math.min(COURT_HEIGHT - PADDLE_HEIGHT, targetY))
    }));
  };

  const handleTouchMove = (e: React.TouchEvent<HTMLDivElement>) => {
    if (gameState.gameState !== 'PLAYING' || isServing) return;
    if (!containerRef.current || e.touches.length === 0) return;

    const rect = containerRef.current.getBoundingClientRect();
    const relativeY = e.touches[0].clientY - rect.top;
    const scale = COURT_HEIGHT / rect.height;
    const targetY = (relativeY * scale) - (PADDLE_HEIGHT / 2);

    setGameState(prev => ({
      ...prev,
      playerPaddleY: Math.max(0, Math.min(COURT_HEIGHT - PADDLE_HEIGHT, targetY))
    }));
  };

  // Serve trigger
  const serveBall = () => {
    setIsServing(false);
    triggerSound('select');
    const randomDirY = (Math.random() > 0.5 ? 1 : -1) * (1.5 + Math.random() * 2);
    const startSpeedX = gameState.serveTurn === 'PLAYER' ? 4.5 : -4.5;
    
    setGameState(prev => ({
      ...prev,
      ballX: prev.serveTurn === 'PLAYER' ? 60 : COURT_WIDTH - 60,
      ballY: prev.serveTurn === 'PLAYER' ? prev.playerPaddleY + PADDLE_HEIGHT / 2 : prev.opponentPaddleY + PADDLE_HEIGHT / 2,
      ballSpeedX: startSpeedX,
      ballSpeedY: randomDirY,
      ballSpeedMultiplier: 1.0,
      rallyCount: 0
    }));
  };

  // Reset core round state
  const resetRound = (nextServe: 'PLAYER' | 'OPPONENT') => {
    setIsServing(true);
    setTrailEffect([]);
    setGameState(prev => ({
      ...prev,
      ballX: nextServe === 'PLAYER' ? 50 : COURT_WIDTH - 50,
      ballY: nextServe === 'PLAYER' ? prev.playerPaddleY + PADDLE_HEIGHT / 2 : prev.opponentPaddleY + PADDLE_HEIGHT / 2,
      ballSpeedX: 0,
      ballSpeedY: 0,
      serveTurn: nextServe,
      ballSpeedMultiplier: 1.0
    }));
  };

  const resetEntireMatch = () => {
    triggerSound('select');
    setGameState(prev => ({
      ...prev,
      playerScore: 0,
      opponentScore: 0,
      gameState: 'MENU',
      winnerId: null,
      rallyCount: 0
    }));
    setIsServing(true);
    setTrailEffect([]);
  };

  // Main interactive tennis physics loop animation frame
  useEffect(() => {
    if (gameState.gameState !== 'PLAYING') return;

    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let localBallX = gameState.ballX;
    let localBallY = gameState.ballY;
    let localBallSpeedX = gameState.ballSpeedX;
    let localBallSpeedY = gameState.ballSpeedY;
    let localPlayerY = gameState.playerPaddleY;
    let localOpponentY = gameState.opponentPaddleY;
    let multiplier = gameState.ballSpeedMultiplier;

    // AI Difficulty settings variables
    const difficultySpeeds = {
      EASY: 0.05,
      MEDIUM: 0.12,
      HARD: 0.19
    };
    
    const reactionFactor = difficultySpeeds[gameState.matchDifficulty];
    const opponentStatSpeed = gameState.selectedOpponent?.speed || 1;

    const gameLoop = () => {
      // 1. Move AI Paddle intelligently according to the selected opponent dynamic statistics
      if (!isServing) {
        const paddleCenter = localOpponentY + PADDLE_HEIGHT / 2;
        // Make AI human-like by adding small delayed reaction or tracking error
        const targetDiff = localBallY - paddleCenter;
        
        let aiMoveSpeed = 4.2 * reactionFactor * opponentStatSpeed;
        if (Math.abs(targetDiff) > 8) {
          if (targetDiff > 0) {
            localOpponentY += Math.min(aiMoveSpeed, targetDiff);
          } else {
            localOpponentY += Math.max(-aiMoveSpeed, targetDiff);
          }
        }
        // Boundaries
        localOpponentY = Math.max(0, Math.min(COURT_HEIGHT - PADDLE_HEIGHT, localOpponentY));
      } else {
        // Keeps opponent tracking centered or positioned relative to serving stance
        localOpponentY = Math.max(0, Math.min(COURT_HEIGHT - PADDLE_HEIGHT, localBallY - PADDLE_HEIGHT / 2));
      }

      // 2. Ball Physics and Bounds collision logic if not currently suspended for serve
      if (!isServing) {
        localBallX += localBallSpeedX * multiplier;
        localBallY += localBallSpeedY * multiplier;

        // Trail effect tracking limits
        setTrailEffect(prev => {
          const updated = [{ x: localBallX, y: localBallY }, ...prev];
          return updated.slice(0, 10);
        });

        // Top & Bottom boundary bounce
        if (localBallY <= BALL_RADIUS) {
          localBallY = BALL_RADIUS;
          localBallSpeedY = -localBallSpeedY;
          triggerSound('wall');
        } else if (localBallY >= COURT_HEIGHT - BALL_RADIUS) {
          localBallY = COURT_HEIGHT - BALL_RADIUS;
          localBallSpeedY = -localBallSpeedY;
          triggerSound('wall');
        }

        // Left boundary: Player Racket Zone
        if (localBallX <= PADDLE_WIDTH + 15) {
          // Check collision with Player Paddle
          if (localBallY >= localPlayerY - 5 && localBallY <= localPlayerY + PADDLE_HEIGHT + 5) {
            localBallX = PADDLE_WIDTH + 16;
            
            // Calculate striking hit rebound angles depending on where it bounces on player paddle
            const hitRelativeY = (localBallY - (localPlayerY + PADDLE_HEIGHT / 2)) / (PADDLE_HEIGHT / 2);
            const reflexAngle = hitRelativeY * 4.5 * (gameState.selectedPlayer?.curve || 1);
            
            localBallSpeedX = Math.abs(localBallSpeedX);
            localBallSpeedY = reflexAngle;

            // Apply slight boost for power stats
            const powerAmp = gameState.selectedPlayer?.power || 1;
            multiplier = Math.min(2.8, multiplier * (1.04 + (powerAmp - 1) * 0.1));

            setGameState(prev => ({ ...prev, rallyCount: prev.rallyCount + 1 }));
            triggerSound('paddle');
          } else {
            // Opponent scores
            triggerSound('lose');
            setGameState(prev => {
              const nextScore = prev.opponentScore + 1;
              if (nextScore >= 11) {
                return {
                  ...prev,
                  opponentScore: nextScore,
                  gameState: 'GAMEOVER',
                  winnerId: prev.selectedOpponent?.id || 'opponent'
                };
              } else {
                setTimeout(() => resetRound('PLAYER'), 800);
                return { ...prev, opponentScore: nextScore };
              }
            });
            return;
          }
        }

        // Right boundary: Opponent Racket Zone
        if (localBallX >= COURT_WIDTH - PADDLE_WIDTH - 15) {
          // Check bounce on opponent paddle
          if (localBallY >= localOpponentY - 5 && localBallY <= localOpponentY + PADDLE_HEIGHT + 5) {
            localBallX = COURT_WIDTH - PADDLE_WIDTH - 16;

            const hitRelativeY = (localBallY - (localOpponentY + PADDLE_HEIGHT / 2)) / (PADDLE_HEIGHT / 2);
            const reflexAngle = hitRelativeY * 4.5 * (gameState.selectedOpponent?.curve || 1);

            localBallSpeedX = -Math.abs(localBallSpeedX);
            localBallSpeedY = reflexAngle;

            const powerAmp = gameState.selectedOpponent?.power || 1;
            multiplier = Math.min(2.8, multiplier * (1.04 + (powerAmp - 1) * 0.1));

            setGameState(prev => ({ ...prev, rallyCount: prev.rallyCount + 1 }));
            triggerSound('paddle');
          } else {
            // Player scores
            triggerSound('score');
            setGameState(prev => {
              const nextScore = prev.playerScore + 1;
              if (nextScore >= 11) {
                return {
                  ...prev,
                  playerScore: nextScore,
                  gameState: 'GAMEOVER',
                  winnerId: prev.selectedPlayer?.id || 'player'
                };
              } else {
                setTimeout(() => resetRound('OPPONENT'), 800);
                return { ...prev, playerScore: nextScore };
              }
            });
            return;
          }
        }
      } else {
        // Keeps the tennis ball aligned before serving is initialized
        if (gameState.serveTurn === 'PLAYER') {
          localBallX = 35;
          localBallY = localPlayerY + PADDLE_HEIGHT / 2;
        } else {
          localBallX = COURT_WIDTH - 35;
          localBallY = localOpponentY + PADDLE_HEIGHT / 2;
        }
      }

      // Sync React state variables for coordinate positions
      setGameState(prev => ({
        ...prev,
        ballX: localBallX,
        ballY: localBallY,
        ballSpeedX: localBallSpeedX,
        ballSpeedY: localBallSpeedY,
        opponentPaddleY: localOpponentY,
        ballSpeedMultiplier: multiplier
      }));

      // Render graphics overlay to canvas frame
      renderCanvas(ctx, localBallX, localBallY, localPlayerY, localOpponentY, multiplier);

      animationFrameId.current = requestAnimationFrame(gameLoop);
    };

    animationFrameId.current = requestAnimationFrame(gameLoop);
    return () => {
      if (animationFrameId.current) cancelAnimationFrame(animationFrameId.current);
    };
  }, [gameState.gameState, isServing, gameState.matchDifficulty, gameState.selectedPlayer, gameState.selectedOpponent]);

  // Clean, premium 2D renderer for dynamic tennis matches
  const renderCanvas = (
    ctx: CanvasRenderingContext2D,
    bx: number,
    by: number,
    py: number,
    oy: number,
    mult: number
  ) => {
    // Clear backbuffer
    ctx.clearRect(0, 0, COURT_WIDTH, COURT_HEIGHT);

    // Modern neon glowing tennis court grid effect
    ctx.strokeStyle = 'rgba(56, 189, 248, 0.15)';
    ctx.lineWidth = 1;
    const gridSize = 40;
    for (let x = 0; x < COURT_WIDTH; x += gridSize) {
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, COURT_HEIGHT);
      ctx.stroke();
    }
    for (let y = 0; y < COURT_HEIGHT; y += gridSize) {
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(COURT_WIDTH, y);
      ctx.stroke();
    }

    // Outer tennis court boundaries
    ctx.strokeStyle = '#38bdf8';
    ctx.lineWidth = 4;
    ctx.strokeRect(10, 10, COURT_WIDTH - 20, COURT_HEIGHT - 20);

    // Center dividing tennis net
    ctx.strokeStyle = '#c084fc';
    ctx.setLineDash([12, 10]);
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(COURT_WIDTH / 2, 10);
    ctx.lineTo(COURT_WIDTH / 2, COURT_HEIGHT - 10);
    ctx.stroke();
    ctx.setLineDash([]); // Reset line dash

    // Draw Speed Multiplier Indicator on the field background
    ctx.fillStyle = 'rgba(255, 255, 255, 0.03)';
    ctx.font = 'bold 70px JetBrains Mono';
    ctx.textAlign = 'center';
    ctx.fillText(`${Math.round(mult * 100)}% SPEED`, COURT_WIDTH / 2, COURT_HEIGHT / 2 + 25);

    // Draw modern trajectory tracer trailing effect
    trailEffect.forEach((pos, idx) => {
      const opacity = (10 - idx) / 25;
      ctx.fillStyle = `rgba(251, 191, 36, ${opacity})`;
      ctx.beginPath();
      ctx.arc(pos.x, pos.y, BALL_RADIUS * (1 - idx * 0.08), 0, Math.PI * 2);
      ctx.fill();
    });

    // Draw Left Player Paddle (glowing dynamic pink/blue)
    const playerColor = gameState.selectedPlayer?.color || '#38bdf8';
    ctx.fillStyle = playerColor;
    ctx.shadowBlur = 12;
    ctx.shadowColor = playerColor;
    ctx.beginPath();
    ctx.roundRect(15, py, PADDLE_WIDTH, PADDLE_HEIGHT, 6);
    ctx.fill();

    // Draw Right Opponent Paddle (glowing dynamic violet)
    const opponentColor = gameState.selectedOpponent?.color || '#c084fc';
    ctx.fillStyle = opponentColor;
    ctx.shadowColor = opponentColor;
    ctx.beginPath();
    ctx.roundRect(COURT_WIDTH - 15 - PADDLE_WIDTH, oy, PADDLE_WIDTH, PADDLE_HEIGHT, 6);
    ctx.fill();

    // Reset shadow values for rendering subsequent elements
    ctx.shadowBlur = 0;

    // Draw tennis ball (A glowing gold sphere)
    const ballGradient = ctx.createRadialGradient(bx, by, 1, bx, by, BALL_RADIUS);
    ballGradient.addColorStop(0, '#fef08a'); // Bright light yellow
    ballGradient.addColorStop(1, '#fbbf24'); // Sun warm gold
    ctx.fillStyle = ballGradient;
    ctx.shadowBlur = 15;
    ctx.shadowColor = '#fbbf24';
    ctx.beginPath();
    ctx.arc(bx, by, BALL_RADIUS + 1, 0, Math.PI * 2);
    ctx.fill();

    ctx.shadowBlur = 0; // Reset shadow again
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col justify-between font-sans selection:bg-sky-500/30 overflow-x-hidden relative" id="tennis_root">
      
      {/* Dynamic Background visual pattern */}
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-slate-900 via-purple-950/20 to-slate-950 pointer-events-none z-0"></div>

      {/* Modern Top Header Station */}
      <header className="border-b border-slate-800 bg-slate-900/60 backdrop-blur-md relative z-10 py-5 px-6" id="app_header">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <div className="flex items-center space-x-4">
            <div className="bg-gradient-to-tr from-sky-400 to-purple-500 p-2.5 rounded-xl shadow-lg ring-1 ring-sky-300/30 flex items-center justify-center">
              <Trophy className="w-6 h-6 text-slate-950" />
            </div>
            <div>
              <h1 className="text-xl font-bold tracking-tight bg-gradient-to-r from-sky-300 via-indigo-200 to-purple-400 bg-clip-text text-transparent">
                Tennis Arena
              </h1>
              <span className="text-xs font-mono text-slate-400">HIGH-RETIINA STYLIZED SPORTS ENGINE</span>
            </div>
          </div>

          <div className="flex items-center space-x-3 font-mono text-xs text-slate-400 bg-slate-950 px-4 py-2 rounded-lg border border-slate-800">
            <span className="w-2 h-2 rounded-full bg-cyan-400 animate-pulse"></span>
            <span>SYSTEM ENHANCED PREVIEW</span>
            <span className="border-l border-slate-800 pl-3">v1.4.2</span>
          </div>

          <div className="flex items-center space-x-3">
            <button
              onClick={() => {
                setSoundEnabled(!soundEnabled);
                triggerSound('select');
              }}
              className={`p-2.5 rounded-lg border transition-all ${
                soundEnabled 
                  ? 'bg-sky-500/10 border-sky-500/20 text-sky-400 hover:bg-sky-500/20' 
                  : 'bg-slate-800/40 border-slate-700/30 text-slate-500 hover:bg-slate-800/70'
              }`}
              title="Tovushlarni yoqish/oʻchirish"
              id="btn_sound"
            >
              <Volume2 className="w-4 h-4" />
            </button>
            <button
              onClick={() => {
                setShowTutorial(!showTutorial);
                triggerSound('select');
              }}
              className="p-2.5 font-mono text-xs rounded-lg border border-slate-800 bg-slate-900 hover:bg-slate-800 transition-colors flex items-center space-x-1"
              id="btn_tutorial"
            >
              <HelpCircle className="w-4 h-4 text-slate-400" />
              <span>Yo'riqnoma</span>
            </button>
          </div>
        </div>
      </header>

      {/* Main Container Views Container */}
      <main className="flex-grow flex items-center justify-center p-4 md:p-8 relative z-10" id="app_main">
        <AnimatePresence mode="wait">
          
          {/* VIEW 1: MENU SCREEN */}
          {gameState.gameState === 'MENU' && (
            <motion.div
              key="menu"
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -15 }}
              className="max-w-4xl w-full text-center relative"
              id="menu_view"
            >
              {/* Grand Banner */}
              <div className="mb-8 relative rounded-2xl overflow-hidden border border-slate-800 max-w-2xl mx-auto shadow-2xl">
                <img
                  src={TENNIS_COURT_BG}
                  alt="Futuristic neon court"
                  className="w-full h-44 object-cover object-center opacity-80 brightness-90 filter contrast-125"
                  referrerPolicy="no-referrer"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-slate-950 via-slate-950/70 to-transparent flex flex-col justify-end p-6 text-left">
                  <span className="text-xs font-mono text-sky-400 uppercase tracking-widest mb-1.5">CHAMPIONSHIP TOUR</span>
                  <h2 className="text-3xl font-black italic tracking-wide text-white uppercase sm:text-4xl text-shadow-md">
                    CYBER STYLED VOLLEY
                  </h2>
                </div>
              </div>

              <div className="mb-6 max-w-xl mx-auto">
                <p className="text-slate-300 text-sm md:text-base leading-relaxed">
                  O'yin tennisining ajoyib qizg'in analogiga xush kelibsiz! Har bir personaj yuqori darajada ishlangan bo'lib, o'ziga xos ichki kiyim/suzish kiyimi (<span className="text-sky-300">lingerie / swimwear style description</span>) va individual o'yin ko'rsatkichlariga ega.
                </p>
              </div>

              {/* Character Showcase Grid */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6 max-w-4xl mx-auto mb-8 text-left">
                {CHARACTERS.map((char) => (
                  <div
                    key={char.id}
                    className="bg-slate-900/60 border border-slate-800 rounded-xl p-4 flex flex-col hover:border-slate-700/60 transition-all relative overflow-hidden group shadow-lg"
                  >
                    <div className="h-44 rounded-lg overflow-hidden bg-slate-950 mb-3 relative">
                      <img
                        src={char.imageUrl}
                        alt={char.name}
                        className="w-full h-full object-cover object-top group-hover:scale-105 transition-transform duration-500"
                        referrerPolicy="no-referrer"
                      />
                      <div className="absolute bottom-0 inset-x-0 bg-slate-950/80 p-2 text-[11px] font-mono border-t border-slate-800/80 text-center">
                        <span className="text-amber-300 font-bold">{char.name}</span>
                      </div>
                    </div>
                    <div className="flex-grow">
                      <h3 className="text-sm font-semibold mb-1 text-slate-100 flex items-center justify-between">
                        <span>{char.name.split(' "')[0]}</span>
                        <span className="text-xs text-slate-400 font-mono italic">Style</span>
                      </h3>
                      <p className="text-xs text-slate-400 line-clamp-3 mb-2 leading-relaxed">
                        {char.description}
                      </p>
                      <div className="border-t border-slate-800 mt-2 pt-2 space-y-1">
                        <div className="flex justify-between items-center text-[10px] font-mono">
                          <span className="text-slate-500">Tezlik</span>
                          <span className="text-sky-300 font-bold">{(char.speed * 10).toFixed(1)}</span>
                        </div>
                        <div className="flex justify-between items-center text-[10px] font-mono">
                          <span className="text-slate-500">Kuch</span>
                          <span className="text-purple-400 font-bold">{(char.power * 10).toFixed(1)}</span>
                        </div>
                        <div className="flex justify-between items-center text-[10px] font-mono">
                          <span className="text-slate-500">Krivizna (Spin)</span>
                          <span className="text-amber-400 font-bold">{(char.curve * 10).toFixed(1)}</span>
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              {/* Start CTA Buttons */}
              <div className="flex flex-col sm:flex-row items-center justify-center gap-4 max-w-md mx-auto">
                <button
                  onClick={() => {
                    setGameState(prev => ({ ...prev, gameState: 'CHARACTER_SELECT' }));
                    triggerSound('select');
                  }}
                  className="w-full bg-gradient-to-r from-sky-400 to-indigo-500 hover:from-sky-300 hover:to-indigo-400 text-slate-950 font-bold py-4 px-8 rounded-xl transition-all font-mono tracking-wider flex items-center justify-center space-x-2 shadow-lg shadow-sky-500/20 group hover:scale-[1.02]"
                  id="btn_start_match"
                >
                  <span>MUSHINGIZNI BOSHLASH</span>
                  <ChevronRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
                </button>
              </div>
            </motion.div>
          )}

          {/* VIEW 2: CHARACTER SELECT SCREEN */}
          {gameState.gameState === 'CHARACTER_SELECT' && (
            <motion.div
              key="char_select"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="max-w-5xl w-full"
              id="char_select_view"
            >
              <div className="text-center mb-8">
                <span className="text-xs font-mono text-indigo-400 uppercase tracking-widest bg-indigo-950/40 border border-indigo-900/40 px-3 py-1 rounded-full">ARENA SELECTION MODE</span>
                <h2 className="text-3xl font-black italic tracking-tight text-white mt-3">Raqibingiz va O'g'lingizni Tanlang</h2>
                <p className="text-slate-400 text-sm mt-1">Har bir tennischi qizaloq chiroyli va o'ziga xos ichki kiyim uslubi va maxsus o'yin ko'rsatkichlariga ega.</p>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-8">
                
                {/* 1. Player Character Customizer Box */}
                <div className="bg-slate-900/60 border border-slate-800 rounded-2xl p-6 relative flex flex-col justify-between">
                  <div className="absolute top-4 left-4 bg-gradient-to-r from-sky-500 to-indigo-500 text-slate-950 text-xs font-mono font-black italic uppercase px-3 py-1 rounded-md shadow-sm">
                    Sizning Qahramoningiz
                  </div>

                  <div className="flex flex-col sm:flex-row gap-6 mt-4">
                    {/* Character Card Visual */}
                    <div className="w-full sm:w-1/2 rounded-xl overflow-hidden bg-slate-950 border border-slate-800 relative h-72">
                      {gameState.selectedPlayer && (
                        <>
                          <img
                            src={gameState.selectedPlayer.imageUrl}
                            alt={gameState.selectedPlayer.name}
                            className="w-full h-full object-cover object-top"
                            referrerPolicy="no-referrer"
                          />
                          <div className="absolute inset-0 bg-gradient-to-t from-slate-950 via-slate-950/20 to-transparent flex flex-col justify-end p-4">
                            <span className="text-[10px] text-sky-400 font-mono uppercase font-bold tracking-widest">{gameState.selectedPlayer.underwearStyle ? 'Outfit Preview' : ''}</span>
                            <span className="text-lg font-black italic text-white leading-normal">{gameState.selectedPlayer.name}</span>
                          </div>
                        </>
                      )}
                    </div>

                    {/* Character Attributes and Style Description */}
                    <div className="w-full sm:w-1/2 flex flex-col justify-between">
                      <div>
                        <h3 className="text-slate-400 font-mono text-xs uppercase tracking-wider mb-2">Tanlov ro'yxati:</h3>
                        <div className="grid grid-cols-3 gap-2 mb-4">
                          {CHARACTERS.map(c => (
                            <button
                              key={`p-select-${c.id}`}
                              onClick={() => {
                                setGameState(prev => ({ ...prev, selectedPlayer: c }));
                                triggerSound('select');
                              }}
                              className={`py-1 px-2 font-mono text-[10px] uppercase font-bold border rounded-lg transition-all ${
                                gameState.selectedPlayer?.id === c.id
                                  ? 'bg-sky-500/20 border-sky-400 text-sky-300 shadow-sm'
                                  : 'bg-slate-950 border-slate-850 text-slate-400 hover:border-slate-700'
                              }`}
                            >
                              {c.id}
                            </button>
                          ))}
                        </div>

                        {gameState.selectedPlayer && (
                          <div className="space-y-3 bg-slate-950/80 p-4 rounded-xl border border-slate-800">
                            <div>
                              <span className="text-[10px] font-mono text-cyan-400 font-semibold uppercase tracking-wider">Ichki kiyim kroyi & uslubi:</span>
                              <p className="text-xs text-slate-300 mt-1 italic font-light leading-relaxed">
                                "{gameState.selectedPlayer.underwearStyle}"
                              </p>
                            </div>
                            <div className="border-t border-slate-800/80 pt-2">
                              <span className="text-[10px] font-mono text-slate-500 uppercase tracking-widest">Alohida Qobiliyati:</span>
                              <p className="text-[11px] text-slate-400 mt-0.5">{gameState.selectedPlayer.description}</p>
                            </div>
                          </div>
                        )}
                      </div>

                      {/* Power Levels Bars */}
                      {gameState.selectedPlayer && (
                        <div className="space-y-2 mt-4 bg-slate-950/40 p-3 rounded-lg border border-slate-800/50">
                          <div>
                            <div className="flex justify-between items-center text-[10px] font-mono text-slate-400 mb-1">
                              <span>Tezlik (Speed)</span>
                              <span className="text-slate-200">{(gameState.selectedPlayer.speed * 10).toFixed(0)}</span>
                            </div>
                            <div className="w-full bg-slate-850 h-1.5 rounded-full overflow-hidden">
                              <div className="bg-sky-400 h-full" style={{ width: `${(gameState.selectedPlayer.speed - 0.8) / 0.8 * 100}%` }}></div>
                            </div>
                          </div>
                          <div>
                            <div className="flex justify-between items-center text-[10px] font-mono text-slate-400 mb-1">
                              <span>Zarba Kuchi (Hit Power)</span>
                              <span className="text-slate-200">{(gameState.selectedPlayer.power * 10).toFixed(0)}</span>
                            </div>
                            <div className="w-full bg-slate-850 h-1.5 rounded-full overflow-hidden">
                              <div className="bg-indigo-400 h-full" style={{ width: `${(gameState.selectedPlayer.power - 0.8) / 0.8 * 100}%` }}></div>
                            </div>
                          </div>
                          <div>
                            <div className="flex justify-between items-center text-[10px] font-mono text-slate-400 mb-1">
                              <span>Aylantirish (Spin Accuracy)</span>
                              <span className="text-slate-200">{(gameState.selectedPlayer.curve * 10).toFixed(0)}</span>
                            </div>
                            <div className="w-full bg-slate-850 h-1.5 rounded-full overflow-hidden">
                              <div className="bg-amber-400 h-full" style={{ width: `${(gameState.selectedPlayer.curve - 0.8) / 0.8 * 100}%` }}></div>
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                </div>

                {/* 2. Opponent Character Selection Box */}
                <div className="bg-slate-900/60 border border-slate-800 rounded-2xl p-6 relative flex flex-col justify-between">
                  <div className="absolute top-4 left-4 bg-gradient-to-r from-purple-500 to-pink-500 text-slate-950 text-xs font-mono font-black italic uppercase px-3 py-1 rounded-md shadow-sm">
                    Raqibingiz <span className="text-[10px] font-normal underline">(AI boshqaradi)</span>
                  </div>

                  <div className="flex flex-col sm:flex-row gap-6 mt-4">
                    {/* Character Card Artwork */}
                    <div className="w-full sm:w-1/2 rounded-xl overflow-hidden bg-slate-950 border border-slate-800 relative h-72">
                      {gameState.selectedOpponent && (
                        <>
                          <img
                            src={gameState.selectedOpponent.imageUrl}
                            alt={gameState.selectedOpponent.name}
                            className="w-full h-full object-cover object-top"
                            referrerPolicy="no-referrer"
                          />
                          <div className="absolute inset-0 bg-gradient-to-t from-slate-950 via-slate-950/20 to-transparent flex flex-col justify-end p-4">
                            <span className="text-[10px] text-purple-400 font-mono uppercase font-bold tracking-widest">{gameState.selectedOpponent.underwearStyle ? 'Outfit Preview' : ''}</span>
                            <span className="text-lg font-black italic text-white leading-normal">{gameState.selectedOpponent.name}</span>
                          </div>
                        </>
                      )}
                    </div>

                    {/* Character info stats and style description */}
                    <div className="w-full sm:w-1/2 flex flex-col justify-between">
                      <div>
                        <h3 className="text-slate-400 font-mono text-xs uppercase tracking-wider mb-2">Birini tanlang:</h3>
                        <div className="grid grid-cols-3 gap-2 mb-4">
                          {CHARACTERS.map(c => (
                            <button
                              key={`o-select-${c.id}`}
                              onClick={() => {
                                setGameState(prev => ({ ...prev, selectedOpponent: c }));
                                triggerSound('select');
                              }}
                              className={`py-1 px-2 font-mono text-[10px] uppercase font-bold border rounded-lg transition-all ${
                                gameState.selectedOpponent?.id === c.id
                                  ? 'bg-purple-500/20 border-purple-400 text-purple-300 shadow-sm'
                                  : 'bg-slate-950 border-slate-850 text-slate-400 hover:border-slate-700'
                              }`}
                            >
                              {c.id}
                            </button>
                          ))}
                        </div>

                        {gameState.selectedOpponent && (
                          <div className="space-y-3 bg-slate-950/80 p-4 rounded-xl border border-slate-800">
                            <div>
                              <span className="text-[10px] font-mono text-purple-400 font-semibold uppercase tracking-wider">Ichki kiyim kroyi & uslubi:</span>
                              <p className="text-xs text-slate-300 mt-1 italic font-light leading-relaxed">
                                "{gameState.selectedOpponent.underwearStyle}"
                              </p>
                            </div>
                            <div className="border-t border-slate-800/80 pt-2">
                              <span className="text-[10px] font-mono text-slate-500 uppercase tracking-widest">Alohida Qobiliyati:</span>
                              <p className="text-[11px] text-slate-400 mt-0.5">{gameState.selectedOpponent.description}</p>
                            </div>
                          </div>
                        )}
                      </div>

                      {/* Opponent Power Levels */}
                      {gameState.selectedOpponent && (
                        <div className="space-y-2 mt-4 bg-slate-950/40 p-3 rounded-lg border border-slate-800/50">
                          <div>
                            <div className="flex justify-between items-center text-[10px] font-mono text-slate-400 mb-1">
                              <span>Tezlik (Speed)</span>
                              <span className="text-slate-200">{(gameState.selectedOpponent.speed * 10).toFixed(0)}</span>
                            </div>
                            <div className="w-full bg-slate-850 h-1.5 rounded-full overflow-hidden">
                              <div className="bg-purple-400 h-full" style={{ width: `${(gameState.selectedOpponent.speed - 0.8) / 0.8 * 100}%` }}></div>
                            </div>
                          </div>
                          <div>
                            <div className="flex justify-between items-center text-[10px] font-mono text-slate-400 mb-1">
                              <span>Zarba Kuchi (Hit Power)</span>
                              <span className="text-slate-200">{(gameState.selectedOpponent.power * 10).toFixed(0)}</span>
                            </div>
                            <div className="w-full bg-slate-850 h-1.5 rounded-full overflow-hidden">
                              <div className="bg-purple-400 h-full" style={{ width: `${(gameState.selectedOpponent.power - 0.8) / 0.8 * 100}%` }}></div>
                            </div>
                          </div>
                          <div>
                            <div className="flex justify-between items-center text-[10px] font-mono text-slate-400 mb-1">
                              <span>Aylantirish (Spin Accuracy)</span>
                              <span className="text-slate-200">{(gameState.selectedOpponent.curve * 10).toFixed(0)}</span>
                            </div>
                            <div className="w-full bg-slate-850 h-1.5 rounded-full overflow-hidden">
                              <div className="bg-purple-400 h-full" style={{ width: `${(gameState.selectedOpponent.curve - 0.8) / 0.8 * 100}%` }}></div>
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                </div>

              </div>

              {/* Match Settings Panel & CTA Start Match */}
              <div className="bg-slate-900 border border-slate-800 p-6 rounded-2xl flex flex-col md:flex-row items-center justify-between gap-6 max-w-4xl mx-auto">
                {/* Match Difficulty toggle selectors */}
                <div>
                  <h4 className="text-xs font-mono uppercase text-slate-400 tracking-wider mb-2">Qiyinchilik darajasini aniqlang:</h4>
                  <div className="flex space-x-2">
                    {['EASY', 'MEDIUM', 'HARD'].map((diff) => (
                      <button
                        key={diff}
                        onClick={() => {
                          setGameState(prev => ({ ...prev, matchDifficulty: diff as any }));
                          triggerSound('select');
                        }}
                        className={`px-4 py-2 font-mono text-xs uppercase font-bold border rounded-lg transition-all ${
                          gameState.matchDifficulty === diff
                            ? 'bg-amber-400 text-slate-950 border-amber-300 font-extrabold shadow-md'
                            : 'bg-slate-950 border-slate-80) text-slate-400 hover:border-slate-700'
                        }`}
                      >
                        {diff === 'EASY' ? 'Oson' : diff === 'MEDIUM' ? 'O\'rta' : 'Qiyin'}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="flex space-x-3 w-full md:w-auto">
                  <button
                    onClick={() => {
                      setGameState(prev => ({ ...prev, gameState: 'MENU' }));
                      triggerSound('select');
                    }}
                    className="w-1/2 md:w-auto px-6 py-3.5 border border-slate-800 bg-slate-950 hover:bg-slate-850 font-mono text-xs uppercase rounded-xl transition-colors text-slate-400"
                  >
                    Orqaga
                  </button>
                  <button
                    onClick={() => {
                      setGameState(prev => ({ 
                        ...prev, 
                        gameState: 'PLAYING',
                        playerScore: 0,
                        opponentScore: 0,
                        winnerId: null 
                      }));
                      resetRound('PLAYER');
                      triggerSound('select');
                    }}
                    className="w-1/2 md:w-auto px-10 py-3.5 bg-gradient-to-r from-emerald-400 to-teal-500 hover:from-emerald-300 hover:to-teal-400 text-slate-950 font-extrabold tracking-wider font-mono text-xs uppercase rounded-xl shadow-lg shadow-emerald-500/20"
                    id="btn_arena_init"
                  >
                    KORTGA CHIQISH
                  </button>
                </div>
              </div>
            </motion.div>
          )}

          {/* VIEW 3: MATCH ARENA SCREEN WITH INTERACTIVE CANVAS */}
          {gameState.gameState === 'PLAYING' && (
            <motion.div
              key="playing"
              initial={{ opacity: 0, scale: 0.98 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.98 }}
              className="max-w-6xl w-full"
              id="playing_view"
            >
              
              {/* Scoreboard Widget HUD */}
              <div className="grid grid-cols-3 bg-slate-900 border border-slate-800 rounded-2xl p-4 mb-4 items-center shadow-lg relative overflow-hidden">
                <div className="absolute inset-0 bg-gradient-to-r from-transparent via-cyan-500/5 to-transparent pointer-events-none"></div>

                {/* Left Side: Selected Player HUD */}
                <div className="flex items-center space-x-3">
                  <div className="w-12 h-12 rounded-lg overflow-hidden bg-slate-950 border border-slate-850 relative">
                    <img
                      src={gameState.selectedPlayer?.imageUrl}
                      alt={gameState.selectedPlayer?.name}
                      className="w-full h-full object-cover object-top"
                      referrerPolicy="no-referrer"
                    />
                  </div>
                  <div>
                    <h3 className="text-sm font-black italic text-sky-400">{gameState.selectedPlayer?.name.split(' "')[0]}</h3>
                    <span className="text-[10px] font-mono text-slate-400 flex items-center space-x-1">
                      <User className="w-3 h-3 inline text-slate-500" />
                      <span className="truncate max-w-[120px]">{gameState.selectedPlayer?.underwearStyle.slice(0, 20)}...</span>
                    </span>
                  </div>
                </div>

                {/* Center Dynamic HUD: Rallies and Global Scores */}
                <div className="text-center">
                  <div className="flex items-center justify-center space-x-6">
                    <span className="text-3xl font-black font-mono text-sky-400 leading-none">{gameState.playerScore}</span>
                    <span className="text-xs font-mono text-slate-500 border border-slate-800 bg-slate-950 px-2   py-1 rounded-md">VS</span>
                    <span className="text-3xl font-black font-mono text-purple-400 leading-none">{gameState.opponentScore}</span>
                  </div>
                  <div className="text-[10px] font-mono text-slate-400 mt-2 bg-slate-950 border border-slate-800 rounded-full inline-block px-3 py-0.5">
                    Ralli: <span className="text-amber-400 font-bold">{gameState.rallyCount}</span>
                  </div>
                </div>

                {/* Right Side: Opponent AI Player HUD */}
                <div className="flex items-center justify-end space-x-3">
                  <div className="text-right">
                    <h3 className="text-sm font-black italic text-purple-400">{gameState.selectedOpponent?.name.split(' "')[0]}</h3>
                    <span className="text-[10px] font-mono text-slate-400 flex justify-end items-center space-x-1">
                      <span className="truncate max-w-[120px]">{gameState.selectedOpponent?.underwearStyle.slice(0, 20)}...</span>
                      <Activity className="w-3 h-3 inline text-slate-500" />
                    </span>
                  </div>
                  <div className="w-12 h-12 rounded-lg overflow-hidden bg-slate-950 border border-slate-850 relative">
                    <img
                      src={gameState.selectedOpponent?.imageUrl}
                      alt={gameState.selectedOpponent?.name}
                      className="w-full h-full object-cover object-top"
                      referrerPolicy="no-referrer"
                    />
                  </div>
                </div>
              </div>

              {/* Arena Interactive Stage Canvas Wrapper */}
              <div className="flex flex-col lg:flex-row gap-6">
                
                {/* 1. Left side canvas column */}
                <div className="flex-grow">
                  <div
                    ref={containerRef}
                    onMouseMove={handleMouseMove}
                    onTouchMove={handleTouchMove}
                    className="relative w-full aspect-[8/5] bg-slate-950 border border-slate-800 rounded-2xl overflow-hidden cursor-crosshair group shadow-inner max-w-4xl mx-auto"
                    id="canvas_stage_frame"
                  >
                    <canvas
                      ref={canvasRef}
                      width={COURT_WIDTH}
                      height={COURT_HEIGHT}
                      className="w-full h-full block relative"
                    />

                    {/* Overlay: Initial Serve Button CTA */}
                    {isServing && (
                      <div className="absolute inset-0 bg-slate-950/80 flex flex-col items-center justify-center p-6 text-center z-20 backdrop-blur-sm">
                        <div className="bg-slate-900 border border-slate-800 p-6 rounded-2xl shadow-2xl max-w-sm">
                          <Activity className="w-12 h-12 text-amber-400 mx-auto animate-pulse mb-3" />
                          <h4 className="text-lg font-bold text-white mb-2 font-mono">
                            {gameState.serveTurn === 'PLAYER' ? 'Sizning to\'pingiz' : 'Raqibning to\'pi'}
                          </h4>
                          <p className="text-slate-400 text-xs mb-4">
                            {gameState.serveTurn === 'PLAYER' 
                              ? 'To\'pni kiritish uchun quydagi tugmani bosing yoki SPACE / ENTER tugmalaridan foydalaning.' 
                              : 'AI to\'pni kiritmoqda, e\'tiborli bo\'ling.'}
                          </p>

                          {gameState.serveTurn === 'PLAYER' ? (
                            <button
                              onClick={serveBall}
                              className="w-full py-3 bg-gradient-to-r from-amber-400 to-orange-500 hover:from-amber-300 hover:to-orange-400 text-slate-950 font-black font-mono tracking-wider text-xs uppercase rounded-xl transition-all shadow-md shadow-amber-500/10 active:scale-95"
                              id="btn_serve"
                            >
                              SERVIS ETISH
                            </button>
                          ) : (
                            <button
                              onClick={serveBall}
                              className="w-full py-3 bg-slate-800 text-slate-100 font-bold border border-slate-700 font-mono text-xs uppercase rounded-xl animate-pulse"
                              id="btn_ai_serve"
                            >
                              KUTIB OLISH
                            </button>
                          )}
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Controller Instructions Footer bar inside arena */}
                  <div className="mt-4 flex flex-wrap gap-4 justify-between items-center bg-slate-900/60 border border-slate-800/80 p-4 rounded-xl text-xs font-mono text-slate-400">
                    <div className="flex items-center space-x-3">
                      <span className="font-bold text-slate-300 uppercase">Boshqarish:</span>
                      <span>Sichqonchani yurgizish / Sensorli ekran</span>
                      <span className="text-slate-700">|</span>
                      <span>Klaviaturada: <kbd className="px-1.5 py-0.5 bg-slate-800 border border-slate-700 rounded text-[10px] text-slate-200">W</kbd> or <kbd className="px-1.5 py-0.5 bg-slate-800 border border-slate-700 rounded text-[10px] text-slate-200">↑</kbd> va <kbd className="px-1.5 py-0.5 bg-slate-800 border border-slate-700 rounded text-[10px] text-slate-200">S</kbd> or <kbd className="px-1.5 py-0.5 bg-slate-800 border border-slate-700 rounded text-[10px] text-slate-200">↓</kbd></span>
                    </div>

                    <div className="flex space-x-3">
                      <button
                        onClick={resetEntireMatch}
                        className="px-3 py-1.5 border border-slate-800 hover:border-slate-700 text-red-400 hover:bg-slate-950 rounded transition-all flex items-center space-x-1 uppercase"
                        id="btn_quit"
                      >
                        <RotateCcw className="w-3.5 h-3.5" />
                        <span>Taslim Bo'lish</span>
                      </button>
                    </div>
                  </div>
                </div>

                {/* 2. Right side info detailing matching statistics & character swimwear specifications */}
                <div className="w-full lg:w-72 flex flex-col gap-4">
                  {/* Active Player Live Card Display */}
                  <div className="bg-slate-900/60 border border-slate-850 rounded-2xl p-4 shadow-md flex flex-col justify-between">
                    <div>
                      <span className="text-[10px] font-mono text-sky-400 uppercase font-black">SIZNING SPORTCHIINGIZ</span>
                      <div className="h-44 rounded-xl overflow-hidden bg-slate-950 border border-slate-800 my-2 relative">
                        <img
                          src={gameState.selectedPlayer?.imageUrl}
                          alt={gameState.selectedPlayer?.name}
                          className="w-full h-full object-cover object-top"
                          referrerPolicy="no-referrer"
                        />
                      </div>
                      <h4 className="font-bold text-sm text-slate-100">{gameState.selectedPlayer?.name}</h4>
                      <p className="text-xs text-slate-400 line-clamp-3 mt-1 leading-relaxed">
                        {gameState.selectedPlayer?.description}
                      </p>
                    </div>

                    <div className="border-t border-slate-800 mt-3 pt-3">
                      <span className="text-[10px] font-mono text-cyan-400 uppercase font-bold tracking-wider">Ichki kiyim kroyi & uslubi:</span>
                      <p className="text-xs text-slate-300 leading-relaxed mt-1 italic font-light font-serif">
                        "{gameState.selectedPlayer?.underwearStyle}"
                      </p>
                    </div>
                  </div>

                  {/* Competitive Status dashboard */}
                  <div className="bg-slate-900/60 border border-slate-850 rounded-2xl p-4 shadow-md text-xs space-y-3 font-mono">
                    <span className="text-[10px] uppercase font-black text-amber-500 block">KORT XALOTI INFORMASETIYA</span>
                    <div className="flex justify-between border-b border-slate-800 pb-1.5">
                      <span className="text-slate-500">Raqib AI qiyinligi:</span>
                      <span className="text-slate-200 font-bold">{gameState.matchDifficulty === 'EASY' ? 'Oson' : gameState.matchDifficulty === 'MEDIUM' ? 'O\'rta' : 'Qiyin'}</span>
                    </div>
                    <div className="flex justify-between border-b border-slate-800 pb-1.5">
                      <span className="text-slate-500">Raund marrasi:</span>
                      <span className="text-slate-200 font-bold">11 ochko</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-500">Tezlik ko'rsatkichi:</span>
                      <span className="text-emerald-400 font-black">{(gameState.ballSpeedMultiplier * 100).toFixed(0)}%</span>
                    </div>
                  </div>
                </div>

              </div>

            </motion.div>
          )}

          {/* VIEW 4: MATCH END GAMEOVER MODAL */}
          {gameState.gameState === 'GAMEOVER' && (
            <motion.div
              key="gameover"
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="max-w-2xl w-full text-center relative bg-slate-900 border border-slate-800 rounded-3xl p-8 shadow-2xl overflow-hidden"
              id="gameover_view"
            >
              <div className="absolute inset-0 bg-gradient-to-b from-transparent via-purple-500/5 to-transparent pointer-events-none"></div>

              {/* Character Trophy Celebration Illustration */}
              {gameState.winnerId === gameState.selectedPlayer?.id ? (
                <div className="mb-6 relative">
                  <div className="w-32 h-32 rounded-full overflow-hidden mx-auto border-4 border-amber-400 shadow-lg shadow-amber-500/20 bg-slate-950 relative">
                    <img
                      src={gameState.selectedPlayer?.imageUrl}
                      alt="Winner Portrait"
                      className="w-full h-full object-cover object-top"
                      referrerPolicy="no-referrer"
                    />
                  </div>
                  <div className="mt-4">
                    <Trophy className="w-12 h-12 text-amber-400 mx-auto animate-bounce mb-2" />
                    <span className="text-xs font-mono text-amber-400 uppercase tracking-widest font-black">G'alaba Qozondingiz!</span>
                    <h2 className="text-3xl font-black italic text-white uppercase mt-1">G'ALABA GOLDBOX</h2>
                    <p className="text-slate-400 text-sm mt-2 max-w-sm mx-auto leading-relaxed">
                      Sizning tennischingiz <span className="text-sky-300 font-bold">{gameState.selectedPlayer?.name}</span> raqibni mohirlik bilan mag'lubiyatga uchratdi!
                    </p>
                  </div>
                </div>
              ) : (
                <div className="mb-6 relative">
                  <div className="w-32 h-32 rounded-full overflow-hidden mx-auto border-4 border-slate-700 bg-slate-950 relative grayscale opacity-75">
                    <img
                      src={gameState.selectedOpponent?.imageUrl}
                      alt="Opponent Winner Portrait"
                      className="w-full h-full object-cover object-top"
                      referrerPolicy="no-referrer"
                    />
                  </div>
                  <div className="mt-4">
                    <span className="text-xs font-mono text-red-400 uppercase tracking-widest font-black">Yutqazdingiz</span>
                    <h2 className="text-3xl font-black italic text-slate-100 uppercase mt-1">YUTQAZDINGIZ</h2>
                    <p className="text-slate-400 text-sm mt-2 max-w-sm mx-auto leading-relaxed">
                      Bu safar <span className="text-purple-400 font-bold">{gameState.selectedOpponent?.name}</span> ustunlik qildi. Keyingi safar kuchlar muvozanatini hisobga oling!
                    </p>
                  </div>
                </div>
              )}

              {/* Score breakdown metrics display */}
              <div className="bg-slate-950 rounded-2xl p-4 border border-slate-800/80 max-w-sm mx-auto mb-6">
                <span className="text-[10px] font-mono text-slate-500 uppercase tracking-widest block mb-2">YAKUNIY PROTOKOL MATCHI</span>
                <div className="flex justify-between items-center px-4">
                  <div className="text-left">
                    <span className="text-xs font-mono text-sky-400 font-bold">{gameState.selectedPlayer?.name.split(' "')[0]}</span>
                    <span className="block text-[10px] text-slate-500 italic truncate max-w-[120px]">{gameState.selectedPlayer?.underwearStyle.slice(0, 20)}...</span>
                  </div>
                  <div className="text-lg font-mono font-black text-white">
                    {gameState.playerScore} - {gameState.opponentScore}
                  </div>
                  <div className="text-right">
                    <span className="text-xs font-mono text-purple-400 font-bold">{gameState.selectedOpponent?.name.split(' "')[0]}</span>
                    <span className="block text-[10px] text-slate-500 italic truncate max-w-[120px]">{gameState.selectedOpponent?.underwearStyle.slice(0, 20)}...</span>
                  </div>
                </div>
              </div>

              {/* Actions Grid */}
              <div className="flex flex-col sm:flex-row gap-4 max-w-md mx-auto items-center justify-center">
                <button
                  onClick={resetEntireMatch}
                  className="w-full sm:w-auto px-10 py-3.5 bg-gradient-to-r from-sky-400 to-indigo-500 hover:from-sky-300 hover:to-indigo-400 text-slate-950 font-black font-mono text-xs tracking-wider uppercase rounded-xl transition-all shadow-md"
                  id="btn_over_replay"
                >
                  YANGI O'YIN BOSHLASH
                </button>
              </div>
            </motion.div>
          )}

        </AnimatePresence>
      </main>

      {/* Tutorial drawer slide-in panel */}
      {showTutorial && (
        <div className="fixed inset-0 bg-slate-950/85 backdrop-blur-md z-50 flex items-center justify-center p-4" id="tutorial_screen_modal">
          <div className="bg-slate-900 border border-slate-800 max-w-lg w-full rounded-2xl p-6 shadow-2xl relative">
            <h3 className="text-lg font-bold text-white mb-3 font-mono flex items-center space-x-2 border-b border-slate-800 pb-3">
              <HelpCircle className="w-5 h-5 text-sky-400" />
              <span>O'yin Qoidalari va Yo'riqnomasi</span>
            </h3>
            
            <div className="space-y-4 text-xs text-slate-300 leading-relaxed text-left">
              <div>
                <span className="font-bold text-sky-400 font-mono text-xs uppercase block">Maqsad:</span>
                <p className="mt-0.5">O'yin tennisining analogi hisoblanadi. Raketiya bilan to'pni raqib tarafiga yo'naltiring, uning unutilmas zanjirli ball bounce effectlariga moslashib, birinchi bo'lib <strong className="text-slate-100">11 ochko</strong> to'plang!</p>
              </div>

              <div>
                <span className="font-bold text-indigo-400 font-mono text-xs uppercase block">Boshqaruv tugmalari va qahramonlar:</span>
                <ul className="list-disc pl-4 space-y-1 mt-1 font-sans text-xs">
                  <li>Sichqoncha yoki sensorni yuqoriga va pastga hovuzda harakatlantirish orqali o'zingizning tennischingiz paddle plitasini boshqarishingiz mumkin.</li>
                  <li>Keyboard bilan harakatlanish uchun <kbd className="bg-slate-950 border border-slate-800 px-1 py-0.5 text-slate-300 font-mono">W</kbd> / <kbd className="bg-slate-950 border border-slate-800 px-1 py-0.5 text-slate-300 font-mono">↑</kbd> va <kbd className="bg-slate-950 border border-slate-800 px-1 py-0.5 text-slate-300 font-mono">S</kbd> / <kbd className="bg-slate-950 border border-slate-800 px-1 py-0.5 text-slate-300 font-mono">↓</kbd> tugmalaridan foydalaning.</li>
                  <li>Xizmat koʻrsatish (to'pni serve qilish) uchun esa ekran ustidagi <strong className="text-amber-400">SERVIS ETISH</strong> tugmasini bosing yoki <kbd className="bg-slate-950 border border-slate-800 px-1 py-0.5 text-slate-300 font-mono">Space</kbd> / <kbd className="bg-slate-950 border border-slate-800 px-1 py-0.5 text-slate-300 font-mono">Enter</kbd> tugmasiga bosing.</li>
                </ul>
              </div>

              <div>
                <span className="font-bold text-amber-500 font-mono text-xs uppercase block">Ichki Kiyim Uslublari (Lingerie Themes):</span>
                <p className="mt-0.5">O'yindagi har bir qizaloq chiroyli ichki kiyim kiyimiga va maxsus harakatlanish statistik ko'rsatkichlariga ega. Moslashtirilgan kiyimlar sizga yuqori sifatli va zamonaviy anime grafika uslubini hadya etadi.</p>
              </div>
            </div>

            <button
              onClick={() => {
                setShowTutorial(false);
                triggerSound('select');
              }}
              className="mt-6 w-full py-2.5 bg-slate-950 border border-slate-800 hover:border-slate-700 hover:bg-slate-850 font-mono text-xs uppercase rounded-xl transition-all text-slate-300"
            >
              Tushunarli
            </button>
          </div>
        </div>
      )}

      {/* Modern Footer bar */}
      <footer className="py-4 border-t border-slate-900 bg-slate-950/40 font-mono text-[10px] text-slate-600 text-center relative z-10" id="app_footer_bottom">
        <p>© 2026 Tennis Arena Championship. Barcha huquqlar himoyalangan. Cyber stylized interactive build.</p>
      </footer>

    </div>
  );
}
