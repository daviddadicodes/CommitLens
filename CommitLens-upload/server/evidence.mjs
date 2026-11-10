import { randomUUID } from 'node:crypto';

export function segmentsFrom(raw, duration) {
  if (!Array.isArray(raw)) throw new Error('The transcription service returned no segment data.');
  const tolerance = 0.15;
  return raw.flatMap(({ start, end, text, speaker }, i) => {
    if (!Number.isFinite(start) || !Number.isFinite(end) || start < 0 || end <= start ||
        start >= duration || end > duration + tolerance || typeof text !== 'string' || !text.trim()) return [];
    return [{ id: 's' + (i + 1), start, end: Math.min(end, duration), text: text.trim(),
      speaker: typeof speaker === 'string' && speaker.trim() ? speaker : 'unknown' }];
  });
}

export function ground(extracted, segments) {
  const index = new Map(segments.map(s => [s.id, s]));
  function clip(ref) {
    const segment = index.get(ref.segmentId);
    const quote = ref.quote.trim();
    if (!segment || !quote || !segment.text.includes(quote)) return null;
    return { segmentId: segment.id, quote, role: ref.role, start: segment.start, end: segment.end, speaker: segment.speaker };
  }
  function refs(entries) {
    const clips = entries.map(clip);
    return clips.length && clips.every(Boolean) ? clips : null;
  }
  const speakers = extracted.speakers.flatMap(({ label, name, intro }) => {
    const evidence = clip(intro);
    return evidence && label !== 'unknown' && label === evidence.speaker && name.trim() ? [{ label, name, intro: evidence }] : [];
  });
  const rejected = [];
  const items = extracted.items.flatMap(candidate => {
    const id = randomUUID();
    const { title, owner, deadline, date, deadlineStatus, status } = candidate;
    const evidence = refs(candidate.evidence);
    const history = candidate.history.map(step => ({ summary: step.summary, evidence: refs(step.evidence) }));
    const parsedDate = typeof date === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(date) ? new Date(date) : null;
    const validDate = parsedDate && Number.isFinite(parsedDate.getTime()) && parsedDate.toISOString().slice(0, 10) === date;
    const spokenDeadline = deadline?.trim().toLowerCase();
    const deadlineCited = spokenDeadline && evidence?.some(clip => clip.quote.toLowerCase().includes(spokenDeadline));
    const yearCited = validDate && segments.some(segment =>
      segment.text.match(/\b\d{4}\b/g)?.includes(date.slice(0, 4)));
    const validDeadline = deadlineStatus === 'none' ? deadline === null && date === null :
      deadlineCited && (deadlineStatus === 'absolute' ? yearCited : date === null);
    if (!title.trim() || !evidence || history.some(step => !step.evidence || !step.summary.trim()) || !validDeadline) {
      rejected.push({ id, reason: 'A quotation, segment reference, history entry, or deadline could not be verified.' });
      return [];
    }
    return [{ id, title, owner, deadline, date, deadlineStatus, status, evidence, history }];
  });
  return { speakers, items, rejected };
}

export function applyReview(grounded, review) {
  const approved = (rows, key, value) => {
    const matches = rows.filter(row => row[key] === value);
    return matches.length === 1 && matches[0].supported;
  };
  const speakers = grounded.speakers.filter(s =>
    grounded.speakers.filter(other => other.label === s.label || other.name.toLowerCase() === s.name.toLowerCase()).length === 1 &&
    approved(review.speakers, 'label', s.label));
  const rejected = [...grounded.rejected];
  const items = grounded.items.filter(item => {
    if (approved(review.items, 'id', item.id)) return true;
    rejected.push({ id: item.id, reason: review.items.find(row => row.id === item.id)?.reason || 'Final state could not be confirmed.' });
    return false;
  });
  return { speakers, rejected, items };
}
