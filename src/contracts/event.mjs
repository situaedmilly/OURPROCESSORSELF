export const EVENT_SCHEMA = "OURSELF.PROCESSOR.EVENT.v0.2";

export function createEvent({eventId, type, input, source="unknown", observedAt=new Date().toISOString(), evidence=[]}={}) {
  if (!eventId || typeof eventId !== "string") throw new TypeError("eventId required");
  if (!type || typeof type !== "string") throw new TypeError("event type required");
  return Object.freeze({
    schema: EVENT_SCHEMA,
    eventId,
    type,
    source,
    input,
    observedAt,
    evidence: Object.freeze([...evidence]),
  });
}
