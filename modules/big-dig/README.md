# Big Dig

Secure, re-connectable channel for bidirectional communication with a remote host.

(A tunneling project that hopefully [costs less than $14.6 billion](
https://en.wikipedia.org/wiki/Big_Dig).)

## History

Big Dig was originally built as the logic for creating a persistent connection
between the [Nuclide](https://nuclide.io/) client and a remote machine in order
to support remote editing. To that end, it was designed with a focus on
minimizing the requirements to get the server component of Nuclide up and
running:

* Written in pure JavaScript as a Node module. Often, Node modules with native
dependencies are
written such that they are expected to be built locally, which often requires
the user to have various developer tools installed. Outlawing native
dependencies in Big Dig increases the chances it can be installed without issue.
* Minimal privileges required by the user on the server:
  * User must be able to serve HTTP traffic over some port on the server.
  * User must be able to write a random file under `/tmp` on the server.
* Minimal capabilities required by the user on the server:
  * Server must have `openssl` available on the `$PATH`.
  * Server must have Node 6.5.0 or later installed.
* Minimal privileges required by the user on the client:
  * Client must be able to make a single `ssh` connection to the server in order
    to launch it.
  * Client must be able to speak HTTP with the server.

Although Big Dig could have been implemented in any programming language, we
chose to implement it using Node because the clients and servers that were built
on top of it for Nuclide were also written in Node, so this was the path of
least resistance. Further, this made it simple to install the Nuclide server
via `npm`. This ensured a simple installation process that would not require root
privileges.

## Design

Today, a Big Dig server is just a secure HTTP server. When the server is
initialized, it creates a unique SSL certificate, which is sent back to the client
that created the server. Once the client has this certificate, it can use
ordinary HTTP to communicate with the server. In creating Nuclide, we found HTTP
to be a better protocol than SSH when building a remote editor that may often
have to retry requests due to network flakiness.

The goal of the Big Dig library is to provide building blocks for:
* negotiating the initial connection
* bidirectional communication across the channel
* persisting credentials

Today, we provide a WebSocket-like abstraction for a Node client that connects
to a Big Dig server. Going forward, we hope to provide a richer set of
abstractions to support a more diverse set of use cases, such as multiplexing
multiple [LSP](http://langserver.org/) servers over a single Big Dig connection.

## Authentication

The server initiation/authentication scheme is designed to be robust to user
environments. The current scheme is the result of experimenting with different
setups at Facebook. In practice, we observed that users have all sorts of things
in their `~/.bashrc` (or equivalent) that can interfere with writing to stdout
when running a remote command via `ssh`, which is why we write data to a file
and use SFTP to fetch it rather than write to stdout or stderr.

The authentication between the client and server works as follows:

1. The client makes an `ssh` connection to the server and runs a script to start
the server. (Ultimately, the client will communicate  with the server via
HTTPS/WSS.)
2. The script to start the server takes a single parameter: a JSON blob that contains
all of the information needed to launch the server. One of the properties in the JSON
is `jsonOutputFile`, which specifies the path where the server should write out the credentials (the
private key, cert, and CA overrides) necessary to connect to it. Note that these credentials are
created on-the-fly, and it requires `openssl` to be on the `$PATH` of the remote machine.
3. The client uses SFTP to copy the file written to at `jsonOutputFile` to the local machine.
4. The SSH/SFTP connection is terminated.
5. The client parses the JSON file and uses the credentials to connect to the remote host via
HTTPS/WSS.
6. The client decides what, if anything, to do with the credentials. Frequently, it will delete the
local JSON file and store the credentials in a secure location. By default, the certificates are
valid for 7 days, but this is configurable. Shutting down the server effectively invalidates the
credentials, as well, as the server generates a new key pair every time it starts up.

The full set of supported properties in the JSON blob is as follows:

* `cname` Value to use with `/CN=` when generating the server's certificates.
* `expiration` Currently, it must be in the form `NNNd` where `NNN` is the number
  of days for which the credentials should be valid. (This pattern may be expanded
  in the future to support ranges other than days.)
* `jsonOutputFile` The file on the server at which the credentials will be written.
* `port` (Optional, defaults to `0`.) The port that should be used to serve HTTP traffic. Must be an integer
  that is greater than or equal to zero. If `0`, then the server will choose an
  ephemeral port. This value will be included in the `jsonOutputFile`.
* `serverParams` (Optional, defaults to `null`.) A blob of JSON that will be
  passed to the server verbatim. This is where custom configuration should be specified.
