# Nuclide Remoting Framework
## (was Nuclide Service Framework)

The Nuclide Remoting Framework is an RPC system for JavaScript modules which uses a combination
of ES6 module exports and Flow type definitions as its interface definition language(IDL).

JavaScript modules provide a mechanism to reuse code. The Nuclide Remoting Framework enables
transparently executing JavaScript modules either locally, just like any other module, or remotely
on another machine. The Nuclide Remoting Framework uses the module's exports and Flow type definitions to
automatically marshal calls across the network to the remote host, and to marshal the results back to the
caller.

# Remotable Module

A Remotable Module is a module which may execute locally, or may execute on a remote machine. The
remoting framework makes the location of a module's execution transparent both to the module's client
and to the module itself.

A remotable module is a JS module which contains only remotable exports. A remotable export is a
function or class which is exported with the ES6 'export' keyword that can be automatically
marshaled by the Remoting Framework across machines. The remoting framework can marshal
a variety of values including simple types(number, string, boolean), object literals, Promises, Observables,
and user defined classes. The exact rules for a remotable module are described in the specification section later.

## Example

A remotable module is a JS module which defines its exports with the ES6 'export' keyword,
and includes Flow type annotations on all exported declarations.

Here is a remotable module which provides a file system API:

```js
// FileService.js
//
// This file contains a remotable module for an example file system API.
// The implementation has been elided ...

// A remotable module may export functions:
export function getFileList(dir: string): Promise<Array<string>> { ... }

// A remotable module may also export classes:
export class File {
  // NOTE: constructors will not work remotely, as they must be synchronous.
  // You can use an (asynchronous) static factory or function instead.
  constructor(path: string) { ... }

  getName(): Promise<string> { ... }
  readText(): Promise<string> { ... }

  addOnChange(callback: (file: File): void): Promise<Disposable> { ... }
}

// Remotable classes may be returned via factory functions.
export async function createFile(path: string): Promise<File> { ... }
  return new File(path);
}
```

Clients of a remotable module use `getService` instead of standard npm `require` or ES6 `import` to
reference the exports of the remotable module. Once a remotable module is acquired with `getService`
it can be used just like a normal JS module.

```js
import {getService} from 'nuclide-remoting-service';

// Client.js - Example of a client using a remotable service
async testFileService(fileName: string, host: ?string) {

  // getService returns a proxy ...
  const FileService = getService('FileService', host);

  // ... which can be called just like any other JS module
  const fileNames = await FileService.getFileList(host);
  fileNames.foreach(fileName => console.log(fileName));

  // Remotable entrypoints may return remote objects...
  const file = await FileService.createFile(fileName);
  // Methods on remote objects are also remotable ...
  console.log(await file.readText());

  // Remote event hookup is also possible ...
  const onChange = async (file: File): void => { console.log(await file.getName()); };
  const disposable = await file.addOnChange(onChange);
  disposable.dispose();
}

// The remotable module may be used with local values, in which case
// the calls to the proxy resolve to the local implementation.
testFileService('/usr/local/local-file.txt', null);
// With remote values, the proxy dispatches the call to the remote host.
testFileService('nuclide://myhost.org/usr/local/file.txt', 'my.remote.machine.com');
```
The implementation of a remotable module looks just like the implementation of a regular npm module.
The implementation is not aware of whether the caller is local or from another host.
The full remotable module implementation might look something like this:

```js
// FileService.js
//
// This file contains a remotable module for an example file system API.

import fs from 'fs';

// The exports of a service implementation must match the exports
// of the service specification.
export function getFileList(dir: string): Promise<Array<string>> {
  return fs.readdir(dir);
}

export class File {
  constructor(fileName: string) {
    this._fileName = fileName;
    this._callbacks = [];
    this._watcher = null;
  }

  async getName(): Promise<string> {
    return this._fileName;
  }

  readText(): Promise<string> {
    return fs.readFile(this._fileName);
  }

  async addOnChange(callback: (file: File): void): Promise<Disposable> {
    if (!this._watcher) {
      this._watcher = () => this._fireOnChange();
      fs.watchFile(this._fileName, this._watcher);
    }
    this._callbacks.push(callback);
    return { dispose: () => this._removeOnChange(callback) };
  }

  _removeOnChange(callback: (file: File): void): void {
    this._callbacks.remove(callback);
    if (this._callbacks.is_empty() && this._watcher) {
      fs.unwatchFile(this._watcher);
      this._watcher = null;
    }
  }

  _fireOnChange() {
    this._callbacks.foreach((callback) => callback(this));
  }
}

export async function createFile(path: string): Promise<File> {
  return new File(path);
}
```

## Specification

A remotable module is a JS module which exports its interface via the ES6 `export` syntax and
annotates all exported declarations with Flow type annotations. The exports of a remotable module
are restricted to enable the remoting framework to marshal the module across machines.

The exported functions, classes and types define the interface to a remotable module.

Variables exported from remotable modules do not impact the remote interface of the module, and are
not subject to the restrictions of other exported declarations.

### Exported Functions

A function exported from a remotable module must have a remotable signature.

### Remotable Signature

A function or method signature is remotable if:
- all arguments are of Remotable Type
- the return type is one of:
  - void
  - Promise of a Remotable Type
  - Observable of a Remotable Type

Note that optional arguments are remotable provided that the type of the argument is remotable.

### Exported Classes

A class exported from a remotable module:
- must have remotable signatures for all 'public' instance and static member functions
- must include a parameterless `dispose` method which returns either void or Promise<void>.

Note that 'private' members as well as member fields are not remotable and are not subject to any
restrictions.

### Exported Types

An exported type alias defined in a remotable module must alias a Remotable Type.

### Public/Private

All declarations whose name begins with an underscore are considered 'private' and are not considered
to be part of the remote interface. This includes global functions, classes, class members, and
named type declarations.

### Remotable Types

The following types are remotable:
- primitives
  - number, string, boolean, Date, Buffer, RegExp
- nullable of remotable type
- Collections Types:
  - array of remotable type
  - Set of remotable type
  - Map whose key and value types are both remotable
- object literal, whose fields are of remotable type. Optional fields are supported.
- function with remotable signature (NOTE still TBD)
- classes exported from the remotable module
- type aliases exported from the remotable module
- Object, mixed, any are remotable. They are marshaled as JSON, so must contain JSON-able values.
- string and number type literals
- union types of type literals or object types whose discriminant is a single string or number field.

Types Which are not Remotable Include:
- classes which are not exported
- named type aliases which are not exported
- nullable, array or object literals of non-Remotable type
- functions which are not remotable.
- objects whose fields are of non-remotable types

Note that void, Promise and Observable types are permitted as return types of remotable signatures,
but they are not permitted in any other remotable declarations.

### Exceptions

When a remote function throws, the thrown value is marshaled as the type `Error | string | void | Object`
and the marshaled value is thrown (via rejecting the Promise, or Observable.throw) back to the caller.

## Object Lifetimes

Classes and functions are marshaled by reference. All other values are marshaled by value (copied).
Any class instance obtained from the remoting framework either by calling `new` on a remotable class
or returned by a remotable API must be disposed.

## TODO

- NuclideUri marshalling
- adding custom marshalling
- describe configs
- client/server side registration of configs
- client API getService, getServiceByNuclideUri
- message transport
- client side host add/remove
