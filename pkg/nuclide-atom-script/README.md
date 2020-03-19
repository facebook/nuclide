# nuclide-atom-script

This Node package provides a script named `atom-script` that takes a path to a
JavaScript file (optionally followed by a list of arguments) and runs it inside of Atom.

The file's default export must be a function that takes the list of arguments and returns
a promise that resolves to a valid exit code. Here is a sample echo script (which is
available in `./samples/echo.js`) that prints the arguments back to the user
(or a default message when no arguments are provided):

```js
'use babel';
/* @flow */

// Alternatively, you can define this as `type ExitCode = number`.
import type {ExitCode} from './nuclide-atom-script';

export default async function runCommand(args: Array<string>): Promise<ExitCode> {
  const message = args.length === 0 ? 'Please pass me an arg!' : args.join(' ');
  console.log(message);
  return 0;
}
```

To run this script, you would do:

```
$ ./bin/atom-script ./samples/echo.js print me
print me
```

Note that because this script will be run inside of Atom, you can use the `'use babel'`
pragma to get Atom to transpile your JavaScript for you.

At first glance, this script does not appear to provide much value.
However, consider that you have all of Atom's APIs available to you,
which means you also have programmatic access to all of your Atom packages.
For example, you could use `atom-script` to dump all of your keybindings to stdout:

```js
'use babel';
/* @flow */

import type {ExitCode} from './nuclide-atom-script';

export default async function runCommand(args: Array<string>): Promise<ExitCode> {
  const commands = [];
  for (const keybinding of atom.keymaps.getKeyBindings()) {
    commands.push(keybinding.command);
  }

  commands.sort();
  commands.forEach(command => console.log(command));
  return 0;
}
```

This example is also available in the `samples/` directory, so you can run it as follows:

```
$ ./bin/atom-script ./samples/keybindings.js
application:add-project-folder
application:hide
application:hide-other-applications
application:minimize
application:new-file
application:new-window
application:open
application:quit
application:show-settings
application:zoom
...
```
