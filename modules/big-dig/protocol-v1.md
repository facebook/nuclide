# Big Dig Protocol v1

Although Big Dig primarily targets JavaScript developers today, it is important
to publish a protocol so that Big Dig clients can be written in other languages.
(Note that it should also be possible to write Big Dig servers or *routes* in
other languages, but that is lower priority right now.)

The primary channel of communication with a Big Dig server is over a secure
WebSocket. There is only one endpoint that is guaranteed to accept connections:

    wss://host/v1

Once the client establishes a WebSocket connection with this endpoint, all RPCs
are expected to be multiplexed over this endpoint (as opposed to using multiple
endpoints, each requiring its own connection).

Every message over the WebSocket must be a prefixed with a *tag* that identifies
a *route* on the server. (A route maps to an RPC handler of sorts on the
server.) The format of a message is as follows:

* tag (must be `[a-zA-Z-]+` for now)
* `\0`
* message body

Someone who builds on top of `BigDigServer` in JavaScript is responsible for
registering a subscription for each `tag` they wish to support. `BigDigServer`
is responsible for stripping the header from each message and forwarding the
body to the appropriate subscriber. The subscriber also receives a `Transport`
interface that it can use to respond to messages. The `Transport` ensures that
all messages sent from the subscriber will include the appropriate header to
identify the route from which it was sent.

Similarly, someone who builds on top of `BigDigClient` in JavaScript is
responsible for adding a subscription for each `tag` they are interested in.
`BigDigClient` is responsible for stripping the header from each message and
forwarding the body to the appropriate subscriber.

**Note that `BigDigClient` may receive messages from routes with which they
never initiated any communication.** For example, some routes may be
broadcast-only. If no subscription is added for the route's tag, then
`BigDigClient` will drop messages with that tag on the floor.

# Building on top of the protocol

`BigDigClient` and `BigDigServer` are designed to provide as little
functionality as possible. Most of the functionality you need for building a
server comes from library functions in `big-dig` that build on top of the client
and server rather than building the functionality in directly.

## TBD

* Use of `NuclideSocket` or something else to create a reliable transport.
* Make it easy to use compression for certain RPC calls. (Probably happens in
  the client library.)
* Library should provide client and server components to facilitate doing
  JSON-RPC or LSP over a route.
