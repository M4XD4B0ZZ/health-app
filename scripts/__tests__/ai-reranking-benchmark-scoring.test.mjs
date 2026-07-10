import assert from 'node:assert/strict';
import test from 'node:test';
import {
  isValidPermutation,
  parseAndValidateResult,
  isCorrectWinner,
  computeCostUsd,
  summarizeProviderRuns,
} from '../lib/ai-reranking-benchmark-scoring.mjs';

test('isValidPermutation accepts a reordering of the same ids', () => {
  assert.equal(isValidPermutation(['a', 'b', 'c'], ['c', 'a', 'b']), true);
});

test('isValidPermutation rejects a missing id', () => {
  assert.equal(isValidPermutation(['a', 'b', 'c'], ['a', 'b']), false);
});

test('isValidPermutation rejects an unknown id', () => {
  assert.equal(isValidPermutation(['a', 'b'], ['a', 'z']), false);
});

test('isValidPermutation rejects a duplicate id', () => {
  assert.equal(isValidPermutation(['a', 'b'], ['a', 'a']), false);
});

test('parseAndValidateResult rejects invalid JSON', () => {
  const result = parseAndValidateResult('not json', ['a', 'b']);
  assert.equal(result.valid, false);
  assert.match(result.error, /invalid JSON/);
});

test('parseAndValidateResult rejects a response missing required fields', () => {
  const result = parseAndValidateResult(JSON.stringify({ reorderedCandidateIds: ['a', 'b'] }), [
    'a',
    'b',
  ]);
  assert.equal(result.valid, false);
  assert.match(result.error, /shape/);
});

test('parseAndValidateResult rejects a non-permutation reorder', () => {
  const result = parseAndValidateResult(
    JSON.stringify({ reorderedCandidateIds: ['a', 'unknown'], explanation: 'x' }),
    ['a', 'b'],
  );
  assert.equal(result.valid, false);
  assert.match(result.error, /permutation/);
});

test('parseAndValidateResult accepts a valid response', () => {
  const result = parseAndValidateResult(
    JSON.stringify({ reorderedCandidateIds: ['b', 'a'], explanation: 'b matches best' }),
    ['a', 'b'],
  );
  assert.equal(result.valid, true);
  assert.deepEqual(result.parsed.reorderedCandidateIds, ['b', 'a']);
});

test('isCorrectWinner checks the first ranked id', () => {
  assert.equal(isCorrectWinner({ reorderedCandidateIds: ['b', 'a'] }, 'b'), true);
  assert.equal(isCorrectWinner({ reorderedCandidateIds: ['a', 'b'] }, 'b'), false);
});

test('isCorrectWinner handles a missing/empty result', () => {
  assert.equal(isCorrectWinner(null, 'b'), false);
  assert.equal(isCorrectWinner({ reorderedCandidateIds: [] }, 'b'), false);
});

test('computeCostUsd multiplies token usage by the price table', () => {
  const cost = computeCostUsd(
    { inputTokens: 1_000_000, outputTokens: 1_000_000 },
    { inputPerMTok: 1, outputPerMTok: 5 },
  );
  assert.equal(cost, 6);
});

test('computeCostUsd returns null without usage or price data', () => {
  assert.equal(computeCostUsd(null, { inputPerMTok: 1, outputPerMTok: 5 }), null);
  assert.equal(computeCostUsd({ inputTokens: 1, outputTokens: 1 }, null), null);
});

test('summarizeProviderRuns aggregates accuracy, JSON validity, latency, and cost', () => {
  const summary = summarizeProviderRuns([
    { error: null, jsonValid: true, correct: true, latencyMs: 100, costUsd: 0.01 },
    { error: null, jsonValid: true, correct: false, latencyMs: 200, costUsd: 0.02 },
    { error: 'boom', jsonValid: false, correct: false, latencyMs: null, costUsd: null },
  ]);

  assert.equal(summary.total, 3);
  assert.equal(summary.errors, 1);
  assert.equal(summary.jsonValidRate, 2 / 3);
  assert.equal(summary.accuracy, 1 / 3);
  assert.equal(summary.avgLatencyMs, 150);
  assert.equal(summary.avgCostUsd, 0.015);
});

test('summarizeProviderRuns handles an empty run list', () => {
  const summary = summarizeProviderRuns([]);
  assert.equal(summary.total, 0);
  assert.equal(summary.jsonValidRate, null);
  assert.equal(summary.accuracy, null);
  assert.equal(summary.avgLatencyMs, null);
  assert.equal(summary.avgCostUsd, null);
});
