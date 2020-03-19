# nuclide-server

Provides a collection of services that are run on the Nuclide server to support
remote file editing.

This runs as a Node package to provide the server-side functionality
required by Nuclide to support remote file editing.

## Installing Nuclide Server

See https://nuclide.io/docs/features/remote/#nuclide-server for prerequisites and setup.

## Running Nuclide Server

You do not need to explicitly start the server since the Nuclide client will attempt to do so when it first connects over SSH, as explained in [Remote Projects README](../nuclide-remote-projects/README.md).

## Troubleshooting

If you want to debug the server starting up, you can of course run the command
directly:

```
nuclide-start-server
```

A successful start will display the port upon which the server has started, and
a JSON dump of certificate information:

```
Nuclide started on port 9091.
{"workspace": null, "ca": "-----BEGIN CERTIFICATE-----\n...
```

The `nuclide-start-server` command also has a useful help option:

```
nuclide-start-server -h
```

This explains many of the other options available, such as timeout, workspace
directory to use and so on.
