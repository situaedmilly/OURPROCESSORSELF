import assert from "node:assert/strict";
import test from "node:test";
import { createMessage } from "../mcp/message.mjs";
import { createNotification, NotificationBus, NOTIFICATION_TOPICS } from "../mcp/notification.mjs";
import { routeMessageToProcessor } from "../mcp/bridge.mjs";

test("message is distinct from notification", () => {
  const message=createMessage({messageId:"msg_001",topic:"ourself.test",payload:{value:7}});
  assert.equal(message.schema,"OURSELF.MCP.MESSAGE.v0.1");
  assert.equal(message.topic,"ourself.test");
  assert.deepEqual(message.payload,{value:7});
});

test("notification bus publishes without becoming execution authority", () => {
  const bus=new NotificationBus(), seen=[];
  bus.subscribe((notification)=>seen.push(notification));
  const notification=bus.publish(createNotification({notificationId:"note_001",topic:NOTIFICATION_TOPICS.MESSAGE_ACCEPTED,status:"ACCEPTED",messageId:"msg_001"}));
  assert.equal(seen.length,1);
  assert.equal(seen[0],notification);
  assert.equal(notification.instanceId,null);
});

test("execution lifecycle notification remains distinct from effect", () => {
  const notification=createNotification({notificationId:"note_002",topic:NOTIFICATION_TOPICS.EXECUTION_COMPLETED,status:"EXECUTED",instanceId:"inst_001",data:{cycles:5}});
  assert.equal(notification.status,"EXECUTED");
  assert.equal(notification.data.cycles,5);
  assert.equal(notification.topic,"ourself.execution.completed");
});

test("MCP message routes through proposal and admission without owning authority", () => {
  const bus=new NotificationBus(), seen=[];
  bus.subscribe((notification)=>seen.push(notification));
  const controlPlane={admit(input){
    assert.equal(input.event.topic,"ourself.execute");
    assert.equal(input.proposalId.startsWith("proposal_"),true);
    assert.equal(input.instanceId.startsWith("instance_"),true);
    return {admission:{status:"ADMITTED",reasons:[]},instance:{instanceId:input.instanceId,status:"ADMITTED"},processor:{marker:"processor-created-by-control-plane"}};
  }};
  const result=routeMessageToProcessor({message:createMessage({messageId:"msg_bridge_001",topic:"ourself.execute",payload:{value:12}}),controlPlane,program:new Uint8Array([0,0,0,0]),bus});
  assert.equal(result.admission.status,"ADMITTED");
  assert.equal(result.instance.status,"ADMITTED");
  assert.equal(result.processor.marker,"processor-created-by-control-plane");
  assert.deepEqual(seen.map((n)=>n.topic),[NOTIFICATION_TOPICS.ADMISSION_PENDING,NOTIFICATION_TOPICS.ADMITTED]);
});

test("MCP message rejection stops before processor execution", () => {
  const bus=new NotificationBus(), seen=[];
  bus.subscribe((notification)=>seen.push(notification));
  const result=routeMessageToProcessor({
    message:createMessage({messageId:"msg_bridge_002",topic:"ourself.execute"}),
    controlPlane:{admit(){return {admission:{status:"REJECTED",reasons:["NO_AUTHORITY"]},instance:{instanceId:"inst_rejected",status:"REJECTED"},processor:null};}},
    program:new Uint8Array(),bus
  });
  assert.equal(result.processor,null);
  assert.equal(result.admission.status,"REJECTED");
  assert.equal(seen.at(-1).topic,NOTIFICATION_TOPICS.MESSAGE_REJECTED);
});
