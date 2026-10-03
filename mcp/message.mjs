export const MESSAGE_SCHEMA = "OURSELF.MCP.MESSAGE.v0.1";

export function createMessage({
  messageId,
  type = "command",
  topic,
  payload = {},
  correlationId = null,
  source = "GBTSELF",
  target = "OURSELFMCP",
  timestamp = new Date().toISOString(),
}) {
  if (!messageId) throw new TypeError("messageId is required");
  if (!topic) throw new TypeError("topic is required");
  return {
    schema: MESSAGE_SCHEMA,
    messageId,
    type,
    topic,
    source,
    target,
    correlationId,
    timestamp,
    payload,
  };
}
