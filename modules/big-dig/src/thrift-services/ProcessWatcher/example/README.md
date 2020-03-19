Run server in one terminal
```
node modules/big-dig/src/thrift-services/ProcessWatcher/launchThriftProcessWatcherServer-entry.js 5000
```

Run example client in another
```
node modules/big-dig/src/thrift-services/ProcessWatcher/example/remoteProcessClient-entry.js 5000 CMD [...ARGS]
```
