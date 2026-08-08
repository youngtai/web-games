/* ============================================================
   SHIP
   ============================================================ */
function createShip(x, y) {
  return {
    x: x || G.W / 2, y: y || G.H / 2,
    vx: 0, vy: 0,
    angle: -Math.PI / 2,
    invulnEnd: Infinity, // set to G.now + INVULNERABLE_TIME in respawnShip
    thrusting: false,
    r: SHIP_SIZE
  };
}

function respawnShip(player) {
  const slots = [
    [0.35, 0.45],
    [0.65, 0.45],
    [0.35, 0.62],
    [0.65, 0.62],
  ];
  const slot = slots[player.id - 1] || [0.5, 0.5];
  const x = G.W * slot[0];
  const y = G.H * slot[1];
  player.ship = createShip(x, y);
  const now = performance.now() / 1000;
  player.ship.invulnEnd = now + INVULNERABLE_TIME;
  player.lastFire = now;
  player.alive = true;
}

/* ============================================================
   UPDATE
   ============================================================ */
function updateShip(player, dt) {
  const s = player.ship;
  if (!s) return;

  const k = player.keys;

  const controls = PLAYER_CONFIGS[player.id - 1].keys;
  const kbLeft  = k[controls.left];
  const kbRight = k[controls.right];
  const kbUp    = k[controls.thrust];
  const kbFire  = controls.fire.some(code => k[code]);

  // --- Rotation ---
  if (player.targetAngleSet) {
    // Gamepad steering: smoothly rotate toward target angle
    // Shortest path across the -PI..PI boundary
    let delta = player.targetAngle - s.angle;
    while (delta > Math.PI)  delta -= 2 * Math.PI;
    while (delta < -Math.PI) delta += 2 * Math.PI;
    const turnSpeed = SHIP_TURN_SPEED / 180 * Math.PI * dt;
    if (Math.abs(delta) < turnSpeed) {
      s.angle = player.targetAngle;
    } else {
      s.angle += Math.sign(delta) * turnSpeed;
    }
  } else {
    // Keyboard steering
    if (kbLeft || player.gpLeft)  s.angle -= SHIP_TURN_SPEED / 180 * Math.PI * dt;
    if (kbRight || player.gpRight) s.angle += SHIP_TURN_SPEED / 180 * Math.PI * dt;
  }

  // --- Thrust ---
  s.thrusting = !!(kbUp || player.gpUp || player.gpThrust);
  if (s.thrusting) {
    s.vx += Math.cos(s.angle) * SHIP_THRUST * dt;
    s.vy += Math.sin(s.angle) * SHIP_THRUST * dt;
    const backX = s.x - Math.cos(s.angle) * SHIP_SIZE * 0.6;
    const backY = s.y - Math.sin(s.angle) * SHIP_SIZE * 0.6;
    spawnThrustTrail(backX, backY, s.angle);
    if (Math.random() < 0.5) spawnThrustTrail(backX, backY, s.angle);
  }

  // --- Friction & speed cap ---
  const fric = Math.exp(-SHIP_FRICTION * dt * 60);
  s.vx *= fric; s.vy *= fric;

  const spd = Math.hypot(s.vx, s.vy);
  if (spd > MAX_SPEED) { s.vx *= MAX_SPEED / spd; s.vy *= MAX_SPEED / spd; }

  if (G.now >= s.invulnEnd) {
    applyBlackHoleForces(s, dt, { maxSpeed: MAX_SPEED * 1.35 });
  }

  // --- Position ---
  s.x += s.vx * dt;
  s.y += s.vy * dt;
  wrap(s);

  // --- Special missile (gamepad left trigger) ---
  if (player.gpSpecial && player.specialMissiles > 0 && G.now - player.lastSpecial >= SPECIAL_MISSILE_FIRE_RATE) {
    spawnPlayerMissile(player);
    player.specialMissiles--;
    player.lastSpecial = G.now;
    rumble(player, 0.4, 0.7, 90);
  }

  // --- Firing (keyboard OR gamepad) ---
  const fire = !!(kbFire || player.gpFire);
  const rapidLevel = player.hasRapid ? Math.max(1, player.rapidLevel || 1) : 0;
  const rapidMult = rapidLevel ? Math.max(0.2, 0.5 - rapidLevel * 0.1) : 1;
  const fireRate = FIRE_RATE * rapidMult;
  if (fire && G.now - player.lastFire >= fireRate) {
    playSound('shoot');
    player.lastFire = G.now;
    const tipX = s.x + Math.cos(s.angle) * SHIP_SIZE;
    const tipY = s.y + Math.sin(s.angle) * SHIP_SIZE;
    const baseVx = Math.cos(s.angle) * BULLET_SPEED + s.vx * 0.3;
    const baseVy = Math.sin(s.angle) * BULLET_SPEED + s.vy * 0.3;
    const laserLevel = activeLaserLevel(player);
    const isLaser = laserLevel > 0;
    const isBigger = player.hasBigger;
    const bulletR = isLaser ? 3 + laserLevel * 2 : (isBigger ? 4 : 3);
    const bColor = player.color;

    const makeBullet = (bx, by, bvx, bvy) => ({
      x: bx, y: by, vx: bvx, vy: bvy,
      r: bulletR, life: BULLET_LIFE,
      laser: isLaser,
      laserLevel,
      damage: isLaser ? laserLevel : 1,
      owner: player.id,
      color: bColor
    });

    G.bullets.push(makeBullet(tipX, tipY, baseVx, baseVy));

    const hasMode = (m) => player.weaponModes.indexOf(m) !== -1;

    if (hasMode('dual')) {
      const perpX = -Math.sin(s.angle) * 10;
      const perpY = Math.cos(s.angle) * 10;
      G.bullets.push(makeBullet(tipX + perpX, tipY + perpY, baseVx, baseVy));
      G.bullets.push(makeBullet(tipX - perpX, tipY - perpY, baseVx, baseVy));
    }
    if (hasMode('spread')) {
      for (const off of [-0.2, 0.2]) {
        const a = s.angle + off;
        G.bullets.push(makeBullet(tipX, tipY,
          Math.cos(a) * BULLET_SPEED + s.vx * 0.3,
          Math.sin(a) * BULLET_SPEED + s.vy * 0.3));
      }
    }
  }
}
