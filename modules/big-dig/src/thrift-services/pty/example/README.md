run this example

## locally
* cd nuclide root (xplat/nuclide)
* start the server
  `node modules/big-dig/src/thrift-services/pty/launchThriftPtyServer-entry.js 5000`
* start the client
  `node modules/big-dig/src/thrift-services/pty/example/thriftPtyClient-entry.js 5000`

## remotely
* rsync ~/xplat/nuclide to remote server
  * `scripts/fb-devserver-setup SERVER --once`
* forward remote port to local computer
  * `ssh -L 5000:localhost:5000 SERVER`
* run server on remote machine (note that node must be version 8 or greater)
  * `node ~/local/nuclide/modules/big-dig/src/thrift-services/pty/launchThriftPtyServer-entry.js 5000`
* run client locally
  `node modules/big-dig/src/thrift-services/pty/example/thriftPtyClient-entry.js 5000`
