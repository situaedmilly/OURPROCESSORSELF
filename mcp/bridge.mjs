import { randomUUID } from "node:crypto";
import { createNotification, NOTIFICATION_TOPICS } from "./notification.mjs";

export const MCP_BRIDGE_SCHEMA = "OURSELF.MCP.PROCESSOR_BRIDGE.v0.1";

export function routeMessageToProcessor({
  message,
  controlPlane,
  program,
  maxCycles = 16,
  bus,
} = {}) {
  if (!message) throw new TypeError("message is required");
  if (!controlPlane || typeof controlPlane.admit !== "function") {
    throw new TypeError("controlPlane.admit is required");
  }

  const proposalId = `proposal_${randomUUID()}`;
  const instanceId = `instance_${randomUUID()}`;

  bus?.publish(createNotification({
    notificationId: randomUUID(),
    topic: NOTIFICATION_TOPICS.ADMISSION_PENDING,
    messageId: message.messageId,
    status: "PENDING",
    data: { proposalId },
  }));

  const result = controlPlane.admit({
    event: {
      schema: "OURSELF.MCP.EVENT.v0.1",
      eventId: `event_${message.messageId}`,
      source: message.source,
      topic: message.topic,
      payload: message.payload,
    },
    proposalId,
    instanceId,
    program,
    maxCycles,
  });

  const admitted = result?.admission?.status === "ADMITTED";
  const topic = admitted ? NOTIFICATION_TOPICS.ADMITTED : NOTIFICATION_TOPICS.MESSAGE_REJECTED;
  const status = admitted ? "ADMITTED" : "REJECTED";

  bus?.publish(createNotification({
    notificationId: randomUUID(),
    topic,
    messageId: message.messageId,
    instanceId: result?.instance?.instanceId ?? instanceId,
    status,
    data: {
      proposalId,
      admission: result?.admission ?? null,
    },
  }));

  return Object.freeze({
    schema: MCP_BRIDGE_SCHEMA,
    message,
    proposalId,
    instanceId,
    admission: result?.admission ?? null,
    instance: result?.instance ?? null,
    processor: result?.processor ?? null,
  });
}
