export const maxSeconds = 180;
export const maxBytes = 4_400_000;

// The processing endpoint accepts the canonical PCM WAV produced by the client.
export function wavDuration(bytes) {
  if (bytes.length < 46 || bytes.length > maxBytes ||
      bytes.toString('ascii', 0, 4) !== 'RIFF' || bytes.toString('ascii', 8, 16) !== 'WAVEfmt ' ||
      bytes.readUInt32LE(4) !== bytes.length - 8 || bytes.readUInt32LE(16) !== 16 ||
      bytes.readUInt16LE(20) !== 1 || bytes.readUInt16LE(22) !== 1 ||
      bytes.readUInt32LE(24) !== 12000 || bytes.readUInt32LE(28) !== 24000 ||
      bytes.readUInt16LE(32) !== 2 || bytes.readUInt16LE(34) !== 16 ||
      bytes.toString('ascii', 36, 40) !== 'data' ||
      bytes.readUInt32LE(40) !== bytes.length - 44 || (bytes.length - 44) % 2 !== 0) {
    throw Object.assign(new Error('Expected a mono 12 kHz PCM WAV from the CommitLens uploader.'), { status: 400 });
  }
  const seconds = (bytes.length - 44) / 24000;
  if (seconds > maxSeconds) throw Object.assign(new Error('The recording exceeds three minutes.'), { status: 413 });
  return seconds;
}
