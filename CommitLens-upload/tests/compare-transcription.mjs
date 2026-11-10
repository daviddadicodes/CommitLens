import { readFile, writeFile } from 'node:fs/promises';

const key = process.env.OPENAI_API_KEY?.trim();
if (!key) throw new Error('Set OPENAI_API_KEY to run this comparison.');

const results = {};
for (const name of ['fresh', 'holdout']) {
  const bytes = await readFile(new URL(name + '.wav', import.meta.url));
  const form = new FormData();
  form.append('file', new Blob([bytes], { type: 'audio/wav' }), name + '.wav');
  form.append('model', 'gpt-transcribe');
  const start = performance.now();
  const response = await fetch('https://api.openai.com/v1/audio/transcriptions', {
    method: 'POST', headers: { Authorization: 'Bearer ' + key }, body: form
  });
  if (!response.ok) {
    results[name] = { status: response.status };
    console.log(name, 'HTTP', response.status);
    continue;
  }
  const data = await response.json();
  results[name] = { seconds: (performance.now() - start) / 1000, text: data.text, usage: data.usage ?? null };
  console.log(name, JSON.stringify(results[name]));
}
await writeFile(new URL('transcription-comparison.json', import.meta.url), JSON.stringify(results, null, 2) + '\n');
