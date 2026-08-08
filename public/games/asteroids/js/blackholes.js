/* ============================================================
   BLACK HOLES
   ============================================================ */
function blackHoleTargetCount() {
  const bonus = Math.floor(roundDifficultyTier() / BLACK_HOLE_ROUND_STEP);
  return Math.min(BLACK_HOLE_MAX_COUNT, BLACK_HOLE_BASE_COUNT + bonus);
}

function blackHoleStrength() {
  return 1 + roundDifficultyTier() * BLACK_HOLE_ROUND_STRENGTH;
}

function blackHoleVector(bh, obj) {
  let dx = bh.x - obj.x;
  let dy = bh.y - obj.y;
  if (Math.abs(dx) > G.W / 2) dx -= Math.sign(dx) * G.W;
  if (Math.abs(dy) > G.H / 2) dy -= Math.sign(dy) * G.H;
  const d = Math.hypot(dx, dy) || 1;
  return { dx, dy, d };
}

function randomBlackHoleSpawnCandidate() {
  const side = randInt(0, 3);
  let x, y;
  if (side === 0) {
    x = rand(0, G.W); y = -BLACK_HOLE_EVENT_RADIUS;
  } else if (side === 1) {
    x = G.W + BLACK_HOLE_EVENT_RADIUS; y = rand(0, G.H);
  } else if (side === 2) {
    x = rand(0, G.W); y = G.H + BLACK_HOLE_EVENT_RADIUS;
  } else {
    x = -BLACK_HOLE_EVENT_RADIUS; y = rand(0, G.H);
  }

  const targetX = G.W / 2 + rand(-G.W * 0.25, G.W * 0.25);
  const targetY = G.H / 2 + rand(-G.H * 0.25, G.H * 0.25);
  const angle = Math.atan2(targetY - y, targetX - x) + rand(-0.45, 0.45);
  return { x, y, angle };
}

function blackHoleSpawnIsSafe(candidate) {
  const probe = { x: candidate.x, y: candidate.y };
  const blockers = [
    ...G.players.filter(p => p.alive && p.ship).map(p => p.ship),
    ...G.ufos
  ];

  return blockers.every(obj => {
    const safeDistance = BLACK_HOLE_GRAVITY_RADIUS + (obj.r || SHIP_SIZE) + 80;
    return blackHoleVector(probe, obj).d > safeDistance;
  });
}

function spawnBlackHole() {
  let candidate = randomBlackHoleSpawnCandidate();
  for (let i = 0; i < 24 && !blackHoleSpawnIsSafe(candidate); i++) {
    candidate = randomBlackHoleSpawnCandidate();
  }

  const strength = blackHoleStrength();
  G.blackHoles.push({
    x: candidate.x, y: candidate.y,
    vx: Math.cos(candidate.angle) * BLACK_HOLE_SPEED,
    vy: Math.sin(candidate.angle) * BLACK_HOLE_SPEED,
    mass: 1,
    r: BLACK_HOLE_RADIUS,
    eventR: BLACK_HOLE_EVENT_RADIUS,
    gravityR: BLACK_HOLE_GRAVITY_RADIUS,
    strength,
    spin: rand(-1, 1) < 0 ? -1 : 1,
    phase: rand(0, Math.PI * 2)
  });
}

function maintainBlackHoles() {
  const target = blackHoleTargetCount();
  while (G.blackHoles.length < target) spawnBlackHole();
  while (G.blackHoles.length > target) G.blackHoles.pop();
}

function capObjectSpeed(obj, maxSpeed) {
  if (!maxSpeed) return;
  const spd = Math.hypot(obj.vx || 0, obj.vy || 0);
  if (spd > maxSpeed) {
    obj.vx = (obj.vx / spd) * maxSpeed;
    obj.vy = (obj.vy / spd) * maxSpeed;
  }
}

function blackHoleForceFactors(bh, distance) {
  const fieldDepth = Math.max(
    0,
    Math.min(1, (bh.gravityR - distance) / Math.max(1, bh.gravityR - bh.eventR))
  );
  const innerDepth = Math.max(
    0,
    Math.min(1, (bh.eventR * BLACK_HOLE_INNER_PULL_RADIUS_MULT - distance) / Math.max(1, bh.eventR * BLACK_HOLE_INNER_PULL_RADIUS_MULT))
  );

  const curvedPull = Math.pow(fieldDepth, BLACK_HOLE_PULL_CURVE);
  const innerPull = Math.pow(innerDepth, 3) * BLACK_HOLE_INNER_PULL_BOOST;
  const pullFactor = fieldDepth * 0.1 + curvedPull * 1.55 + innerPull;
  const bendFactor = Math.pow(fieldDepth, 1.45) * (1 - innerDepth * 0.35);

  return { pullFactor, bendFactor };
}

function applyBlackHoleForces(obj, dt, opts) {
  if (!obj || !Number.isFinite(obj.x) || !Number.isFinite(obj.y)) return;
  if (!Number.isFinite(obj.vx)) obj.vx = 0;
  if (!Number.isFinite(obj.vy)) obj.vy = 0;

  for (const bh of G.blackHoles) {
    const v = blackHoleVector(bh, obj);
    if (v.d >= bh.gravityR) continue;

    const nx = v.dx / v.d;
    const ny = v.dy / v.d;
    const force = blackHoleForceFactors(bh, v.d);
    const pull = BLACK_HOLE_PULL * bh.strength * force.pullFactor;
    const bend = BLACK_HOLE_BEND * bh.strength * force.bendFactor * bh.spin;
    obj.vx += (nx * pull - ny * bend) * dt;
    obj.vy += (ny * pull + nx * bend) * dt;
  }

  capObjectSpeed(obj, opts && opts.maxSpeed);
}

function applyBlackHoleMutualGravity(dt) {
  for (let i = 0; i < G.blackHoles.length; i++) {
    const a = G.blackHoles[i];
    for (let j = i + 1; j < G.blackHoles.length; j++) {
      const b = G.blackHoles[j];
      const v = blackHoleVector(a, b);
      if (v.d >= Math.max(a.gravityR, b.gravityR)) continue;

      const nx = v.dx / v.d;
      const ny = v.dy / v.d;
      const depth = 1 - v.d / Math.max(a.gravityR, b.gravityR);
      const pull = BLACK_HOLE_MUTUAL_PULL * depth * depth;
      const aMass = a.mass || 1;
      const bMass = b.mass || 1;
      a.vx -= nx * pull * (bMass / aMass) * dt;
      a.vy -= ny * pull * (bMass / aMass) * dt;
      b.vx += nx * pull * (aMass / bMass) * dt;
      b.vy += ny * pull * (aMass / bMass) * dt;
    }
  }
}

function mergeBlackHolePair(absorber, absorbed) {
  const aMass = absorber.mass || 1;
  const bMass = absorbed.mass || 1;
  const totalMass = aMass + bMass;
  const v = blackHoleVector(absorber, absorbed);
  const absorbedX = absorber.x - v.dx;
  const absorbedY = absorber.y - v.dy;

  absorber.x = (absorber.x * aMass + absorbedX * bMass) / totalMass;
  absorber.y = (absorber.y * aMass + absorbedY * bMass) / totalMass;
  absorber.vx = (absorber.vx * aMass + absorbed.vx * bMass) / totalMass;
  absorber.vy = (absorber.vy * aMass + absorbed.vy * bMass) / totalMass;
  absorber.mass = totalMass;
  absorber.strength = Math.max(absorber.strength, absorbed.strength) + absorbed.strength * BLACK_HOLE_MERGE_STRENGTH_GAIN;
  absorber.spin = Math.abs(aMass * absorber.spin + bMass * absorbed.spin) < 0.1
    ? absorber.spin
    : Math.sign(aMass * absorber.spin + bMass * absorbed.spin);
  absorber.phase = (absorber.phase + absorbed.phase) * 0.5;
  wrap(absorber);

  blackHoleConsumeEffect(absorber.x, absorber.y, '#8cf');
  G.particles.push({
    x: absorber.x, y: absorber.y, vx: 0, vy: 0,
    life: 0.8, maxLife: 0.8,
    color: '#fff',
    size: absorber.eventR * 1.8,
    type: PT.RING
  });
  G.shakeMag = Math.min(G.shakeMag + 10 + totalMass * 2, 28);
}

function mergeBlackHoles() {
  for (let i = G.blackHoles.length - 1; i >= 0; i--) {
    const a = G.blackHoles[i];
    for (let j = i - 1; j >= 0; j--) {
      const b = G.blackHoles[j];
      const mergeDistance = (a.eventR + b.eventR) * BLACK_HOLE_MERGE_DISTANCE_MULT;
      if (blackHoleVector(a, b).d > mergeDistance) continue;

      const absorber = (a.mass || 1) >= (b.mass || 1) ? a : b;
      const absorbed = absorber === a ? b : a;
      mergeBlackHolePair(absorber, absorbed);
      G.blackHoles.splice(G.blackHoles.indexOf(absorbed), 1);
      break;
    }
  }
}

function blackHoleConsumeEffect(x, y, color) {
  spawnParticles(x, y, 6, color || '#8cf', 110, 0.35);
  G.particles.push({
    x, y, vx: 0, vy: 0,
    life: 0.35, maxLife: 0.35,
    color: color || '#8cf',
    size: 34,
    type: PT.RING
  });
}

function consumedBlackHoleMass(obj, type) {
  if (type === 'ship') return 1.0;
  if (type === 'ufo') return obj && obj.isBoss ? 6.0 : 1.15;
  if (type === 'asteroid') {
    if (!obj) return 0.4;
    if (obj.sizeKey === 'LARGE') return 1.0;
    if (obj.sizeKey === 'MEDIUM') return 0.45;
    return 0.18;
  }
  if (type === 'playerMissile') return 0.32;
  if (type === 'enemyMissile') return 0.2;
  if (type === 'bullet') return obj && obj.laser ? 0.025 : 0.04;
  if (type === 'powerup') return 0.25;
  return 0.1;
}

function strengthenBlackHoleFromConsumption(bh, obj, type) {
  if (!bh) return;
  const gainedMass = consumedBlackHoleMass(obj, type) * BLACK_HOLE_CONSUMED_MASS_SCALE;
  bh.mass = (bh.mass || 1) + gainedMass;
  bh.strength += gainedMass * BLACK_HOLE_CONSUME_STRENGTH_GAIN;
}

function insideEventHorizon(obj, radiusScale) {
  for (const bh of G.blackHoles) {
    const extra = (obj.r || 0) * (radiusScale || 0);
    if (blackHoleVector(bh, obj).d < bh.eventR + extra) return bh;
  }
  return null;
}

function consumeBlackHoleObjects() {
  for (const player of G.players) {
    if (!player.alive || !player.ship) continue;
    const s = player.ship;
    if (G.now < s.invulnEnd) continue;
    const bh = insideEventHorizon(s, 0.35);
    if (!bh) continue;

    strengthenBlackHoleFromConsumption(bh, s, 'ship');
    player.deaths++;
    playSound('shipHit');
    spawnExplosion(s.x, s.y, player.color || '#f44', true);
    G.shakeMag = Math.min(G.shakeMag + 18, 24);
    rumble(player, 0.6, 0.9, 130);
    player.ship = null;
    player.alive = false;
  }

  for (let i = G.asteroids.length - 1; i >= 0; i--) {
    const a = G.asteroids[i];
    const bh = insideEventHorizon(a, 0.25);
    if (bh) {
      strengthenBlackHoleFromConsumption(bh, a, 'asteroid');
      blackHoleConsumeEffect(a.x, a.y, a.isPowerup && a.puType ? POWERUPS[a.puType].color : '#aaa');
      G.asteroids.splice(i, 1);
    }
  }

  for (let i = G.ufos.length - 1; i >= 0; i--) {
    const u = G.ufos[i];
    const bh = insideEventHorizon(u, 0.2);
    if (bh) {
      strengthenBlackHoleFromConsumption(bh, u, 'ufo');
      if (u.isBoss) {
        destroyUfo(u, null, i);
      } else {
        blackHoleConsumeEffect(u.x, u.y, '#8cf');
        G.ufos.splice(i, 1);
      }
    }
  }

  for (let i = G.missiles.length - 1; i >= 0; i--) {
    const m = G.missiles[i];
    const bh = insideEventHorizon(m, 0.5);
    if (bh) {
      strengthenBlackHoleFromConsumption(bh, m, 'enemyMissile');
      blackHoleConsumeEffect(m.x, m.y, '#f84');
      G.missiles.splice(i, 1);
    }
  }

  for (let i = G.playerMissiles.length - 1; i >= 0; i--) {
    const m = G.playerMissiles[i];
    const bh = insideEventHorizon(m, 0.5);
    if (bh) {
      strengthenBlackHoleFromConsumption(bh, m, 'playerMissile');
      blackHoleConsumeEffect(m.x, m.y, m.color || '#f44');
      G.playerMissiles.splice(i, 1);
    }
  }

  for (let i = G.bullets.length - 1; i >= 0; i--) {
    const b = G.bullets[i];
    const bh = insideEventHorizon(b, 1.5);
    if (bh) {
      strengthenBlackHoleFromConsumption(bh, b, 'bullet');
      blackHoleConsumeEffect(b.x, b.y, b.color || '#fff');
      G.bullets.splice(i, 1);
    }
  }

  for (let i = G.powerups.length - 1; i >= 0; i--) {
    const pu = G.powerups[i];
    const bh = insideEventHorizon(pu, 1.0);
    if (bh) {
      strengthenBlackHoleFromConsumption(bh, pu, 'powerup');
      blackHoleConsumeEffect(pu.x, pu.y, POWERUPS[pu.type].color);
      G.powerups.splice(i, 1);
    }
  }
}

function updateBlackHoles(dt) {
  maintainBlackHoles();
  applyBlackHoleMutualGravity(dt);

  for (const bh of G.blackHoles) {
    capObjectSpeed(bh, BLACK_HOLE_SPEED * 1.9);
    bh.x += bh.vx * dt;
    bh.y += bh.vy * dt;
    bh.phase += dt * bh.spin * 1.8;
    wrap(bh);
  }

  mergeBlackHoles();
  consumeBlackHoleObjects();
}

function drawBlackHole(bh, t) {
  const ctx = G.ctx;
  const pulse = 0.5 + 0.5 * Math.sin(t * 2 + bh.phase);

  ctx.save();
  ctx.translate(bh.x, bh.y);
  ctx.rotate(bh.phase);

  ctx.strokeStyle = `rgba(90,190,255,${0.16 + pulse * 0.08})`;
  ctx.lineWidth = 1.5;
  for (let i = 0; i < 3; i++) {
    const r = bh.eventR + (i + 1) * ((bh.gravityR - bh.eventR) / 3);
    ctx.beginPath();
    ctx.ellipse(0, 0, r, r * (0.88 + i * 0.04), i * 0.45, 0, Math.PI * 2);
    ctx.stroke();
  }

  ctx.strokeStyle = `rgba(210,245,255,${0.34 + pulse * 0.18})`;
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.arc(0, 0, bh.eventR, 0, Math.PI * 2);
  ctx.stroke();

  ctx.strokeStyle = `rgba(255,120,70,${0.5 + pulse * 0.25})`;
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.ellipse(0, 0, bh.eventR * 1.25, bh.eventR * 0.38, 0, 0, Math.PI * 1.6);
  ctx.stroke();

  const grad = ctx.createRadialGradient(0, 0, 0, 0, 0, bh.eventR);
  grad.addColorStop(0, '#000');
  grad.addColorStop(0.55, '#000');
  grad.addColorStop(1, 'rgba(20,70,110,0.9)');
  ctx.fillStyle = grad;
  ctx.beginPath();
  ctx.arc(0, 0, bh.eventR * 0.84, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = '#000';
  ctx.beginPath();
  ctx.arc(0, 0, bh.r, 0, Math.PI * 2);
  ctx.fill();

  ctx.restore();
}
