### command-line-client sample

This provides an example of how to create a CLI to start/connect to a Big Dig
server. Note that the Big Dig module provides a number of the key building
blocks for building a client so that you can build a custom client while
writing very little code.

## Try It Out

To avoid getting prompted for a passphrase when starting Big Dig,
it's a good idea to start by creating a separate public/private key pair for
testing that does not include a passphrase:

```
ssh-keygen -f ~/.ssh/test_id_rsa -q -N ''
cat ~/.ssh/test_id_rsa.pub >> ~/.ssh/authorized_keys
```

Once you have generated the key and updated your `authorized_keys` file,
run the following from this directory to try out this sample:

```
node cli-entry.js --host localhost --private-key ~/.ssh/test_id_rsa --remote-server-command "/usr/local/bin/node $PWD/server.js"
```

You likely need to kill the server between tests (we need a better way of
dealing with this):

```
ps ax | grep big-dig | awk '{print $1}' | xargs -I '{}' kill {}
```
