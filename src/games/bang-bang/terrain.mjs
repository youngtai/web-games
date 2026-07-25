const clamp = (value, min, max) => Math.max(min, Math.min(max, value));

const smootherStep = (value) => {
  const bounded = clamp(value, 0, 1);
  return bounded * bounded * bounded * (bounded * (bounded * 6 - 15) + 10);
};

export function generateTerrain({ points = 501, random = Math.random } = {}) {
  const terrain = [];
  const baseHeight = 512 + random() * 10;
  const peakX = 0.38 + random() * 0.24;
  const peakHeight = 220 + random() * 110;
  const peakWidth = 0.07 + random() * 0.06;
  const shoulderDirection = random() < 0.5 ? -1 : 1;
  const shoulderX = clamp(peakX + shoulderDirection * (0.1 + random() * 0.14), 0.28, 0.72);
  const shoulderHeight = 35 + random() * 90;
  const shoulderWidth = 0.07 + random() * 0.09;
  const rippleAmplitude = 5 + random() * 10;
  const rippleFrequency = 2 + random() * 2.5;
  const ripplePhase = random() * Math.PI * 2;
  const detailPhase = random() * Math.PI * 2;

  for (let index = 0; index < points; index += 1) {
    const x = index / (points - 1);
    const peak = Math.exp(-((x - peakX) ** 2) / (2 * peakWidth ** 2)) * peakHeight;
    const shoulder = Math.exp(-((x - shoulderX) ** 2) / (2 * shoulderWidth ** 2)) * shoulderHeight;
    const ripple =
      Math.sin(x * Math.PI * 2 * rippleFrequency + ripplePhase) * rippleAmplitude +
      Math.sin(x * Math.PI * 9 + detailPhase) * 3;
    const leftBlend = smootherStep((x - 0.13) / 0.12);
    const rightBlend = smootherStep((0.87 - x) / 0.12);
    const playableBlend = leftBlend * rightBlend;

    terrain.push(clamp(baseHeight - (peak + shoulder + ripple) * playableBlend, 175, 525));
  }

  return terrain;
}

export function carveTerrain(
  terrain,
  impactX,
  impactY,
  {
    worldWidth = 1000,
    radius = 42,
    maxHeight = 548,
    maxSlopePerSample = 8,
    settleDistance = 52,
  } = {}
) {
  const result = [...terrain];
  const sampleWidth = worldWidth / (terrain.length - 1);
  const centerIndex = clamp(Math.round(impactX / sampleWidth), 0, terrain.length - 1);
  const craterStart = clamp(Math.floor((impactX - radius) / sampleWidth), 0, terrain.length - 1);
  const craterEnd = clamp(Math.ceil((impactX + radius) / sampleWidth), 0, terrain.length - 1);

  // The terrain is a heightmap: everything below each value is solid earth.
  // Carve to one absolute circular floor so a hillside hit removes the impact
  // point and all unsupported soil above it instead of shifting whole columns.
  for (let index = craterStart; index <= craterEnd; index += 1) {
    const x = index * sampleWidth;
    const dx = Math.abs(x - impactX);
    if (dx >= radius) continue;
    const craterFloor = impactY + Math.sqrt(radius ** 2 - dx ** 2);
    result[index] = clamp(Math.max(result[index], craterFloor), 0, maxHeight);
  }

  // Let sharp unsupported lips fall outward from the crater. This keeps the
  // landscape single-valued (no tunnels or floating shelves) without
  // smoothing untouched terrain across the rest of the hill.
  const settleSamples = Math.ceil(settleDistance / sampleWidth);
  const leftLimit = Math.max(0, craterStart - settleSamples);
  const rightLimit = Math.min(terrain.length - 1, craterEnd + settleSamples);

  for (let index = centerIndex - 1; index >= leftLimit; index -= 1) {
    const supportedHeight = result[index + 1] - maxSlopePerSample;
    if (result[index] < supportedHeight) result[index] = supportedHeight;
  }

  for (let index = centerIndex + 1; index <= rightLimit; index += 1) {
    const supportedHeight = result[index - 1] - maxSlopePerSample;
    if (result[index] < supportedHeight) result[index] = supportedHeight;
  }

  return result;
}
