export function observe(processor) {
  if (!processor || typeof processor.snapshot !== "function") throw new TypeError("processor snapshot required");
  return Object.freeze({
    observedAt: new Date().toISOString(),
    state: processor.snapshot(),
  });
}
