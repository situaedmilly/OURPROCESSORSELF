import assert from "node:assert/strict";
import test from "node:test";
import { createMessage } from "../mcp/message.mjs";
import { createNotification, NotificationBus, NOTIFICATION_TOPICS } from "../mcp/notification.mjs";

test("message is distinct from notification", () => {
  const message = createMessage({
    messageId: "msg_001",
    topic: "ourself.test",
    payload: { value: 7 },
  });
  assert.equal(message.schema, "OURSELF.MCP.MESSAGE.v0.1");
  assert.equal(message.topic, "ourself.test");
  assert.deepEqual(message.payload, { value: 7 });
});

test("notification bus publishes without becoming execution authority", () => {
  const bus = new NotificationBus();
  const seen = [];
  bus.subscribe((notification) => seen.push(notification));
  const notification = bus.publish(createNotification({
    notificationId: "note_001",
    topic: NOTIFICATION_TOPICS.MESSAGE_ACCEPTED,
    status: "ACCEPTED",
    messageId: "msg_001",
  }));
  assert.equal(seen.length, 1);
  assert.equal(seen[0], notification);
  assert.equal(notification.instanceId, null);
});

test("execution lifecycle notification remains distinct from effect", () => {
  const notification = createNotification({
    notificationId: "note_002",
    topic: NOTIFICATION_TOPICS.EXECUTION_COMPLETED,
    status: "EXECUTED",
    instanceId: "inst_001",
    data: { cycles: 5 },
  });
  assert.equal(notification.status, "EXECUTED");
  assert.equal(notification.data.cycles, 5);
  assert.equal(notification.topic, "ourself.execution.completed");
});
