export const extensions = /\.(wav|mp3|m4a|aac|ogg|opus|webm|flac|mp4)$/i;
export const maxSourceBytes = 64 * 1024 * 1024;

export async function prepare(file: File) {
  if (!extensions.test(file.name)) throw new Error('Choose a WAV, MP3, M4A, AAC, OGG, Opus, WebM, FLAC, or MP4 file.');
  if (!file.size || file.size > maxSourceBytes) throw new Error('Choose a nonempty audio file under 64 MiB.');
  const context = new AudioContext();
  try {
    let decoded: AudioBuffer;
    try {
      decoded = await context.decodeAudioData(await file.arrayBuffer());
    } catch {
      throw new Error('This browser could not decode the recording. Try exporting it as MP3 or WAV.');
    }
    if (decoded.duration > 180 || decoded.duration <= 0) throw new Error('Choose a recording that is three minutes or shorter.');
    const rate = 12000;
    const offline = new OfflineAudioContext(1, Math.max(1, Math.floor(decoded.duration * rate)), rate);
    const source = offline.createBufferSource();
    source.buffer = decoded;
    source.connect(offline.destination);
    source.start();
    const samples = (await offline.startRendering()).getChannelData(0);
    const bytes = new ArrayBuffer(44 + samples.length * 2);
    const view = new DataView(bytes);
    const ascii = (offset: number, value: string) => [...value].forEach((char, i) => view.setUint8(offset + i, char.charCodeAt(0)));
    ascii(0, 'RIFF');
    view.setUint32(4, bytes.byteLength - 8, true);
    ascii(8, 'WAVEfmt ');
    view.setUint32(16, 16, true);
    view.setUint16(20, 1, true);
    view.setUint16(22, 1, true);
    view.setUint32(24, rate, true);
    view.setUint32(28, rate * 2, true);
    view.setUint16(32, 2, true);
    view.setUint16(34, 16, true);
    ascii(36, 'data');
    view.setUint32(40, samples.length * 2, true);
    samples.forEach((sample, i) => {
      const clamped = Math.min(1, Math.max(-1, sample));
      view.setInt16(44 + i * 2, clamped * (clamped < 0 ? 32768 : 32767), true);
    });
    return { file, bytes, duration: decoded.duration };
  } finally {
    await context.close();
  }
}
