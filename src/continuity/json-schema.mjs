/**
 * Deterministic validator for the JSON Schema keywords used by the vendored
 * OURDATA v1 contracts and the REVERSELF continuity profile contract.
 * Unknown schema keywords are rejected at schema-load time by validateSchema().
 */
export function validateJsonSchema(value, schema, path = "$") {
  const errors = [];
  validate(value, schema, path, errors);
  return errors;
}

export function validateSchema(schema, path = "$schema") {
  const errors = [];
  if (!schema || typeof schema !== "object" || Array.isArray(schema)) return ["SCHEMA_NOT_OBJECT"];
  const supported = new Set(["$schema", "$id", "title", "type", "additionalProperties", "required", "properties", "items", "const", "enum", "minLength", "maxLength", "pattern", "minimum", "maximum", "minItems", "maxItems", "uniqueItems", "format"]);
  function walk(node, at) {
    for (const key of Object.keys(node)) if (!supported.has(key)) errors.push("UNSUPPORTED_SCHEMA_KEYWORD:" + at + "." + key);
    if (node.properties && typeof node.properties === "object") {
      for (const [key, child] of Object.entries(node.properties)) walk(child, at + ".properties." + key);
    }
    if (node.items && typeof node.items === "object") walk(node.items, at + ".items");
  }
  walk(schema, path);
  return errors;
}

function validate(value, schema, path, errors) {
  if (schema.const !== undefined && !equal(value, schema.const)) errors.push(path + ":CONST");
  if (schema.enum && !schema.enum.some((candidate) => equal(value, candidate))) errors.push(path + ":ENUM");

  if (schema.type !== undefined) {
    const types = Array.isArray(schema.type) ? schema.type : [schema.type];
    if (!types.some((type) => matchesType(value, type))) {
      errors.push(path + ":TYPE:" + types.join("|"));
      return;
    }
  }

  if (typeof value === "string") {
    const length = [...value].length;
    if (schema.minLength !== undefined && length < schema.minLength) errors.push(path + ":MIN_LENGTH");
    if (schema.maxLength !== undefined && length > schema.maxLength) errors.push(path + ":MAX_LENGTH");
    if (schema.pattern !== undefined) {
      let pattern;
      try { pattern = new RegExp(schema.pattern); } catch { errors.push(path + ":INVALID_SCHEMA_PATTERN"); }
      if (pattern && !pattern.test(value)) errors.push(path + ":PATTERN");
    }
    if (schema.format === "date-time" && !isDateTime(value)) errors.push(path + ":FORMAT_DATE_TIME");
  }

  if (typeof value === "number" && Number.isFinite(value)) {
    if (schema.minimum !== undefined && value < schema.minimum) errors.push(path + ":MINIMUM");
    if (schema.maximum !== undefined && value > schema.maximum) errors.push(path + ":MAXIMUM");
  }

  if (Array.isArray(value)) {
    if (schema.minItems !== undefined && value.length < schema.minItems) errors.push(path + ":MIN_ITEMS");
    if (schema.maxItems !== undefined && value.length > schema.maxItems) errors.push(path + ":MAX_ITEMS");
    if (schema.uniqueItems === true) {
      for (let i = 0; i < value.length; i++) {
        for (let j = i + 1; j < value.length; j++) {
          if (equal(value[i], value[j])) { errors.push(path + ":UNIQUE_ITEMS"); i = value.length; break; }
        }
      }
    }
    if (schema.items) value.forEach((item, index) => validate(item, schema.items, path + "[" + index + "]", errors));
  }

  if (isRecord(value)) {
    for (const key of schema.required ?? []) {
      if (!Object.hasOwn(value, key)) errors.push(path + ":REQUIRED:" + key);
    }
    const properties = schema.properties ?? {};
    for (const [key, child] of Object.entries(properties)) {
      if (Object.hasOwn(value, key)) validate(value[key], child, path + "." + key, errors);
    }
    if (schema.additionalProperties === false) {
      for (const key of Object.keys(value)) if (!Object.hasOwn(properties, key)) errors.push(path + ":ADDITIONAL_PROPERTY:" + key);
    }
  }
}

function matchesType(value, type) {
  switch (type) {
    case "object": return isRecord(value);
    case "array": return Array.isArray(value);
    case "string": return typeof value === "string";
    case "integer": return Number.isSafeInteger(value);
    case "number": return typeof value === "number" && Number.isFinite(value);
    case "boolean": return typeof value === "boolean";
    case "null": return value === null;
    default: return false;
  }
}
function isRecord(value) { return value !== null && typeof value === "object" && !Array.isArray(value); }
function equal(a, b) { return JSON.stringify(canonical(a)) === JSON.stringify(canonical(b)); }
function canonical(value) {
  if (Array.isArray(value)) return value.map(canonical);
  if (isRecord(value)) return Object.fromEntries(Object.keys(value).sort().map((key) => [key, canonical(value[key])]));
  return value;
}
function isDateTime(value) {
  return /^\\d{4}-\\d{2}-\\d{2}T\\d{2}:\\d{2}:\\d{2}(?:\\.\\d+)?(?:Z|[+-]\\d{2}:\\d{2})$/.test(value) && Number.isFinite(Date.parse(value));
}
