# AI usage

- OpenAI Codex generated the implementation, prompts, fictional dialogue and documentation from the user brief. The authoring model identifier was unavailable in the workspace.
- `gpt-4o-transcribe-diarize` supplies timestamped segments and anonymous speaker labels. [Model reference](https://developers.openai.com/api/docs/models/gpt-4o-transcribe-diarize)
- `gpt-4.1-mini-2025-04-14` powers structured extraction and the separate review pass. [Model reference](https://developers.openai.com/api/docs/models/gpt-4.1-mini)
- eSpeak NG (`espeak-ng@1.0.2`) synthesized fictional fixture voices offline. React, TypeScript, Vite, Ajv, Web Audio and Node standard APIs supply the UI, toolchain and runtime primitives.

Original work includes the upload and evidence player, prompts, grounding checks, review workflow, and evaluator. The first generated request used `audio/wav`. Checking Vercel's Node runtime docs showed that its binary body helper supplies a Buffer for `application/octet-stream`. I switched the client and endpoint to that transport and retained the server-side WAV header check. The local HTTP test covers the revised transport. [Vercel Node runtime](https://vercel.com/docs/functions/runtimes/node-js)
