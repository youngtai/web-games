import { Link } from '@tanstack/react-router';
import { Volume2, VolumeX } from 'lucide-react';
import { useCallback, useEffect, useRef, useState } from 'react';
import { carveTerrain } from '../games/bang-bang/terrain.mjs';

const WORLD_WIDTH = 1000;
const WORLD_HEIGHT = 600;
const GRAVITY = 250;
const WIN_SCORE = 3;
const MAX_ANGLE = 90;

const clamp = (value, min, max) => Math.max(min, Math.min(max, value));
const terrainAt = (terrain, x) =>
  terrain[clamp(Math.round((x / WORLD_WIDTH) * (terrain.length - 1)), 0, terrain.length - 1)];

function makeTerrain(round = 1) {
  const points = 501;
  const terrain = [];
  const peakX = 0.43 + ((round * 37) % 13) / 100;
  const peakHeight = 245 + ((round * 53) % 75);

  for (let index = 0; index < points; index += 1) {
    const x = index / (points - 1);
    const mountain = Math.exp(-((x - peakX) ** 2) / 0.018) * peakHeight;
    const shoulder = Math.exp(-((x - (peakX + 0.17)) ** 2) / 0.045) * 55;
    const ripple = Math.sin(x * Math.PI * 5 + round) * 10 + Math.sin(x * Math.PI * 11) * 4;
    const protectedEdge = x < 0.14 || x > 0.86 ? 0 : ripple;
    terrain.push(clamp(520 - mountain - shoulder - protectedEdge, 175, 525));
  }

  return terrain;
}

function makeGame(mode = 'cpu', scores = [0, 0], round = 1) {
  const terrain = makeTerrain(round);
  return {
    mode: 'playing',
    playMode: mode,
    round,
    scores,
    terrain,
    turn: round % 2 === 0 ? 1 : 0,
    angle: [48, 48],
    power: [28, 28],
    cannonX: [76, WORLD_WIDTH - 76],
    charging: false,
    chargeDirection: 1,
    destroyedPlayer: null,
    pendingMode: null,
    resultMessage: '',
    wind: Math.round((Math.random() * 2 - 1) * 18),
    projectile: null,
    particles: [],
    clouds: Array.from({ length: 7 }, (_, index) => ({
      x: ((index * 173 + round * 61) % 1120) - 60,
      y: 52 + ((index * 71) % 145),
      size: 0.7 + (index % 3) * 0.22,
      speed: 4 + (index % 4) * 1.6,
    })),
    shake: 0,
    flash: 0,
    message: round === 1 ? 'Take the first shot' : `Round ${round}`,
    resolveAt: 0,
    cpuAt: 0,
    lastUi: 0,
  };
}

function cannonPosition(game, player) {
  const x = game.cannonX[player];
  return { x, y: terrainAt(game.terrain, x) - 13 };
}

function createAudio() {
  let context = null;
  let muted = false;

  const getContext = () => {
    if (!context) context = new AudioContext();
    if (context.state === 'suspended') context.resume();
    return context;
  };

  const tone = (frequency, duration, type = 'square', volume = 0.08, slide = 0) => {
    if (muted) return;
    const audio = getContext();
    const oscillator = audio.createOscillator();
    const gain = audio.createGain();
    oscillator.type = type;
    oscillator.frequency.setValueAtTime(frequency, audio.currentTime);
    oscillator.frequency.exponentialRampToValueAtTime(
      Math.max(30, frequency + slide),
      audio.currentTime + duration
    );
    gain.gain.setValueAtTime(volume, audio.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, audio.currentTime + duration);
    oscillator.connect(gain).connect(audio.destination);
    oscillator.start();
    oscillator.stop(audio.currentTime + duration);
  };

  return {
    setMuted(value) {
      muted = value;
    },
    aim() {
      tone(180, 0.035, 'square', 0.025, 18);
    },
    fire() {
      tone(128, 0.18, 'sawtooth', 0.12, -82);
      window.setTimeout(() => tone(65, 0.16, 'square', 0.06, -24), 35);
    },
    impact() {
      tone(78, 0.32, 'sawtooth', 0.13, -48);
      tone(156, 0.12, 'square', 0.045, -90);
    },
    score() {
      tone(330, 0.14, 'square', 0.075, 110);
      window.setTimeout(() => tone(520, 0.24, 'triangle', 0.09, 180), 120);
    },
    win() {
      [262, 330, 392, 523].forEach((note, index) => {
        window.setTimeout(() => tone(note, 0.32, 'triangle', 0.08, 45), index * 115);
      });
    },
  };
}

function roundedRect(ctx, x, y, width, height, radius) {
  ctx.beginPath();
  ctx.roundRect(x, y, width, height, radius);
}

function drawCloud(ctx, cloud) {
  ctx.save();
  ctx.translate(cloud.x, cloud.y);
  ctx.scale(cloud.size, cloud.size);
  ctx.fillStyle = 'rgba(255,255,255,0.72)';
  ctx.beginPath();
  ctx.arc(-24, 4, 18, 0, Math.PI * 2);
  ctx.arc(0, -5, 25, 0, Math.PI * 2);
  ctx.arc(28, 3, 19, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = 'rgba(95,153,196,0.2)';
  ctx.fillRect(-37, 8, 80, 8);
  ctx.restore();
}

function drawBurnedFlag(ctx, position, player, now, reducedMotion) {
  const flicker = reducedMotion ? 0 : Math.sin(now * 0.018 + player * 2.1) * 3;
  const direction = player === 0 ? 1 : -1;

  ctx.save();
  ctx.translate(position.x, position.y + 16);
  ctx.fillStyle = 'rgba(7, 19, 24, 0.28)';
  ctx.beginPath();
  ctx.ellipse(0, 5, 31, 8, 0, 0, Math.PI * 2);
  ctx.fill();

  ctx.strokeStyle = '#2b2726';
  ctx.lineWidth = 6;
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(0, 1);
  ctx.lineTo(0, -68);
  ctx.stroke();

  ctx.fillStyle = '#332b2a';
  ctx.beginPath();
  ctx.moveTo(direction * 2, -64);
  ctx.lineTo(direction * 46, -55 + flicker * 0.35);
  ctx.lineTo(direction * 31, -39 - flicker * 0.2);
  ctx.lineTo(direction * 19, -46);
  ctx.lineTo(direction * 2, -39);
  ctx.closePath();
  ctx.fill();
  ctx.strokeStyle = '#130f0e';
  ctx.lineWidth = 2;
  ctx.stroke();

  const flames = [
    { x: direction * 10, y: -40, size: 17, phase: 0 },
    { x: direction * 29, y: -47, size: 14, phase: 1.8 },
    { x: direction * 4, y: -5, size: 20, phase: 3.4 },
  ];
  for (const flame of flames) {
    const sway = reducedMotion ? 0 : Math.sin(now * 0.024 + flame.phase) * 4;
    ctx.fillStyle = 'rgba(255,92,31,0.88)';
    ctx.beginPath();
    ctx.moveTo(flame.x - flame.size * 0.48, flame.y);
    ctx.quadraticCurveTo(
      flame.x - flame.size * 0.16 + sway,
      flame.y - flame.size * 1.25,
      flame.x + sway,
      flame.y - flame.size * 1.62
    );
    ctx.quadraticCurveTo(
      flame.x + flame.size * 0.54,
      flame.y - flame.size * 0.64,
      flame.x + flame.size * 0.44,
      flame.y
    );
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = '#ffd95b';
    ctx.beginPath();
    ctx.moveTo(flame.x - flame.size * 0.2, flame.y);
    ctx.quadraticCurveTo(
      flame.x + sway * 0.35,
      flame.y - flame.size * 0.86,
      flame.x + flame.size * 0.22,
      flame.y
    );
    ctx.closePath();
    ctx.fill();
  }

  if (!reducedMotion) {
    for (let index = 0; index < 3; index += 1) {
      const drift = (now * (0.012 + index * 0.002) + index * 17) % 44;
      ctx.fillStyle = `rgba(47,54,54,${0.24 - index * 0.045})`;
      ctx.beginPath();
      ctx.arc(
        direction * (9 + index * 5) + Math.sin(now * 0.01 + index) * 6,
        -60 - drift,
        6 + index * 2,
        0,
        Math.PI * 2
      );
      ctx.fill();
    }
  }
  ctx.restore();
}

function drawCannon(ctx, game, player, now, reducedMotion) {
  const position = cannonPosition(game, player);
  if (game.destroyedPlayer === player) {
    drawBurnedFlag(ctx, position, player, now, reducedMotion);
    return;
  }
  const direction = player === 0 ? 1 : -1;
  const radians = (game.angle[player] * Math.PI) / 180;
  const color = player === 0 ? '#ffdc5e' : '#ff6b72';
  const dark = player === 0 ? '#795817' : '#792b3c';

  ctx.save();
  ctx.translate(position.x, position.y);
  ctx.fillStyle = 'rgba(8,28,40,0.28)';
  ctx.beginPath();
  ctx.ellipse(0, 14, 34, 8, 0, 0, Math.PI * 2);
  ctx.fill();

  ctx.rotate(direction === 1 ? -radians : radians);
  ctx.fillStyle = dark;
  roundedRect(ctx, direction === 1 ? -2 : -42, -7, 44, 14, 5);
  ctx.fill();
  ctx.fillStyle = color;
  roundedRect(ctx, direction === 1 ? 3 : -37, -4, 36, 8, 3);
  ctx.fill();
  ctx.restore();

  ctx.save();
  ctx.translate(position.x, position.y);
  ctx.fillStyle = color;
  roundedRect(ctx, -24, -4, 48, 21, 7);
  ctx.fill();
  ctx.fillStyle = dark;
  ctx.beginPath();
  ctx.arc(-15, 16, 8, 0, Math.PI * 2);
  ctx.arc(15, 16, 8, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = 'rgba(255,255,255,0.72)';
  ctx.lineWidth = 2;
  ctx.stroke();
  ctx.restore();

  if (game.turn === player && !game.projectile && game.mode === 'playing') {
    ctx.save();
    ctx.strokeStyle = 'rgba(255,255,255,0.88)';
    ctx.lineWidth = 2;
    ctx.setLineDash([3, 9]);
    ctx.beginPath();
    const speed = game.power[player] * 6.4;
    for (let step = 0; step < 22; step += 1) {
      const time = step * 0.075;
      const x =
        position.x + direction * Math.cos(radians) * speed * time + 0.5 * game.wind * time * time;
      const y = position.y - Math.sin(radians) * speed * time + 0.5 * GRAVITY * time * time;
      if (step === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.stroke();
    ctx.restore();
  }
}

function drawScene(ctx, game, now, reducedMotion) {
  ctx.save();
  if (!reducedMotion && game.shake > 0) {
    ctx.translate((Math.random() - 0.5) * game.shake, (Math.random() - 0.5) * game.shake);
  }

  const sky = ctx.createLinearGradient(0, 0, 0, WORLD_HEIGHT);
  sky.addColorStop(0, '#176cb0');
  sky.addColorStop(0.54, '#67c9e8');
  sky.addColorStop(1, '#e8f4cf');
  ctx.fillStyle = sky;
  ctx.fillRect(0, 0, WORLD_WIDTH, WORLD_HEIGHT);

  const sunGlow = ctx.createRadialGradient(825, 92, 8, 825, 92, 78);
  sunGlow.addColorStop(0, 'rgba(255,246,174,0.95)');
  sunGlow.addColorStop(0.35, 'rgba(255,219,96,0.55)');
  sunGlow.addColorStop(1, 'rgba(255,219,96,0)');
  ctx.fillStyle = sunGlow;
  ctx.fillRect(740, 7, 170, 170);
  ctx.fillStyle = '#fff2a7';
  ctx.beginPath();
  ctx.arc(825, 92, 31, 0, Math.PI * 2);
  ctx.fill();

  for (const cloud of game.clouds) drawCloud(ctx, cloud);

  ctx.fillStyle = 'rgba(29,94,126,0.25)';
  ctx.beginPath();
  ctx.moveTo(0, 420);
  for (let x = 0; x <= WORLD_WIDTH; x += 20) {
    ctx.lineTo(x, 400 - Math.sin(x * 0.014) * 35 - Math.sin(x * 0.031) * 14);
  }
  ctx.lineTo(WORLD_WIDTH, WORLD_HEIGHT);
  ctx.lineTo(0, WORLD_HEIGHT);
  ctx.fill();

  const ground = ctx.createLinearGradient(0, 260, 0, WORLD_HEIGHT);
  ground.addColorStop(0, '#55b94c');
  ground.addColorStop(0.45, '#25843c');
  ground.addColorStop(1, '#145331');
  ctx.fillStyle = ground;
  ctx.beginPath();
  ctx.moveTo(0, game.terrain[0]);
  game.terrain.forEach((height, index) => {
    ctx.lineTo((index / (game.terrain.length - 1)) * WORLD_WIDTH, height);
  });
  ctx.lineTo(WORLD_WIDTH, WORLD_HEIGHT);
  ctx.lineTo(0, WORLD_HEIGHT);
  ctx.closePath();
  ctx.fill();

  ctx.strokeStyle = '#b6ea66';
  ctx.lineWidth = 5;
  ctx.beginPath();
  game.terrain.forEach((height, index) => {
    const x = (index / (game.terrain.length - 1)) * WORLD_WIDTH;
    if (index === 0) ctx.moveTo(x, height);
    else ctx.lineTo(x, height);
  });
  ctx.stroke();

  ctx.globalAlpha = 0.14;
  ctx.strokeStyle = '#d7ff9c';
  ctx.lineWidth = 2;
  for (let y = 360; y < 610; y += 24) {
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(WORLD_WIDTH, y + 100);
    ctx.stroke();
  }
  ctx.globalAlpha = 1;

  drawCannon(ctx, game, 0, now, reducedMotion);
  drawCannon(ctx, game, 1, now, reducedMotion);

  if (game.projectile) {
    const projectile = game.projectile;
    projectile.trail.forEach((point, index) => {
      const alpha = (index / projectile.trail.length) * 0.55;
      ctx.fillStyle = `rgba(255,246,191,${alpha})`;
      ctx.beginPath();
      ctx.arc(point.x, point.y, 1 + index / projectile.trail.length, 0, Math.PI * 2);
      ctx.fill();
    });
    const glow = ctx.createRadialGradient(
      projectile.x,
      projectile.y,
      1,
      projectile.x,
      projectile.y,
      17
    );
    glow.addColorStop(0, '#fff');
    glow.addColorStop(0.25, '#ffe56d');
    glow.addColorStop(1, 'rgba(255,117,47,0)');
    ctx.fillStyle = glow;
    ctx.fillRect(projectile.x - 18, projectile.y - 18, 36, 36);
    ctx.fillStyle = '#1b2632';
    ctx.beginPath();
    ctx.arc(projectile.x, projectile.y, 5, 0, Math.PI * 2);
    ctx.fill();
  }

  for (const particle of game.particles) {
    const remaining = clamp(particle.life / particle.maxLife, 0, 1);
    ctx.globalAlpha = remaining;
    ctx.fillStyle = particle.color;
    ctx.beginPath();
    ctx.arc(particle.x, particle.y, particle.size * remaining, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.globalAlpha = 1;

  if (game.flash > 0) {
    ctx.fillStyle = `rgba(255,245,194,${game.flash * 0.32})`;
    ctx.fillRect(0, 0, WORLD_WIDTH, WORLD_HEIGHT);
  }

  ctx.fillStyle = 'rgba(4,20,31,0.55)';
  ctx.font = '700 14px Inter, system-ui, sans-serif';
  ctx.fillText(`FIELD ${String(game.round).padStart(2, '0')}`, 16, WORLD_HEIGHT - 18);
  ctx.textAlign = 'right';
  ctx.fillText(
    new Date(now).toLocaleTimeString([], { minute: '2-digit', second: '2-digit' }),
    984,
    WORLD_HEIGHT - 18
  );
  ctx.restore();
}

export function BangBangPage() {
  const canvasRef = useRef(null);
  const gameRef = useRef(makeGame());
  const frameRef = useRef(0);
  const commandRef = useRef({});
  const audioRef = useRef(null);
  const [muted, setMuted] = useState(false);
  const [snapshot, setSnapshot] = useState({
    mode: 'ready',
    playMode: 'cpu',
    round: 1,
    scores: [0, 0],
    turn: 0,
    angle: 48,
    power: 28,
    charging: false,
    wind: 0,
    message: 'Choose a duel',
  });

  if (!audioRef.current && typeof window !== 'undefined') audioRef.current = createAudio();

  const startGame = useCallback((playMode) => {
    gameRef.current = makeGame(playMode);
    setSnapshot({
      mode: 'playing',
      playMode,
      round: 1,
      scores: [0, 0],
      turn: gameRef.current.turn,
      angle: 48,
      power: 28,
      charging: false,
      wind: gameRef.current.wind,
      message: 'Take the first shot',
    });
  }, []);

  const toggleMuted = useCallback(() => {
    setMuted((current) => {
      audioRef.current?.setMuted(!current);
      return !current;
    });
  }, []);

  useEffect(() => {
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    let lastTime = performance.now();
    let cssWidth = 1;
    let cssHeight = 1;

    const resize = () => {
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      cssWidth = canvas.clientWidth;
      cssHeight = canvas.clientHeight;
      canvas.width = Math.round(cssWidth * dpr);
      canvas.height = Math.round(cssHeight * dpr);
      ctx.setTransform(
        (cssWidth / WORLD_WIDTH) * dpr,
        0,
        0,
        (cssHeight / WORLD_HEIGHT) * dpr,
        0,
        0
      );
    };

    const pushUi = (game, now, force = false) => {
      if (!force && now - game.lastUi < 80) return;
      game.lastUi = now;
      setSnapshot({
        mode: game.mode,
        playMode: game.playMode,
        round: game.round,
        scores: [...game.scores],
        turn: game.turn,
        angle: Math.round(game.angle[game.turn]),
        power: Math.round(game.power[game.turn]),
        charging: game.charging,
        wind: game.wind,
        message: game.message,
      });
    };

    const spawnImpact = (game, x, y, hit) => {
      const colors = hit
        ? ['#fff4a8', '#ffce52', '#ff6b47', '#3d2830']
        : ['#c8ff72', '#7cc74e', '#624d35', '#ffe27a'];
      const count = reducedMotion ? 16 : hit ? 70 : 42;
      for (let index = 0; index < count; index += 1) {
        const angle = Math.random() * Math.PI * 2;
        const speed = 45 + Math.random() * (hit ? 220 : 150);
        game.particles.push({
          x,
          y,
          vx: Math.cos(angle) * speed,
          vy: Math.sin(angle) * speed - 75,
          life: 0.45 + Math.random() * 0.8,
          maxLife: 1.25,
          size: 3 + Math.random() * 8,
          color: colors[index % colors.length],
        });
      }
      game.shake = reducedMotion ? 0 : hit ? 18 : 10;
      game.flash = hit ? 1 : 0.45;
    };

    const finishShot = (game, x, y, hitPlayer = -1) => {
      game.projectile = null;
      game.charging = false;
      audioRef.current?.impact();
      spawnImpact(game, x, y, hitPlayer >= 0);

      if (hitPlayer >= 0) {
        const scorer = hitPlayer === 0 ? 1 : 0;
        game.scores[scorer] += 1;
        game.destroyedPlayer = hitPlayer;
        audioRef.current?.score();
        if (game.scores[scorer] >= WIN_SCORE) {
          game.pendingMode = 'match-over';
          game.resultMessage = `${scorer === 0 ? 'Gold' : 'Red'} wins the match!`;
        } else {
          game.pendingMode = 'round-over';
          game.resultMessage = `${scorer === 0 ? 'Gold' : 'Red'} scores a direct hit!`;
        }
        game.mode = 'hit';
        game.message = 'Direct hit!';
        game.resolveAt = performance.now() + 1550;
      } else {
        game.turn = game.turn === 0 ? 1 : 0;
        game.power[game.turn] = 28;
        game.message =
          game.playMode === 'cpu' && game.turn === 1 ? 'CPU is calculating…' : 'Adjust your shot';
        if (game.playMode === 'cpu' && game.turn === 1) {
          game.cpuAt = performance.now() + 780;
        }
      }
      pushUi(game, performance.now(), true);
    };

    const fire = () => {
      const game = gameRef.current;
      if (game.mode !== 'playing' || game.projectile) return;
      if (game.playMode === 'cpu' && game.turn === 1 && !game.cpuAt) return;
      const player = game.turn;
      const position = cannonPosition(game, player);
      const radians = (game.angle[player] * Math.PI) / 180;
      const direction = player === 0 ? 1 : -1;
      const speed = game.power[player] * 6.4;
      game.projectile = {
        owner: player,
        x: position.x + direction * Math.cos(radians) * 40,
        y: position.y - Math.sin(radians) * 40,
        vx: direction * Math.cos(radians) * speed,
        vy: -Math.sin(radians) * speed,
        trail: [],
      };
      game.message = 'Shell away!';
      game.charging = false;
      game.cpuAt = 0;
      audioRef.current?.fire();
      pushUi(game, performance.now(), true);
    };

    const canPlayerControl = (game) =>
      game.mode === 'playing' && !game.projectile && !(game.playMode === 'cpu' && game.turn === 1);

    const adjustAngle = (amount) => {
      const game = gameRef.current;
      if (!canPlayerControl(game) || game.charging) return;
      game.angle[game.turn] = clamp(game.angle[game.turn] + amount, 12, MAX_ANGLE);
      game.message = 'Angle adjusted';
      audioRef.current?.aim();
      pushUi(game, performance.now(), true);
    };

    const moveCannon = (amount) => {
      const game = gameRef.current;
      if (!canPlayerControl(game) || game.charging) return;
      const player = game.turn;
      const minX = player === 0 ? 42 : 585;
      const maxX = player === 0 ? 415 : WORLD_WIDTH - 42;
      const currentX = game.cannonX[player];
      const nextX = clamp(currentX + amount, minX, maxX);
      const currentY = terrainAt(game.terrain, currentX);
      const nextY = terrainAt(game.terrain, nextX);
      if (Math.abs(nextY - currentY) > 17) {
        game.message = 'Too steep to move there';
      } else {
        game.cannonX[player] = nextX;
        game.message = 'Cannon moved';
      }
      pushUi(game, performance.now(), true);
    };

    const startCharge = () => {
      const game = gameRef.current;
      if (!canPlayerControl(game) || game.charging) return;
      game.power[game.turn] = 28;
      game.chargeDirection = 1;
      game.charging = true;
      game.message = 'Release to fire!';
      pushUi(game, performance.now(), true);
    };

    const releaseCharge = () => {
      const game = gameRef.current;
      if (!game.charging || !canPlayerControl(game)) return;
      game.charging = false;
      fire();
    };

    const newRound = () => {
      const current = gameRef.current;
      gameRef.current = makeGame(current.playMode, current.scores, current.round + 1);
      const game = gameRef.current;
      if (game.playMode === 'cpu' && game.turn === 1) game.cpuAt = performance.now() + 900;
      pushUi(game, performance.now(), true);
    };

    const restart = () => {
      const current = gameRef.current;
      gameRef.current = makeGame(current.playMode);
      pushUi(gameRef.current, performance.now(), true);
    };

    commandRef.current = { adjustAngle, moveCannon, newRound, releaseCharge, restart, startCharge };

    const cpuShoot = (game) => {
      const target = cannonPosition(game, 0);
      const origin = cannonPosition(game, 1);
      let best = { error: Number.POSITIVE_INFINITY, angle: 48, power: 66 };

      for (let angle = 24; angle <= 76; angle += 2) {
        for (let power = 38; power <= 100; power += 2) {
          const radians = (angle * Math.PI) / 180;
          let x = origin.x;
          let y = origin.y - 10;
          let vx = -Math.cos(radians) * power * 6.4;
          let vy = -Math.sin(radians) * power * 6.4;
          for (let step = 0; step < 240; step += 1) {
            const dt = 1 / 60;
            vx += game.wind * dt;
            vy += GRAVITY * dt;
            x += vx * dt;
            y += vy * dt;
            if (y >= terrainAt(game.terrain, x) || x < 0) break;
          }
          const error = Math.hypot(x - target.x, y - target.y);
          if (error < best.error) best = { error, angle, power };
        }
      }

      const accuracy = game.round < 3 ? 12 : 7.5;
      game.angle[1] = clamp(best.angle + (Math.random() - 0.5) * accuracy, 12, MAX_ANGLE);
      game.power[1] = clamp(best.power + (Math.random() - 0.5) * accuracy, 28, 100);
      fire();
    };

    const onKeyDown = (event) => {
      if (['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', 'Space'].includes(event.code)) {
        event.preventDefault();
      }
      if (event.code === 'ArrowLeft' || event.code === 'KeyA') moveCannon(-7);
      if (event.code === 'ArrowRight' || event.code === 'KeyD') moveCannon(7);
      if (event.code === 'ArrowUp' || event.code === 'KeyW') adjustAngle(2);
      if (event.code === 'ArrowDown' || event.code === 'KeyS') adjustAngle(-2);
      if (event.code === 'Space' && !event.repeat) startCharge();
      if (event.code === 'KeyR') restart();
      if (event.code === 'KeyN' && gameRef.current.mode === 'round-over') newRound();
    };

    const onKeyUp = (event) => {
      if (event.code === 'Space') {
        event.preventDefault();
        releaseCharge();
      }
    };

    let lastGamepad = 0;
    let gamepadFireHeld = false;
    const readGamepad = (now) => {
      const gamepad = Array.from(navigator.getGamepads?.() || []).find(Boolean);
      if (!gamepad) return;
      const firePressed = gamepad.buttons[0]?.pressed || gamepad.buttons[7]?.pressed;
      if (firePressed && !gamepadFireHeld) startCharge();
      if (!firePressed && gamepadFireHeld) releaseCharge();
      gamepadFireHeld = firePressed;
      if (now - lastGamepad < 130) return;
      const horizontal = gamepad.axes[0] || 0;
      const vertical = gamepad.axes[1] || 0;
      if (horizontal < -0.5 || gamepad.buttons[14]?.pressed) moveCannon(-7);
      else if (horizontal > 0.5 || gamepad.buttons[15]?.pressed) moveCannon(7);
      else if (vertical < -0.5 || gamepad.buttons[12]?.pressed) adjustAngle(2);
      else if (vertical > 0.5 || gamepad.buttons[13]?.pressed) adjustAngle(-2);
      else return;
      lastGamepad = now;
    };

    const update = (game, dt, now) => {
      for (const cloud of game.clouds) {
        cloud.x += (cloud.speed + game.wind * 0.08) * dt;
        if (cloud.x > 1090) cloud.x = -110;
        if (cloud.x < -120) cloud.x = 1080;
      }

      for (const particle of game.particles) {
        particle.vy += GRAVITY * 0.72 * dt;
        particle.x += particle.vx * dt;
        particle.y += particle.vy * dt;
        particle.life -= dt;
      }
      game.particles = game.particles.filter((particle) => particle.life > 0);
      game.shake = Math.max(0, game.shake - dt * 42);
      game.flash = Math.max(0, game.flash - dt * 3.4);

      if (game.mode === 'hit' && now >= game.resolveAt) {
        game.mode = game.pendingMode;
        game.message = game.resultMessage;
        if (game.mode === 'match-over') audioRef.current?.win();
        pushUi(game, now, true);
      }

      if (game.mode !== 'playing') return;
      if (game.charging) {
        game.power[game.turn] += game.chargeDirection * 58 * dt;
        if (game.power[game.turn] >= 100) {
          game.power[game.turn] = 100;
          game.chargeDirection = -1;
        } else if (game.power[game.turn] <= 28) {
          game.power[game.turn] = 28;
          game.chargeDirection = 1;
        }
        pushUi(game, now);
      }
      if (game.cpuAt && now >= game.cpuAt) cpuShoot(game);

      const projectile = game.projectile;
      if (!projectile) return;
      projectile.vx += game.wind * dt;
      projectile.vy += GRAVITY * dt;
      projectile.x += projectile.vx * dt;
      projectile.y += projectile.vy * dt;
      projectile.trail.push({ x: projectile.x, y: projectile.y });
      if (projectile.trail.length > 32) projectile.trail.shift();

      const opponent = projectile.owner === 0 ? 1 : 0;
      const target = cannonPosition(game, opponent);
      if (Math.hypot(projectile.x - target.x, projectile.y - target.y) < 29) {
        finishShot(game, target.x, target.y, opponent);
        return;
      }

      if (
        projectile.x < -30 ||
        projectile.x > WORLD_WIDTH + 30 ||
        projectile.y > WORLD_HEIGHT + 30
      ) {
        finishShot(game, clamp(projectile.x, 0, WORLD_WIDTH), clamp(projectile.y, 0, WORLD_HEIGHT));
        return;
      }

      if (
        projectile.x >= 0 &&
        projectile.x <= WORLD_WIDTH &&
        projectile.y >= terrainAt(game.terrain, projectile.x)
      ) {
        const impactX = projectile.x;
        const impactY = terrainAt(game.terrain, impactX);
        game.terrain = carveTerrain(game.terrain, impactX, impactY, {
          worldWidth: WORLD_WIDTH,
        });
        finishShot(game, impactX, impactY);
      }
    };

    const render = (now) => {
      const dt = Math.min((now - lastTime) / 1000, 0.035);
      lastTime = now;
      readGamepad(now);
      update(gameRef.current, dt, now);
      ctx.clearRect(0, 0, WORLD_WIDTH, WORLD_HEIGHT);
      drawScene(ctx, gameRef.current, now, reducedMotion);
      frameRef.current = requestAnimationFrame(render);
    };

    resize();
    window.addEventListener('resize', resize);
    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('keyup', onKeyUp);
    frameRef.current = requestAnimationFrame(render);

    return () => {
      cancelAnimationFrame(frameRef.current);
      window.removeEventListener('resize', resize);
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('keyup', onKeyUp);
    };
  }, []);

  const currentName =
    snapshot.playMode === 'cpu' && snapshot.turn === 1
      ? 'CPU'
      : snapshot.turn === 0
        ? 'Gold'
        : 'Red';
  const canControl =
    snapshot.mode === 'playing' && !(snapshot.playMode === 'cpu' && snapshot.turn === 1);

  return (
    <main className="game-route game-route--bang-bang">
      <canvas
        ref={canvasRef}
        className="bang-bang-canvas"
        aria-label="Artillery battlefield with two cannons and a mountain"
        role="img"
      />

      <nav className="game-chrome bang-bang-chrome" aria-label="Game navigation">
        <Link className="game-back" to="/">
          Games
        </Link>
        <span>Bang! Bang!</span>
        <button
          className={`bang-bang-sound ${muted ? 'is-muted' : ''}`}
          type="button"
          onClick={toggleMuted}
          aria-label={muted ? 'Turn sound on' : 'Mute sound'}
        >
          {muted ? <VolumeX aria-hidden="true" /> : <Volume2 aria-hidden="true" />}
        </button>
      </nav>

      <section className="bang-bang-score" aria-label="Match score">
        <div className={snapshot.turn === 0 ? 'is-active' : ''}>
          <span>Gold</span>
          <strong>{snapshot.scores[0]}</strong>
        </div>
        <p>
          Round {snapshot.round}
          <span>First to {WIN_SCORE}</span>
        </p>
        <div className={snapshot.turn === 1 ? 'is-active' : ''}>
          <strong>{snapshot.scores[1]}</strong>
          <span>{snapshot.playMode === 'cpu' ? 'CPU' : 'Red'}</span>
        </div>
      </section>

      {snapshot.mode !== 'ready' && (
        <section className="bang-bang-readout" aria-live="polite">
          <div>
            <span>Turn</span>
            <strong>{currentName}</strong>
          </div>
          <div>
            <span>Angle</span>
            <strong>{snapshot.angle}°</strong>
          </div>
          <div>
            <span>Power</span>
            <strong className={snapshot.charging ? 'is-charging' : ''}>{snapshot.power}</strong>
          </div>
          <div>
            <span>Wind</span>
            <strong>
              {snapshot.wind === 0
                ? 'Calm'
                : `${snapshot.wind > 0 ? '→' : '←'} ${Math.abs(snapshot.wind)}`}
            </strong>
          </div>
        </section>
      )}

      {canControl && (
        <section className="bang-bang-controls" aria-label="Cannon controls">
          <div className="bang-bang-control-pair">
            <button type="button" onClick={() => commandRef.current.moveCannon?.(-7)}>
              Move ←
            </button>
            <button type="button" onClick={() => commandRef.current.moveCannon?.(7)}>
              Move →
            </button>
          </div>
          <button
            type="button"
            className={`bang-bang-fire ${snapshot.charging ? 'is-charging' : ''}`}
            onPointerDown={(event) => {
              event.currentTarget.setPointerCapture(event.pointerId);
              commandRef.current.startCharge?.();
            }}
            onPointerUp={() => commandRef.current.releaseCharge?.()}
            onPointerCancel={() => commandRef.current.releaseCharge?.()}
            onContextMenu={(event) => event.preventDefault()}
            aria-label="Hold to charge power, then release to fire"
            style={{ '--charge-level': `${snapshot.power}%` }}
          >
            <span>{snapshot.charging ? 'Release!' : 'Hold'}</span>
            <small>Power</small>
          </button>
          <div className="bang-bang-control-pair">
            <button type="button" onClick={() => commandRef.current.adjustAngle?.(2)}>
              Aim ↑
            </button>
            <button type="button" onClick={() => commandRef.current.adjustAngle?.(-2)}>
              Aim ↓
            </button>
          </div>
        </section>
      )}

      {snapshot.mode === 'ready' && (
        <section className="bang-bang-overlay" aria-labelledby="bang-bang-title">
          <p className="bang-bang-kicker">The 1990 artillery classic, rebuilt</p>
          <h1 id="bang-bang-title">Bang! Bang!</h1>
          <p>
            Aim over the mountain, read the wind, and land three direct hits. Every miss reshapes
            the battlefield.
          </p>
          <div className="bang-bang-modes">
            <button type="button" onClick={() => startGame('cpu')}>
              <strong>Solo duel</strong>
              <span>Play against the CPU</span>
            </button>
            <button type="button" onClick={() => startGame('local')}>
              <strong>Two players</strong>
              <span>Pass the controls</span>
            </button>
          </div>
          <small>↑↓ aim · ←→ move · Hold Space for power, release to fire · Gamepad ready</small>
        </section>
      )}

      {snapshot.mode === 'round-over' && (
        <section className="bang-bang-overlay bang-bang-overlay--compact" aria-live="assertive">
          <p className="bang-bang-kicker">Direct hit</p>
          <h1>{snapshot.message}</h1>
          <button type="button" onClick={() => commandRef.current.newRound?.()}>
            Next round
          </button>
          <small>Press N to continue</small>
        </section>
      )}

      {snapshot.mode === 'match-over' && (
        <section className="bang-bang-overlay bang-bang-overlay--compact" aria-live="assertive">
          <p className="bang-bang-kicker">Match complete</p>
          <h1>{snapshot.message}</h1>
          <p>
            Final score {snapshot.scores[0]}–{snapshot.scores[1]}
          </p>
          <button type="button" onClick={() => commandRef.current.restart?.()}>
            Rematch
          </button>
          <small>Press R for a rematch</small>
        </section>
      )}

      {(snapshot.mode === 'playing' || snapshot.mode === 'hit') && (
        <p className="bang-bang-message" aria-live="polite">
          {snapshot.message}
        </p>
      )}
    </main>
  );
}
