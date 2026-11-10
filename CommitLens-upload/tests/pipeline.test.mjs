import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { once } from 'node:events';
import { readFile } from 'node:fs/promises';
import { test } from 'node:test';
import { segmentsFrom, ground, applyReview } from '../server/evidence.mjs';
import { checkExtraction } from '../server/schema.mjs';
import { handle } from '../server/http.mjs';
import { wavDuration } from '../server/wav.mjs';

const transcript = segmentsFrom([
  { start: 0, end: 1.1, text: 'I will send the file Thursday.', speaker: 'A' },
  { start: 1.2, end: 2.9, text: 'Agreed, I will send the file Friday instead.', speaker: 'A' },
  { start: 2.9, end: 8, text: 'Invalid timestamp.', speaker: 'B' }
], 3);
const evidence = { segmentId: 's2', quote: 'I will send the file Friday instead.', role: 'revision' };
const candidate = { title: 'Send file', owner: 'A', deadline: 'Friday', date: null, deadlineStatus: 'relative_unresolved',
  status: 'active', evidence: [evidence],
  history: [{ summary: 'Originally Thursday', evidence: [{ segmentId: 's1', quote: 'I will send the file Thursday.', role: 'statement' }] }] };

test('schema disallows missing and extra fields', () => {
  assert.equal(checkExtraction({ speakers: [], items: [candidate] }), true);
  assert.equal(checkExtraction({ speakers: [], items: [{ ...candidate, start: 1 }] }), false);
  assert.equal(checkExtraction({ speakers: [], items: [{ ...candidate, owner: undefined }] }), false);
});

test('evidence derives playable bounds from the cited segment and rejects mismatches', () => {
  assert.equal(transcript.length, 2);
  const data = ground({ speakers: [], items: [candidate, { ...candidate, evidence: [{ ...evidence, segmentId: 's1' }] },
    { ...candidate, date: '2026-11-09' }, { ...candidate, deadlineStatus: 'absolute', date: '2026-02-30' }] }, transcript);
  assert.equal(data.items.length, 1);
  assert.equal(data.rejected.length, 3);
  assert.deepEqual(data.items[0].evidence[0], { ...evidence, start: 1.2, end: 2.9, speaker: 'A' });
  assert.equal(data.items[0].history[0].evidence[0].start, 0);
});

test('unsupported and duplicate semantic verdicts are withheld', () => {
  const data = ground({ speakers: [], items: [candidate] }, transcript);
  const [item] = data.items;
  const yes = { id: item.id, supported: true };
  assert.equal(applyReview(data, { speakers: [], items: [yes] }).items.length, 1);
  assert.equal(applyReview(data, { speakers: [], items: [yes, yes] }).items.length, 0);
  assert.equal(applyReview(data, { speakers: [], items: [{ ...yes, supported: false }] }).rejected.length, 1);
});

test('all three recordings contain non-silent PCM and meet the duration limit', async () => {
  for (const name of ['baseline', 'variant', 'ambiguous']) {
    const bytes = await readFile(new URL(name + '.wav', import.meta.url));
    assert.ok(wavDuration(bytes) > 10 && wavDuration(bytes) < 180);
    assert.ok(bytes.subarray(44).some(sample => sample !== 0));
  }
});

test('HTTP endpoint reports input errors and missing credentials without calling OpenAI', async () => {
  const old = process.env.OPENAI_API_KEY;
  delete process.env.OPENAI_API_KEY;
  const server = createServer(handle).listen(0, '127.0.0.1');
  try {
    await once(server, 'listening');
    const url = 'http://127.0.0.1:' + server.address().port + '/api/process';
    assert.equal((await fetch(url)).status, 405);
    assert.equal((await fetch(url, { method: 'POST', body: 'bad' })).status, 415);
    assert.equal((await fetch(url, { method: 'POST', body: 'bad', headers: { 'Content-Type': 'application/octet-stream' } })).status, 400);
    const bytes = await readFile(new URL('baseline.wav', import.meta.url));
    const response = await fetch(url, { method: 'POST', body: bytes, headers: { 'Content-Type': 'application/octet-stream' } });
    assert.equal(response.status, 503);
    assert.match((await response.json()).error, /OPENAI_API_KEY/);
  } finally {
    server.close();
    if (old !== undefined) process.env.OPENAI_API_KEY = old;
  }
});

test('deadlines require primary evidence and absolute dates require a spoken year', () => {
  const data = ground({ speakers: [], items: [
    { ...candidate, deadline: 'relative_unresolved' },
    { ...candidate, deadline: 'Thursday' },
    { ...candidate, deadlineStatus: 'absolute', date: '2026-11-13' }
  ] }, transcript);
  assert.equal(data.items.length, 0);
  assert.equal(data.rejected.length, 3);
});
