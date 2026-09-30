#!/usr/bin/env node

import readline from "node:readline";
import { randomUUID } from "node:crypto";
import { createMessage } from "./message.mjs";
import { createNotification, NotificationBus, NOTIFICATION_TOPICS } from "./notification.mjs";

const SERVER_NAME = "OURSELFMCP";
const SERVER_VERSION = "0.1.0";
const bus = new NotificationBus();

function response(id, result) {
  return { jsonrpc: "2.0", id, result };
}

function errorResponse(id, code, message) {
  return { jsonrpc: "2.0", id, error: { code, message } };
}

bus.subscribe((notification) => {
  process.stdout.write(JSON.stringify({
    jsonrpc: "2.0",
    method: "notifications/message",
    params: { level: "info", logger: SERVER_NAME, data: notification },
  }) + "\n");
});

function toolsList() {
  return {
    tools: [
      {
        name: "ourself_message",
        description: "Accept an OURSELFMCP message and emit a receipt notification.",
        inputSchema: {
          type: "object",
          required: ["topic"],
          properties: {
            topic: { type: "string" },
            payload: { type: "object" },
            correlationId: { type: ["string", "null"] },
          },
        },
      },
      {
        name: "ourself_notify",
        description: "Emit an OURSELFMCP notification.",
        inputSchema: {
          type: "object",
          required: ["topic", "status"],
          properties: {
            topic: { type: "string" },
            status: { type: "string" },
            data: { type: "object" },
            messageId: { type: ["string", "null"] },
            instanceId: { type: ["string", "null"] },
          },
        },
      },
    ],
  };
}

function handleToolsCall(id, params) {
  const { name, arguments: args = {} } = params ?? {};

  if (name === "ourself_message") {
    const message = createMessage({
      messageId: randomUUID(),
      topic: args.topic,
      payload: args.payload ?? {},
      correlationId: args.correlationId ?? null,
    });

    bus.publish(createNotification({
      notificationId: randomUUID(),
      topic: NOTIFICATION_TOPICS.MESSAGE_ACCEPTED,
      messageId: message.messageId,
      status: "ACCEPTED",
      data: { message },
    }));

    return response(id, {
      content: [{ type: "text", text: JSON.stringify(message) }],
      isError: false,
    });
  }

  if (name === "ourself_notify") {
    const notification = createNotification({
      notificationId: randomUUID(),
      topic: args.topic,
      status: args.status,
      messageId: args.messageId ?? null,
      instanceId: args.instanceId ?? null,
      data: args.data ?? {},
    });
    bus.publish(notification);

    return response(id, {
      content: [{ type: "text", text: JSON.stringify(notification) }],
      isError: false,
    });
  }

  return errorResponse(id, -32601, "Unknown tool");
}

const rl = readline.createInterface({ input: process.stdin, crlfDelay: Infinity });

rl.on("line", (line) => {
  if (!line.trim()) return;

  let request;
  try {
    request = JSON.parse(line);
  } catch {
    process.stdout.write(JSON.stringify(errorResponse(null, -32700, "Parse error")) + "\n");
    return;
  }

  if (request.method === "initialize") {
    process.stdout.write(JSON.stringify(response(request.id, {
      protocolVersion: "2025-06-18",
      capabilities: { tools: {}, logging: {} },
      serverInfo: { name: SERVER_NAME, version: SERVER_VERSION },
    })) + "\n");
    return;
  }

  if (request.method === "notifications/initialized") return;

  if (request.method === "tools/list") {
    process.stdout.write(JSON.stringify(response(request.id, toolsList())) + "\n");
    return;
  }

  if (request.method === "tools/call") {
    try {
      process.stdout.write(JSON.stringify(handleToolsCall(request.id, request.params)) + "\n");
    } catch (error) {
      process.stdout.write(JSON.stringify(errorResponse(request.id, -32602, error.message)) + "\n");
    }
    return;
  }

  if (request.id !== undefined) {
    process.stdout.write(JSON.stringify(errorResponse(request.id, -32601, "Method not found")) + "\n");
  }
});
