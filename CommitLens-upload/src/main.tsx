import { useEffect, useRef, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { prepare } from './audio';
import type { Evidence, Result, Stage, Status } from './types';
import './style.css';

const stages: [Stage, string][] = [['transcription', 'Transcribe audio'], ['extraction', 'Extract commitments'], ['validation', 'Validate evidence']];
const icons = {
  link: 'M10 13a4 4 0 0 0 6 .4l4-4a4 4 0 0 0-6-5.6l-2 2M14 11a4 4 0 0 0-6-.4l-4 4a4 4 0 0 0 6 5.6l2-2',
  upload: 'M12 16V3m-5 5 5-5 5 5M4 15v5h16v-5',
  check: 'm5 12 4 4L19 6',
  decision: 'm12 3 9 9-9 9-9-9 9-9Z',
  close: 'M8 8l8 8m0-8-8 8M22 12a10 10 0 1 1-20 0 10 10 0 1 1 20 0Z',
  question: 'M9.1 9a3 3 0 0 1 5.8 1c0 2-2.9 2.4-2.9 4m0 3h.01M22 12a10 10 0 1 1-20 0 10 10 0 1 1 20 0Z',
  list: 'M9 6h11M9 12h11M9 18h11M4 6h.01M4 12h.01M4 18h.01',
  alert: 'M12 8v5m0 3h.01M12 3l10 18H2L12 3Z',
  file: 'M6 3h8l4 4v14H6V3Zm8 0v5h4M9 12h6m-6 4h6',
  user: 'M16 7a4 4 0 1 1-8 0 4 4 0 1 1 8 0ZM4 21v-2a5 5 0 0 1 5-5h6a5 5 0 0 1 5 5v2H4Z',
  calendar: 'M4 6h16v15H4V6Zm4-3v6m8-6v6M4 11h16',
  bolt: 'm13 2-8 12h6l-1 8 9-12h-6l1-8Z',
  search: 'M16 16l5 5m-3-10a7 7 0 1 1-14 0 7 7 0 1 1 14 0Z'
};
type IconName = keyof typeof icons;

function Icon({ name }: { name: IconName }) {
  return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d={icons[name]} />
  </svg>;
}

const groups: [Status, string, string, IconName][] = [
  ['active', 'Commitments', 'Agreed work to carry forward.', 'check'],
  ['cancelled', 'Cancelled', 'Previously agreed work that was called off.', 'close'],
  ['excluded', 'Unaccepted', 'Suggestions that did not become agreements.', 'list'],
  ['open', 'Open questions', 'Questions the meeting left open.', 'question'],
  ['decision', 'Decisions', 'Agreed outcomes that do not require a task.', 'decision'],
  ['clarification', 'Clarifications', 'The recording leaves these outcomes uncertain.', 'alert']
];

function clock(seconds: number) {
  const whole = Math.floor(seconds);
  return Math.floor(whole / 60) + ':' + String(whole % 60).padStart(2, '0');
}

function mark(seconds: number) {
  return clock(seconds) + '.' + Math.floor((seconds % 1) * 10);
}

function usd(value: number | null) {
  return value === null ? 'Unavailable' : '$' + value.toFixed(5);
}

function App() {
  const [recording, setRecording] = useState<Awaited<ReturnType<typeof prepare>>>();
  const [url, setUrl] = useState('');
  const [busy, setBusy] = useState(false);
  const [decoding, setDecoding] = useState(false);
  const [drag, setDrag] = useState(false);
  const [stage, setStage] = useState<Stage>();
  const [error, setError] = useState('');
  const [playError, setPlayError] = useState('');
  const [result, setResult] = useState<Result>();
  const [elapsed, setElapsed] = useState(0);
  const [playing, setPlaying] = useState('');
  const [selectedGroup, setSelectedGroup] = useState<Status>('active');
  const [sourceView, setSourceView] = useState<'transcript' | 'speakers'>('transcript');
  const [search, setSearch] = useState('');
  const [selectedSegment, setSelectedSegment] = useState('');
  const input = useRef<HTMLInputElement>(null);
  const audio = useRef<HTMLAudioElement>(null);
  const stopAt = useRef<number | undefined>(undefined);
  const request = useRef<AbortController | null>(null);

  useEffect(() => {
    if (!recording) return;
    const next = URL.createObjectURL(recording.file);
    setUrl(next);
    return () => URL.revokeObjectURL(next);
  }, [recording]);

  useEffect(() => () => request.current?.abort(), []);

  async function choose(file?: File) {
    if (!file || busy || decoding) return;
    setDecoding(true);
    setError('');
    setPlayError('');
    setPlaying('');
    stopAt.current = undefined;
    setRecording(undefined);
    setUrl('');
    setResult(undefined);
    setStage(undefined);
    try {
      setRecording(await prepare(file));
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not read the recording.');
    } finally {
      setDecoding(false);
    }
  }

  async function analyze() {
    if (!recording || request.current) return;
    const controller = new AbortController();
    request.current = controller;
    setBusy(true);
    setStage(undefined);
    setError('');
    setResult(undefined);
    const start = performance.now();
    try {
      const response = await fetch('/api/process', {
        method: 'POST', body: recording.bytes, headers: { 'Content-Type': 'application/octet-stream' }, signal: controller.signal
      });
      if (!response.ok) {
        const body = await response.json().catch(() => null);
        throw new Error(body?.error || 'The server could not process the upload (HTTP ' + response.status + ').');
      }
      if (!response.body) throw new Error('The server returned an empty response.');
      const reader = response.body.pipeThrough(new TextDecoderStream()).getReader();
      let pending = '';
      let finalResult: Result | undefined;
      try {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          pending += value;
          const lines = pending.split('\n');
          pending = lines.pop() ?? '';
          for (const line of lines.filter(Boolean)) {
            const message = JSON.parse(line);
            if (message.error) throw new Error(message.error);
            if (message.stage) setStage(message.stage);
            if (message.result) finalResult = message.result;
          }
        }
      } finally {
        await reader.cancel().catch(() => {});
      }
      if (!finalResult) throw new Error('Analysis ended before a result arrived. Try again.');
      setElapsed((performance.now() - start) / 1000);
      setResult(finalResult);
      setSelectedGroup(groups.find(([status]) => finalResult.items.some(item => item.status === status))?.[0] ?? 'active');
      setSourceView('transcript');
      setSearch('');
      setSelectedSegment('');
    } catch (e) {
      if (!controller.signal.aborted) setError(e instanceof Error ? e.message : 'Analysis failed. Try again.');
    } finally {
      request.current = null;
      setStage(undefined);
      setBusy(false);
    }
  }

  async function play(clip: Pick<Evidence, 'start' | 'end'>, key: string, segmentId: string) {
    const player = audio.current;
    if (!player) return;
    setPlayError('');
    try {
      player.currentTime = clip.start;
      stopAt.current = clip.end;
      setPlaying(key);
      setSelectedSegment(segmentId);
      await player.play();
    } catch {
      stopAt.current = undefined;
      setPlaying('');
      setPlayError('Could not play that segment. Try the recording player above.');
    }
  }

  function clearClip() {
    stopAt.current = undefined;
    setPlaying('');
  }

  function onTime() {
    const player = audio.current;
    if (player && stopAt.current !== undefined && player.currentTime >= stopAt.current) {
      player.pause();
      clearClip();
    }
  }

  function speaker(label: string) {
    return result?.speakers.find(person => person.label === label)?.name ||
      (label === 'unknown' ? 'Unidentified speaker' : 'Speaker ' + label + ' · name uncertain');
  }

  function clipBlock(clip: Evidence, key: string) {
    return <div className="clip" key={key}>
      <blockquote>“{clip.quote}”</blockquote>
      <div className="clip-meta"><span>{speaker(clip.speaker)} <span aria-hidden="true">·</span> {mark(clip.start)}–{mark(clip.end)}</span>
        <button type="button" className="clip-button" onClick={() => void play(clip, key, clip.segmentId)}><span aria-hidden="true">▶</span> {playing === key ? 'Replay evidence' : 'Play evidence'}</button>
      </div>
    </div>;
  }

  const stageIndex = stages.findIndex(([id]) => id === stage);
  const group = groups.find(([status]) => status === selectedGroup)!;
  const visibleItems = result?.items.filter(item => item.status === selectedGroup) ?? [];
  const query = search.trim().toLowerCase();
  const segments = result?.transcript.filter(segment =>
    !query || (speaker(segment.speaker) + ' ' + segment.text).toLowerCase().includes(query)) ?? [];
  const speakerLabels = [...new Set(result?.transcript.map(segment => segment.speaker))];
  const workflow = result ? 2 : recording ? 1 : 0;

  return <>
    <header className="top"><div className="bar">
      <a className="wordmark" href="#top"><span className="brand-icon"><Icon name="link" /></span>
        <span>Commit<span className="brand-accent">Lens</span><small>Commitments</small></span></a>
      <nav aria-label="Workspace">
        <a className="nav-primary" href="#upload-title"><Icon name="upload" /> Process</a>
        <a href="#results-title"><Icon name="check" /> Review</a>
        <a href="#transcript-title"><Icon name="file" /> Transcript</a>
      </nav>
    </div></header>
    <main id="top">
      <section className="hero" aria-labelledby="page-title">
        <svg className="wave" viewBox="0 0 900 220" preserveAspectRatio="none" aria-hidden="true">
          <defs>
            <linearGradient id="wave-fill" x2="0" y2="1"><stop stopColor="#8f67ff" stopOpacity=".46" /><stop offset="1" stopColor="#a18aff" stopOpacity="0" /></linearGradient>
            <pattern id="wave-lines" width="8" height="8" patternUnits="userSpaceOnUse"><rect width="2" height="8" fill="#7650ec" opacity=".12" /></pattern>
          </defs>
          <path fill="#d7cafb" opacity=".55" d="M0 172C125 170 137 79 213 90S320 220 400 128 497 58 556 104 641 81 690 54 776 122 900 82V220H0Z" />
          <path fill="url(#wave-fill)" d="M0 177C122 183 163 146 213 138S312 205 375 123 447 37 510 87 578 116 630 48 704 81 737 126 825 108 900 119V220H0Z" />
          <path fill="url(#wave-lines)" d="M0 180C126 185 170 148 222 148S323 204 384 129 460 57 512 96 580 127 638 62 708 94 741 135 826 121 900 126V220H0Z" />
        </svg>
        <h1 id="page-title">Turn conversations into<br className="desktop" /> clear <em>commitments</em></h1>
        <p>Upload a recording to extract agreed tasks, owners, deadlines, and open questions.</p>
      </section>

      <div className="dashboard">
        <aside className="sidebar" aria-label="Workflow and processing details">
          <ol className="workflow" aria-label="Workflow">
            {['Upload audio', 'Process with AI', 'Review results'].map((label, index) =>
              <li key={label} className={index === workflow ? 'current' : index < workflow ? 'done' : ''}
                aria-current={index === workflow ? 'step' : undefined}>
                <span className="step">{index + 1}</span><span>{label}</span>
                {index < workflow && <Icon name="check" />}
              </li>)}
          </ol>
          <section className="panel progress" aria-labelledby="progress-title">
            <div className="section-heading"><span className="panel-icon"><Icon name="bolt" /></span><h2 id="progress-title">Processing details</h2></div>
            <dl className="metrics">
              <div><dt>Duration</dt><dd>{recording ? clock(recording.duration) : '—'}</dd></div>
              <div><dt>Processing time</dt><dd>{result ? elapsed.toFixed(2) + ' s' : '—'}</dd></div>
              <div><dt>Estimated cost</dt><dd>{result ? usd(result.metrics.usd) : '—'}</dd></div>
              {result && <>
                <div><dt>Cost per audio minute</dt><dd>{usd(result.metrics.usdPerMinute)}</dd></div>
                <div><dt>Server time</dt><dd>{result.metrics.seconds.total.toFixed(2)} s</dd></div>
                <div><dt>API calls · retries</dt><dd>{result.metrics.calls} · {result.metrics.retries}</dd></div>
              </>}
            </dl>
            <p className="sr-only" aria-live="polite">{result ? 'Analysis complete' : busy ? (stages[stageIndex]?.[1] || 'Sending audio') + '…' : 'Ready when you are'}</p>
            {(busy || result) && <ol className="stages">{stages.map(([id, label], index) =>
              <li key={id} className={result || stageIndex > index ? 'done' : stageIndex === index ? 'current' : ''}>
                <span>{result || stageIndex > index ? '✓' : '0' + (index + 1)}</span>{label}
                {result && <small>{result.metrics.seconds[id].toFixed(2)} s</small>}
              </li>)}</ol>}
          </section>
        </aside>

        <div className="panel review">
          <section className="upload" aria-labelledby="upload-title">
            <div className="section-heading"><span className="panel-icon"><Icon name="upload" /></span><div><h2 id="upload-title">Meeting recording</h2><p>English audio · Two speakers · Up to 3 minutes</p></div></div>
            <input ref={input} type="file" hidden accept="audio/*,.mp4,.m4a,.webm,.flac,.ogg,.opus,.aac" onChange={e => { void choose(e.target.files?.[0]); e.target.value = ''; }} />
            {!recording ? <div className={'drop ' + (drag ? 'drag' : '')} onDragOver={e => { e.preventDefault(); if (!busy && !decoding) setDrag(true); }}
              onDragLeave={() => setDrag(false)} onDrop={e => { e.preventDefault(); setDrag(false); void choose(e.dataTransfer.files[0]); }}>
              <span className="upload-icon"><Icon name="upload" /></span>
              <strong>{decoding ? 'Preparing recording…' : 'Drag and drop your audio here'}</strong>
              <span>MP3, WAV, M4A and other browser-supported formats</span>
              <button className="primary" disabled={decoding} onClick={() => input.current?.click()}>Browse files</button>
            </div> : <div className="recording">
              <div className="file-row"><div><strong>{recording.file.name}</strong><p>{clock(recording.duration)} · {(recording.file.size / 1024).toFixed(0)} KiB</p></div>
                <button className="quiet" disabled={busy} onClick={() => input.current?.click()}>Replace file</button></div>
              {url && <audio ref={audio} controls preload="metadata" src={url} onTimeUpdate={onTime} onPause={clearClip} onEnded={clearClip}
                onSeeking={() => {
                  const time = audio.current?.currentTime;
                  if (stopAt.current !== undefined && time !== undefined && time >= stopAt.current) clearClip();
                }} />}
              <div className="actions"><button className="primary" disabled={busy} onClick={() => void analyze()}>{busy ? 'Analyzing…' : result ? 'Analyze again' : 'Analyze recording'}</button>
                {busy && <button className="quiet" onClick={() => request.current?.abort()}>Cancel</button>}</div>
            </div>}
            <p className="fine">Playback uses the original file. Analysis sends a time-aligned copy to OpenAI.</p>
            {error && <p className="error" role="alert">{error}</p>}
            {playError && <p className="error" role="alert">{playError}</p>}
          </section>

          <section className="results" aria-labelledby="results-title">
            <h2 id="results-title">Review results</h2>
            {result && <p className="fine">Listen to the evidence to check names, tasks, and deadlines. The transcript may mishear words.</p>}
            <div className="filters" role="group" aria-label="Outcome category">
              {groups.map(([status, label, , icon]) => <button key={status} type="button" aria-pressed={status === selectedGroup} onClick={() => setSelectedGroup(status)}>
                <Icon name={icon} />{label}{result && <span className="count">{result.items.filter(item => item.status === status).length}</span>}
              </button>)}
            </div>
            {result?.rejected.length ? <details className="warning"><summary>Needs clarification · {result.rejected.length} {result.rejected.length === 1 ? 'candidate withheld' : 'candidates withheld'}</summary>
              <ul>{result.rejected.map(row => <li key={row.id}>{row.reason}</li>)}</ul></details> : null}
            {!visibleItems.length && <div className="empty"><Icon name={group[3]} /><strong>{result ? (selectedGroup === 'cancelled' ? 'No cancelled commitments found' : 'No ' + group[1].toLowerCase() + ' found') : 'Your meeting record will appear here'}</strong>
              <p>{result ? group[2] : 'Upload and analyze a recording to review outcomes and play the supporting evidence.'}</p></div>}
            {visibleItems.map(item => <article key={item.id} className={'item ' + item.status}>
              <h3><span className="item-icon"><Icon name={group[3]} /></span>{item.title}</h3>
              {item.status === 'active' && <dl className="item-fields">
                <div><dt><Icon name="user" /> Owner</dt><dd>{item.owner ? (result?.transcript.some(s => s.speaker === item.owner) ? speaker(item.owner) : item.owner) : 'Not assigned'}</dd></div>
                <div><dt><Icon name="calendar" /> Deadline</dt><dd>{item.deadline ?? 'Not agreed'} {item.date && <span>· {item.date}</span>}
                  {item.deadlineStatus === 'relative_unresolved' && <small>Calendar date unresolved</small>}</dd></div>
              </dl>}
              {item.evidence.map((clip, i) => clipBlock(clip, item.id + '-primary-' + i))}
              {item.history.length > 0 && <details className="history"><summary>Decision history</summary><ol>{item.history.map((entry, i) =>
                <li key={i}><strong>{entry.summary}</strong>{entry.evidence.map((clip, j) => clipBlock(clip, item.id + '-history-' + i + '-' + j))}</li>)}</ol></details>}
            </article>)}
          </section>
        </div>

        <aside className="panel transcript" aria-labelledby="transcript-title">
          <h2 id="transcript-title" className="sr-only">Transcript and speakers</h2>
          <div className="transcript-header">
            <div className="filters" role="group" aria-label="Source view">
              <button type="button" aria-pressed={sourceView === 'transcript'} onClick={() => setSourceView('transcript')}><Icon name="file" /> Transcript</button>
              <button type="button" aria-pressed={sourceView === 'speakers'} onClick={() => setSourceView('speakers')}><Icon name="user" /> Speakers</button>
            </div>
          </div>
          {sourceView === 'transcript' && result?.transcript.length ? <label className="search"><Icon name="search" />
            <input type="search" aria-label="Search transcript" placeholder="Search transcript" value={search} onChange={event => setSearch(event.target.value)} /></label> : null}
          {sourceView === 'transcript' ? <>
            {!segments.length && <div className="empty"><Icon name="file" /><strong>{query && result ? 'No matching lines' : 'Transcript'}</strong>
              <p>{query && result ? 'Try a different search.' : result ? 'No usable speech was transcribed.' : 'Timestamped dialogue appears after analysis.'}</p></div>}
            {segments.map(segment => <div className={'transcript-row' + (selectedSegment === segment.id ? ' highlighted' : '')} key={segment.id}>
              <button type="button" className="timestamp" onClick={() => void play(segment, segment.id, segment.id)}
                aria-label={'Play transcript at ' + mark(segment.start)}>{mark(segment.start)}</button>
              <span className={'speaker-tag tone-' + (speakerLabels.indexOf(segment.speaker) % 2)}>{speaker(segment.speaker)}</span>
              <p>{segment.text}</p>
            </div>)}
          </> : <>
            {!speakerLabels.length && <div className="empty"><Icon name="user" /><strong>Speakers</strong>
              <p>{result ? 'No speakers were identified in the transcript.' : 'Speaker labels and introductions appear after analysis.'}</p></div>}
            {speakerLabels.map((label, i) => {
              const person = result?.speakers.find(entry => entry.label === label);
              return <div className="speaker-row" key={label}><span className={'speaker-tag tone-' + (i % 2)}>{speaker(label)}</span>
                {person ? clipBlock(person.intro, 'intro-' + label) : <p className="fine">No verified introduction for this speaker.</p>}</div>;
            })}
          </>}
        </aside>
      </div>
      <footer><span>CommitLens</span><span>AI-assisted analysis · Review the source audio for consequential decisions.</span></footer>
    </main>
  </>;
}

createRoot(document.getElementById('root')!).render(<App />);
