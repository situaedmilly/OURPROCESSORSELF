export const NOTIFICATION_SCHEMA = "OURSELF.MCP.NOTIFICATION.v0.1";

export const NOTIFICATION_TOPICS = Object.freeze({
  MESSAGE_ACCEPTED: "ourself.message.accepted",
  MESSAGE_REJECTED: "ourself.message.rejected",
  ADMISSION_PENDING: "ourself.admission.pending",
  ADMITTED: "ourself.admission.admitted",
  EXECUTION_STARTED: "ourself.execution.started",
  EXECUTION_COMPLETED: "ourself.execution.completed",
  EXECUTION_FAILED: "ourself.execution.failed",
  RECEIPT_SEALED: "ourself.receipt.sealed",
});

export function createNotification({
  notificationId,
  topic,
  messageId = null,
  instanceId = null,
  status,
  data = {},
  timestamp = new Date().toISOString(),
}) {
  if (!notificationId) throw new TypeError("notificationId is required");
  if (!topic) throw new TypeError("topic is required");
  if (!status) throw new TypeError("status is required");
  return {
    schema: NOTIFICATION_SCHEMA,
    notificationId,
    topic,
    messageId,
    instanceId,
    status,
    timestamp,
    data,
  };
}

export class NotificationBus {
  #listeners = new Set();

  subscribe(listener) {
    if (typeof listener !== "function") throw new TypeError("listener must be a function");
    this.#listeners.add(listener);
    return () => this.#listeners.delete(listener);
  }

  publish(notification) {
    for (const listener of this.#listeners) listener(notification);
    return notification;
  }
}
