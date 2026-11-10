import Ajv from 'ajv';

const str = { type: 'string' };
const nullable = { type: ['string', 'null'] };
const array = items => ({ type: 'array', items });
const object = properties => ({ type: 'object', properties, required: Object.keys(properties), additionalProperties: false });
const oneOf = (...values) => ({ type: 'string', enum: values });
const ref = object({ segmentId: str, quote: str, role: oneOf('statement', 'agreement', 'revision', 'cancellation', 'question', 'context') });

export const extraction = object({
  speakers: array(object({ label: str, name: str, intro: ref })),
  items: array(object({
    title: str, status: oneOf('active', 'decision', 'cancelled', 'open', 'excluded', 'clarification'),
    owner: nullable, deadline: nullable, date: nullable,
    deadlineStatus: oneOf('none', 'absolute', 'relative_unresolved'),
    evidence: array(ref), history: array(object({ summary: str, evidence: array(ref) }))
  }))
});
export const review = object({
  speakers: array(object({ label: str, supported: { type: 'boolean' } })),
  items: array(object({ id: str, supported: { type: 'boolean' }, reason: str }))
});
const ajv = new Ajv();
export const checkExtraction = ajv.compile(extraction);
export const checkReview = ajv.compile(review);
