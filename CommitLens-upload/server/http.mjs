import { maxBytes, wavDuration } from './wav.mjs';
import { processRecording } from './process.mjs';

export async function handle(req, res) {
  const controller = new AbortController();
  res.on('close', () => controller.abort());
  try {
    if (req.method !== 'POST') {
      res.setHeader('Allow', 'POST');
      throw Object.assign(new Error('Use POST to process a recording.'), { status: 405 });
    }
    if (req.headers['content-type']?.split(';')[0] !== 'application/octet-stream') {
      throw Object.assign(new Error('Use the CommitLens uploader to send audio.'), { status: 415 });
    }
    if (Number(req.headers['content-length']) > maxBytes) {
      throw Object.assign(new Error('The processed audio is too large.'), { status: 413 });
    }
    // Vercel may expose a pre-parsed Buffer for binary requests.
    let bytes;
    if (Buffer.isBuffer(req.body)) bytes = req.body;
    else {
      const chunks = [];
      let length = 0;
      for await (const chunk of req.iterator({ destroyOnReturn: false })) {
        length += chunk.length;
        if (length > maxBytes) {
          req.resume();
          throw Object.assign(new Error('The processed audio is too large.'), { status: 413 });
        }
        chunks.push(chunk);
      }
      bytes = Buffer.concat(chunks, length);
    }
    wavDuration(bytes);
    if (!process.env.OPENAI_API_KEY?.trim()) {
      throw Object.assign(new Error('Analysis requires OPENAI_API_KEY on the server. You can still play the recording locally.'), { status: 503 });
    }
    res.setHeader('Content-Type', 'application/x-ndjson; charset=utf-8');
    res.setHeader('Cache-Control', 'no-store, no-transform');
    const send = message => res.write(JSON.stringify(message) + '\n');
    const result = await processRecording(bytes, {
      key: process.env.OPENAI_API_KEY,
      progress: stage => send({ stage }),
      signal: controller.signal
    });
    res.end(JSON.stringify({ result }) + '\n');
  } catch (error) {
    if (res.destroyed) return;
    const status = error.status ?? 502;
    if (!res.headersSent) {
      res.statusCode = status;
      res.setHeader('Content-Type', 'application/json; charset=utf-8');
      res.setHeader('Cache-Control', 'no-store');
    }
    const message = error.name === 'TimeoutError' ? 'Analysis timed out. Try again with a shorter recording.' :
      error instanceof TypeError ? 'The processing service could not be reached. Check connectivity and retry.' : error.message;
    res.end(JSON.stringify({ error: message }) + '\n');
  }
}
