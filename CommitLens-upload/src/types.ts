export type Stage = 'transcription' | 'extraction' | 'validation';
export type Status = 'active' | 'decision' | 'cancelled' | 'open' | 'excluded' | 'clarification';
export type Segment = { id: string; speaker: string; start: number; end: number; text: string };
export type Evidence = { segmentId: string; speaker: string; start: number; end: number; quote: string; role: string };
export type Item = {
  id: string; title: string; owner: string | null; deadline: string | null; date: string | null;
  deadlineStatus: 'none' | 'absolute' | 'relative_unresolved'; status: Status;
  evidence: Evidence[]; history: { summary: string; evidence: Evidence[] }[];
};
export type Result = {
  duration: number; transcript: Segment[]; items: Item[];
  speakers: { label: string; name: string; intro: Evidence }[];
  rejected: { id: string; reason: string }[];
  metrics: {
    calls: number; retries: number; seconds: Record<Stage | 'total', number>;
    costs: Record<Stage, number | null>; usd: number | null; usdPerMinute: number | null;
  };
};
