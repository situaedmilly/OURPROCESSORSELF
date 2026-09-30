export function classify(event) {
  if (!event || typeof event.type !== "string") throw new TypeError("event.type required");
  return Object.freeze({
    kind:"SEMANTIC_OBJECT",
    eventId:event.eventId,
    type:event.type,
    input:event.input,
    evidence:event.evidence ?? [],
  });
}
