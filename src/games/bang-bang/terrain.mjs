const clamp = (value, min, max) => Math.max(min, Math.min(max, value));

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
