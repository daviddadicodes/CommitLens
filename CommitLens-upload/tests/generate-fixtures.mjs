import { readFile, writeFile } from 'node:fs/promises';

const args = process.argv.slice(2);
const { default: synthesize } = await import(args.find(arg => !arg.startsWith('--')) || 'espeak-ng');
const dialogue = JSON.parse(await readFile(new URL('dialogue.json', import.meta.url), 'utf8'));
const rate = 12000;
const voices = { Maya: 'en-us+f3', Jordan: 'en-us+m3', Nina: 'en-us+f3', Owen: 'en-us+m3', Anna: 'en-us+f3', Ben: 'en-us+m3' };
const cache = new Map();

async function turn(speaker, text) {
  const key = speaker + '/' + text;
  if (cache.has(key)) return cache.get(key);
  const engine = await synthesize({ arguments: ['-v', voices[speaker], '-s', '154', '-w', 'turn.wav', text] });
  const wav = Buffer.from(engine.FS.readFile('turn.wav'));
  const inputRate = wav.readUInt32LE(24);
  if (wav.toString('ascii', 36, 40) !== 'data' || wav.readUInt16LE(22) !== 1 || wav.readUInt16LE(34) !== 16) {
    throw new Error('Unexpected synthesizer WAV format.');
  }
  const inputCount = (wav.length - 44) / 2;
  const count = Math.floor(inputCount * rate / inputRate);
  const output = Buffer.alloc(count * 2);
  for (let i = 0; i < count; i++) {
    const sourceIndex = Math.min(inputCount - 1, Math.floor(i * inputRate / rate));
    output.writeInt16LE(wav.readInt16LE(44 + sourceIndex * 2), i * 2);
  }
  cache.set(key, output);
  return output;
}

async function writeFixture(name, lines) {
  const chunks = [];
  for (const [speaker, text] of lines) {
    chunks.push(await turn(speaker, text), Buffer.alloc(rate * 2 * 0.3));
  }
  const data = Buffer.concat(chunks);
  const header = Buffer.alloc(44);
  header.write('RIFF', 0);
  header.writeUInt32LE(data.length + 36, 4);
  header.write('WAVEfmt ', 8);
  header.writeUInt32LE(16, 16);
  header.writeUInt16LE(1, 20);
  header.writeUInt16LE(1, 22);
  header.writeUInt32LE(rate, 24);
  header.writeUInt32LE(rate * 2, 28);
  header.writeUInt16LE(2, 32);
  header.writeUInt16LE(16, 34);
  header.write('data', 36);
  header.writeUInt32LE(data.length, 40);
  await writeFile(new URL(name + '.wav', import.meta.url), Buffer.concat([header, data]));
  console.log(name + '.wav', (data.length / (rate * 2)).toFixed(2) + ' s');
}

const standalone = ['fresh', 'holdout'].find(name => args.includes('--' + name));
if (standalone) {
  const lines = JSON.parse(await readFile(new URL(standalone + '-dialogue.json', import.meta.url), 'utf8'));
  await writeFixture(standalone, lines);
} else {
  const variant = [...dialogue.baseline];
  variant[dialogue.variant.index] = dialogue.variant.line;
  await writeFixture('baseline', dialogue.baseline);
  await writeFixture('variant', variant);
  await writeFixture('ambiguous', dialogue.ambiguous);
}
