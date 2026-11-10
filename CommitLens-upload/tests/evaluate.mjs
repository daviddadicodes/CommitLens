import { readFile, writeFile } from 'node:fs/promises';
import { processRecording } from '../server/process.mjs';

const modes = ['clear', 'fresh', 'holdout'].filter(mode => process.argv.includes('--' + mode));
if (modes.length > 1) throw new Error('Choose one fixture set.');
const [mode] = modes;
const standalone = mode === 'fresh' || mode === 'holdout';
const expected = JSON.parse(await readFile(new URL(standalone ? mode + '-expected.json' : 'expected.json', import.meta.url), 'utf8'));
const inputDirectory = new URL(mode === 'clear' ? 'clear/' : './', import.meta.url);
const output = new URL(mode ? 'actual-' + mode + '-results.json' : 'actual-results.json', import.meta.url);
const key = process.env.OPENAI_API_KEY?.trim();
if (!key) {
  console.error('Live evaluation skipped. Set OPENAI_API_KEY in .env and rerun npm run evaluate.');
  process.exit(2);
}

function matches(item, rule) {
  return new RegExp(rule.match, 'i').test(item.title) && [rule.status].flat().includes(item.status);
}

function assess(result, scenario) {
  const { items, transcript, duration } = result;
  const unclaimed = new Set(items);
  const falseNegatives = [];
  const fieldErrors = [];
  let trueActive = 0;
  let ownerCorrect = 0;
  let deadlineCorrect = 0;
  for (const rule of scenario.items) {
    const item = [...unclaimed].find(row => matches(row, rule));
    if (!item) {
      falseNegatives.push(rule);
      continue;
    }
    unclaimed.delete(item);
    if (item.status === 'active') trueActive++;
    if ('owner' in rule) {
      if (item.owner === rule.owner) ownerCorrect++;
      else fieldErrors.push({ item: item.title, field: 'owner', expected: rule.owner, actual: item.owner });
    }
    if ('deadline' in rule) {
      if (item.deadline?.toLowerCase() === rule.deadline.toLowerCase() &&
          item.deadlineStatus === rule.deadlineStatus && item.date === null) deadlineCorrect++;
      else fieldErrors.push({ item: item.title, field: 'deadline', expected: [rule.deadline, rule.deadlineStatus, null],
        actual: [item.deadline, item.deadlineStatus, item.date] });
    }
    if (rule.history && (item.history.length < 2 || new Set(item.history.flatMap(step => step.evidence.map(clip => clip.segmentId))).size < 2)) {
      fieldErrors.push({ item: item.title, field: 'history', expected: 'Separate earlier and later evidence' });
    }
  }
  for (const rule of scenario.optional ?? []) {
    const item = [...unclaimed].find(row => matches(row, rule));
    if (item) unclaimed.delete(item);
  }
  const falsePositives = [...unclaimed].map(({ title, status }) => ({ title, status }));
  const evidenceErrors = [];
  let clipsChecked = 0;
  function check(clip, title) {
    const segment = transcript.find(s => s.id === clip.segmentId);
    clipsChecked++;
    if (!segment?.text.includes(clip.quote) || !clip.quote.trim() || clip.speaker !== segment.speaker ||
        clip.start !== segment.start || clip.end !== segment.end || clip.start < 0 || clip.end > duration || clip.end <= clip.start) {
      evidenceErrors.push({ title, clip });
    }
  }
  for (const item of items) {
    if (!item.evidence.length) evidenceErrors.push({ title: item.title, error: 'Missing evidence' });
    for (const clip of [...item.evidence, ...item.history.flatMap(step => step.evidence)]) check(clip, item.title);
  }
  for (const person of result.speakers) check(person.intro, person.name);
  return {
    trueActive,
    unsupportedActive: falsePositives.filter(row => row.status === 'active').length,
    cancelledRetainedAsActive: items.filter(row => row.status === 'active' &&
      scenario.items.some(rule => rule.status === 'cancelled' && new RegExp(rule.match, 'i').test(row.title))).length,
    ownerCorrect,
    ownerExpected: scenario.items.filter(rule => 'owner' in rule).length,
    deadlineCorrect,
    deadlineExpected: scenario.items.filter(rule => 'deadline' in rule).length,
    unresolvedOrAmbiguousFound: scenario.items.filter(rule => [rule.status].flat().some(s => s === 'open' || s === 'clarification') &&
      !falseNegatives.includes(rule)).length,
    clipsChecked, falsePositives, falseNegatives, fieldErrors, evidenceErrors
  };
}

const runs = {};
let failed = false;
for (const [name, spec] of Object.entries(expected)) {
  const scenario = spec.from ? {
    items: expected[spec.from].items.map((item, i) => i === spec.change.index ? { ...item, deadline: spec.change.deadline } : item)
  } : spec;
  try {
    const bytes = await readFile(new URL(name + '.wav', inputDirectory));
    const started = performance.now();
    const result = await processRecording(bytes, { key });
    const score = assess(result, scenario);
    runs[name] = { elapsedSeconds: (performance.now() - started) / 1000, score, result };
    failed ||= [score.falsePositives, score.falseNegatives, score.fieldErrors, score.evidenceErrors].some(errors => errors.length);
    console.log(name, JSON.stringify({ ...score, metrics: result.metrics }, null, 2));
  } catch (error) {
    failed = true;
    runs[name] = { error: error.message };
    console.error(name + ' failed: ' + error.message);
  }
}
await writeFile(output, JSON.stringify(runs, null, 2) + '\n');
if (failed) process.exitCode = 1;
