import { extraction, review, checkExtraction, checkReview } from './schema.mjs';
import { segmentsFrom, ground, applyReview } from './evidence.mjs';
import { extractPrompt, reviewPrompt } from './prompts.mjs';
import { wavDuration } from './wav.mjs';

const speechModel = 'gpt-4o-transcribe-diarize';
const textModel = 'gpt-4.1-mini-2025-04-14';

export async function processRecording(bytes, { key, progress = () => {}, signal } = {}) {
  const started = performance.now();
  const duration = wavDuration(bytes);
  if (!key?.trim()) throw Object.assign(new Error('Set OPENAI_API_KEY on the server to analyze recordings. Local audio playback is available now.'), { status: 503 });

  const metrics = { calls: 0, retries: 0, seconds: {}, costs: {}, usd: null, usdPerMinute: null };
  const runSignal = signal ? AbortSignal.any([signal, AbortSignal.timeout(265000)]) : AbortSignal.timeout(265000);
  async function request(path, body, json = false) {
    for (let attempt = 0; attempt < 2; attempt++) {
      runSignal.throwIfAborted();
      metrics.calls++;
      metrics.retries += attempt;
      const headers = { Authorization: 'Bearer ' + key };
      if (json) headers['Content-Type'] = 'application/json';
      const response = await fetch('https://api.openai.com/v1/' + path, {
        method: 'POST', headers, body: json ? JSON.stringify(body) : body, signal: runSignal
      });
      if (response.ok) return response.json();
      await response.body?.cancel();
      if (!attempt && [429, 502, 503, 504].includes(response.status)) {
        await new Promise(resolve => setTimeout(resolve, 1000));
        continue;
      }
      const messages = {
        401: 'OpenAI rejected the server API key. Check OPENAI_API_KEY.',
        403: 'The OpenAI project does not have access to the requested model.',
        404: 'An OpenAI model or endpoint is unavailable for this project.',
        429: 'OpenAI rate limit or quota reached. Check project billing and try again.'
      };
      throw new Error(messages[response.status] || 'OpenAI processing failed (HTTP ' + response.status + ').');
    }
  }

  function tokenCost(usage, rates) {
    const { input_tokens: input, output_tokens: output } = usage ?? {};
    if (!Number.isFinite(input) || !Number.isFinite(output)) return null;
    const cached = usage.input_tokens_details?.cached_tokens ?? 0;
    return ((input - cached) * rates[0] + output * rates[1] + cached * rates[2]) / 1e6;
  }

  async function structured(name, prompt, input, schema, check) {
    const response = await request('chat/completions', {
      model: textModel, temperature: 0, max_completion_tokens: 9000,
      messages: [{ role: 'system', content: prompt }, { role: 'user', content: JSON.stringify(input) }],
      response_format: { type: 'json_schema', json_schema: { name, strict: true, schema } }
    }, true);
    const choice = response.choices?.[0];
    if (choice?.finish_reason !== 'stop' || choice.message.refusal || !choice.message.content) {
      throw new Error('The analysis model could not complete a structured response. Try a shorter or clearer recording.');
    }
    const data = JSON.parse(choice.message.content);
    if (!check(data)) throw new Error('The analysis model returned invalid structured data.');
    const usage = response.usage;
    return { data, cost: tokenCost(usage && {
      input_tokens: usage.prompt_tokens, output_tokens: usage.completion_tokens,
      input_tokens_details: usage.prompt_tokens_details
    }, [0.40, 1.60, 0.10]) };
  }

  let stage = performance.now();
  const lap = name => {
    const now = performance.now();
    metrics.seconds[name] = (now - stage) / 1000;
    stage = now;
  };
  progress('transcription');
  const form = new FormData();
  form.append('file', new Blob([bytes], { type: 'audio/wav' }), 'recording.wav');
  form.append('model', speechModel);
  form.append('response_format', 'diarized_json');
  form.append('chunking_strategy', 'auto');
  form.append('language', 'en');
  const transcription = await request('audio/transcriptions', form);
  metrics.costs.transcription = tokenCost(transcription.usage, [2.5, 10, 2.5]);
  const segments = segmentsFrom(transcription.segments, duration);
  const transcript = [...segments].sort((a, b) => a.start - b.start);
  lap('transcription');
  progress('extraction');
  const extracted = transcript.length ? await structured('commitments', extractPrompt, { transcript }, extraction, checkExtraction) :
    { data: { speakers: [], items: [] }, cost: 0 };
  metrics.costs.extraction = extracted.cost;
  lap('extraction');
  progress('validation');
  const grounded = ground(extracted.data, transcript);
  const audited = grounded.items.length || grounded.speakers.length ?
    await structured('evidence_review', reviewPrompt, { transcript, speakers: grounded.speakers, items: grounded.items }, review, checkReview) :
    { data: { items: [], speakers: [] }, cost: 0 };
  const verified = applyReview(grounded, audited.data);
  metrics.costs.validation = audited.cost;
  const costs = Object.values(metrics.costs);
  if (costs.every(cost => cost !== null)) {
    metrics.usd = costs.reduce((sum, cost) => sum + cost, 0);
    metrics.usdPerMinute = metrics.usd * 60 / duration;
  }
  metrics.seconds.total = (performance.now() - started) / 1000;
  lap('validation');
  return { duration, transcript, ...verified, metrics };
}
