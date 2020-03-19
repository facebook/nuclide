# Nuclide Service Framework

The classes defined in this directory are used to integrate the service framework proxy-generation and marshalling code with the actual message passing layer. See the `nuclide-service-parser` package for steps related to definition parsing, proxy-generation, and type marshalling.

## RpcConnection
`RpcConnection` is used by the `RemoteConnection` class - all functions related to the service framework are delegated to a `RpcConnection` instance. These functions are `callRemoteFunction`, `callRemoteMethod`, and `disposeRemoteObject`.

## ServiceRegistry
`ServiceRegistry` is used by the `NuclideServer` class - all functions related to the service framework are delegated to a `ServiceRegistry` instance. All of the messages come in through the `handleMessage` function.

## Types
The file [type.js](./types.js) contains typing for message formats. The `RequestMessage` tagged union encodes the format of possible requests that can be sent from the client to the server, while the `ResponseMessage` union encodes the structure of messages that are sent back.
