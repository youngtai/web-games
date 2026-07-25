import assert from 'node:assert/strict';
import test from 'node:test';
import { carveTerrain, generateTerrain } from './terrain.mjs';

const POINTS = 501;
const CENTER_INDEX = 250;

function seededRandom(seed) {
  let state = seed;
  return () => {
    state = (state * 1664525 + 1013904223) % 4294967296;
    return state / 4294967296;
  };
}

function assertLocalSettling(original, carved) {
  assert.ok(carved.every((height, index) => height >= original[index]));
  assert.equal(carved[180], original[180]);
  assert.equal(carved[320], original[320]);

  for (let index = 201; index <= 300; index += 1) {
    assert.ok(Math.abs(carved[index] - carved[index - 1]) <= 8.001);
  }
}

test('carves an absolute circular floor on flat ground', () => {
  const terrain = Array(POINTS).fill(400);
  const carved = carveTerrain(terrain, 500, 400);

  assert.equal(carved[CENTER_INDEX], 442);
  assertLocalSettling(terrain, carved);
});

test('settles an uphill impact without shearing the whole slope', () => {
  const terrain = Array.from({ length: POINTS }, (_, index) => 520 - index * 0.9);
  const impactY = terrain[CENTER_INDEX];
  const carved = carveTerrain(terrain, 500, impactY);

  assert.equal(carved[CENTER_INDEX], impactY + 42);
  assertLocalSettling(terrain, carved);
});

test('settles a downhill impact and supports repeated craters', () => {
  const terrain = Array.from({ length: POINTS }, (_, index) => 250 + index * 0.9);
  const first = carveTerrain(terrain, 500, terrain[CENTER_INDEX]);
  const second = carveTerrain(first, 500, first[CENTER_INDEX]);

  assert.equal(second[CENTER_INDEX], Math.min(terrain[CENTER_INDEX] + 84, 548));
  assert.ok(second.every((height, index) => height >= first[index]));
  assert.ok(second.every(Number.isFinite));
  assertLocalSettling(terrain, second);
});

test('generates different safe battlefields for new games', () => {
  const first = generateTerrain({ random: seededRandom(17) });
  const second = generateTerrain({ random: seededRandom(91) });

  assert.notDeepEqual(first, second);
  assert.equal(first.length, POINTS);
  assert.ok(first.every((height) => Number.isFinite(height) && height >= 175 && height <= 525));
  assert.ok(second.every((height) => Number.isFinite(height) && height >= 175 && height <= 525));

  for (let index = 0; index <= 65; index += 1) {
    assert.equal(first[index], first[0]);
    assert.equal(second[index], second[0]);
  }
  for (let index = 435; index < POINTS; index += 1) {
    assert.equal(first[index], first[POINTS - 1]);
    assert.equal(second[index], second[POINTS - 1]);
  }
});
