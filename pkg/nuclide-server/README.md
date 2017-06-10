# nuclide-server

Provides a collection of services that are run on the Nuclide server to support
remote file editing.

This runs as a Node package to provide the server-side functionality
required by Nuclide to support remote file editing.

## Nuclide Server Prerequisites

* **[Node](https://nodejs.org) v0.12.0 or greater**. There are various installer
and package options depending on your platform on the
[nodejs.org site](https://nodejs.org/download/).

* **[Watchman](https://facebook.github.io/watchman)**. The Nuclide server
requires Watchman to detect file and directory changes. You can build and/or
install Watchman for your server's platform as described
[here](http://facebook.github.io/watchman/docs/install.html#build-install).

* **SSH Daemon**. The Nuclide client connects to the server via SSH, so
ensure that the server exposes an SSH daemon that you can connect to from your
client machine, and that you know the credentials required.

## Installing Nuclide Server

Ensure that the Nuclide project is checked out onto the remote server. From the root of the Nuclide check out, run `npm install` to install dependencies.

## Running Nuclide Server

You do not need to explicitly start the server since the Nuclide client will attempt to do so when it first connects over SSH, as explained in [Remote Projects README](../nuclide-remote-projects/README.md).

## Troubleshooting

If you want to debug the server starting up, you can of course run the command
directly:

```
./pkg/nuclide-server/nuclide-start-server
```

A successful start will display the port upon which the server has started, and
a JSON dump of certificate information:

```
Nuclide started on port 9090.
{"workspace": null, "ca": "-----BEGIN CERTIFICATE-----\n...
```

The `nuclide-start-server` command also has a useful help option:

```
./pkg/nuclide-server/nuclide-start-server -h
```

This explains many of the other options available, such as timeout, workspace
directory to use and so on.
