export function actuator(name, fn) {
  if (typeof fn !== "function") throw new TypeError("actuator function required");
  return Object.freeze({name, execute: fn});
}
