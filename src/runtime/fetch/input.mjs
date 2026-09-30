export function fetchInput(source) {
  if (source === undefined) throw new TypeError("runtime input source required");
  return Object.freeze({fetchedAt:new Date().toISOString(), source});
}
