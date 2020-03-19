# Nuclide RPC Protocol

This document describes Nuclide's RPC protocol. Nuclide's RPC system was originally
designed to enable automatic remoting of JavaScript APIs based on flow type annotations.
It has since been extended to include RPC interactions between JavaScript and
other languages. This document describes the protocol so that it can be implemented
by other non-JavaScript languages.

Note: Should consider reconciling this with:
https://github.com/Microsoft/language-server-protocol/blob/master/protocol.md and  http://www.jsonrpc.org/specification

## Transports

This protocol is transport independent. An RPC transport must provide bidirectional
exchange of Unicode chars. Currently we have transports based on:

- Unix Streams
- WebSockets

## Messages

A message is a sequence of Unicode chars delimited by a '\n' char. Each message
contains a single serialized [JSON](http://json.org) value. It is worth noting
here that correctly serialized JSON never contains a '\n' character.

All messages share a common JSON structure:

```js
type Message = {
  protocol: 'service_framework3_rpc';
  type: string;
  id: number;
};
```

Note that this document uses flow type annotations to describe JSON schema.
These types are also found in lib/messages.js.

The `protocol` field identifies the message as being a nuclide-rpc message.
TODO: Should rename the protocol...

The `type` field identifies the message type. See below for descriptions of the
various message types.

The RPC protocol involves sequences of related messages. The `id` field identifies
which sequence of messages this message belongs to. See description below for
valid message sequences. `id`'s must be uniquely assigned by the originator of the
message sequence. Message sequences are originated with one of the following message types:
Call, CallObject, Dispose, Unsubscribe.

## Call Message Sequence

The call message sequences represent an API call and its corresponding response.
There are two kinds of API calls: Call (for regular functions) and CallObject (for methods).

## Server vs. Client

Each RPC connection occurs between a client and a server. The client may send
CallMessages, CallObjectMessages, DisposeMessages, and UnsubscribeMessages to the server.

The server never sends CallMessages to the client.

Note that once objectIds have been exchanged, CallObjectMessages may be sent
from the client to the server, but also from the server to the client.

### CallMessage

CallMessage represents a simple function call.

```js
type CallMessage = {
  protocol: 'service_framework3_rpc';
  type: 'call';
  id: number;
  method: string;
  args: Object;
};
```

The `method` field identifies the method being called.

The `args` field is an object describing the parameters to the method call.

After receiving a CallMessage, the receiver may respond with either a ResponseMessage
or an ErrorResponseMessage.

Note that a `method` may not require a response. This would be analogous to a `method` having no return value.

### ResponseMessage

ResponseMessage represents a successful response to an API call.

```js
type ResponseMessage = {
  protocol: 'service_framework3_rpc';
  type: 'response';
  id: number;
  result: any;
};
```

The `result` field is the result of the API call.

### ErrorResponseMessage

ErrorResponseMessage represents an unsuccessful response to an API call. This is
analogous to a thrown exception as a result of an API call.

```js
type ErrorResponseMessage = {
  protocol: 'service_framework3_rpc';
  type: 'error-response';
  id: number;
  error: any;
};
```

The `error` field describes the error.

### CallObjectMessage

CallObjectMessage represents a call on an object instance.

```js
export type CallObjectMessage = {
  protocol: 'service_framework3_rpc';
  type: 'call-object';
  id: number;
  method: string;
  objectId: number;
  args: Object;
};
```

Similar to `CallMessage`, CallObjectMessage represents a call on an object method.
The `objectId` field identifies the object who's method is being invoked. Note that
the objectId must identify an object which lives at the receiver of the CallObjectMessage.
See below for more on objectIds.

#### Arguments

Arguments in `CallMessage` and `CallObjectMessage` messages
are represented as a map of name/value pairs. The set of argument names and their
types will depend on the `method`.

#### ObjectId

ObjectIds are numeric values which identify objects which are passed
by reference in RPC messages. ObjectIds may be passed as arguments and returned in ResponseMessages.

Objects which live on the server are assigned a positive objectId. Objects which live
on the client are assigned a negative objectId. 0 is not a valid objectId.

Once an object has been assigned an objectId that id will be valid until a
DisposeMessage is sent. Once a DisposeMessage has been sent for an objectId,
that objectId may not be used in any other message.


### DisposeMessage

A DisposeMessage indicates that resources related to an object may be released.
DisposeMessages are sent to the connection (server or client) which own the
object being disposed. Once a DisposeMessage has been sent, the disposed objectId
may not be used in subsequent messages.

```js
type DisposeMessage = {
  protocol: 'service_framework3_rpc';
  type: 'dispose';
  id: number;
  objectId: number;
};
```

After an objectId is disposed, it may not be used in future messages.


TODO: Describe subscription messages.
