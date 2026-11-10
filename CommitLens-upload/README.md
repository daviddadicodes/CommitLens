# CommitLens

CommitLens turns short English project meetings into a record of agreed work, decisions, cancellations, open questions, and unaccepted proposals. Each result links to playable evidence in the original recording. Owners and dates stay unresolved where the recording leaves them open.

## Run locally

Use Node.js 22 (Node 20.20 also works). Copy `.env.example` to `.env` and set `OPENAI_API_KEY` to an OpenAI project key with billing and model access. Then run:

```sh
npm ci
npm run build
npm start
```

Open [CommitLens on localhost](http://127.0.0.1:4173) and upload `tests/baseline.wav`. Without a key, local audio playback still works. Set `PORT` in `.env` to change the port. Keep the key on the server. Use `npm run dev` for Vite source serving, `npm run typecheck` and `npm test` for offline checks, and `npm run evaluate` to run the live fixture suite. The evaluator writes `tests/actual-results.json`.

## Architecture

- `src/` contains React, TypeScript, plain CSS, and Web Audio. The browser validates supported audio up to three minutes and 64 MiB, keeps the original file for playback, and sends a time-aligned mono 12 kHz PCM WAV. Support for WAV, MP3, M4A, AAC, OGG, Opus, WebM, FLAC, and MP4 depends on the browser's codecs.
- `server/` validates the canonical WAV, transcribes with `gpt-4o-transcribe-diarize`, extracts structured results with `gpt-4.1-mini-2025-04-14`, checks response schemas with Ajv, and attaches evidence timestamps from the source segments. A separate structured model pass reviews whether the clips support each final state and withholds unsupported candidates.
- `api/process.mjs` exposes the same Node handler on Vercel. It streams processing stages and returns measured timing and estimated cost. The app keeps no database or audio store. Analysis sends the normalized audio and transcript data to OpenAI.
- `tests/` contains fictional dialogue, generated audio, independently written expectations, the live evaluator and local tests.

Timestamp precision is at the transcript segment level. Short quotations can play with neighboring words. Audio quality and overlapping speech can affect names and evidence. The separate model review can share extraction errors. OpenAI lists the diarization model as deprecated with a February 26, 2027 shutdown. [OpenAI file transcription guide](https://developers.openai.com/api/docs/guides/speech-to-text)

## Deploy on Vercel

Push this directory to a GitHub repository, then import it into Vercel using the Vite preset and Node 22. Set `OPENAI_API_KEY` in the deployment environment. Use Fluid Compute with a function duration allowance of 300 seconds. The included configuration builds to `dist/` and exposes `/api/process`. A three-minute normalized recording occupies 4,320,044 bytes and fits the documented request limit. Verify the endpoint using a fixture before sharing it. For reviewer-only access, restrict the deployment at the hosting layer because the app endpoint is unauthenticated. [Vercel Functions limits](https://vercel.com/docs/functions/limitations)

On the restricted Windows verification host, Vite development dependency optimization could not read an ancestor directory. The built local server was verified and is the documented quick start.

On Windows, the local launcher detects AVG Web Shield's local certificate at its standard location and adds it to Node's trusted certificates for the child process. This allows HTTPS verification when AVG scans encrypted connections. Restart the local server after changing the key.
