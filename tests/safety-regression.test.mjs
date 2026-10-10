import test from 'node:test';
import assert from 'node:assert/strict';
import { assessKayakConditions } from '../src/kayak/KayakAssessment.ts';

const calm = {
  windSpeed: 8,
  windGusts: 12,
  windDirection: 180,
  waveHeight: 0.2,
  waveDirection: 180,
  wavePeriod: 8,
  swellHeight: 0.2,
  swellDirection: 180,
  swellPeriod: 8,
  currentVelocity: 0.2,
};

test('calm, complete marine data does not trigger a hard stop', () => {
  const result = assessKayakConditions(calm);
  assert.equal(result.hardStop, false);
  assert.equal(result.dataComplete, true);
  assert.ok(result.score >= 65);
});

test('dangerous wind gusts always trigger a hard stop and cap the score', () => {
  // Open-Meteo weather values are km/h in this app; 44.3 km/h exceeds the
  // conservative 30 km/h kayak stop threshold.
  const result = assessKayakConditions({ ...calm, windGusts: 44.3 });
  assert.equal(result.hardStop, true);
  assert.ok(result.score <= 44);
  assert.match(result.recommendation, /لا تخرج/);
});

test('dangerous waves cannot be averaged away by otherwise calm conditions', () => {
  const result = assessKayakConditions({ ...calm, waveHeight: 0.9 });
  assert.equal(result.hardStop, true);
  assert.ok(result.score <= 44);
});

test('missing safety data is explicitly incomplete and caps the score', () => {
  const result = assessKayakConditions({ ...calm, swellHeight: null });
  assert.equal(result.dataComplete, false);
  assert.ok(result.score <= 64);
  assert.match(result.recommendation, /غير مكتملة/);
});
