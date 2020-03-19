# Nuclide Service Parser

This feature is the core of the Nuclide Service Framework, implementing the following components:

**Definition File Parsing** - The function `parseServiceDefinition`, exported from `lib/service-parser.js` takes in the string source of a service definition file, and returns an object of type `Definitions`, which describes all of the functions, classes, and type aliases encoded in the file.

**Remote Proxy Generation** - The function `generateProxy`, exported from `lib/proxy-generator.js` takes in the previously generated `Definitions` object, and constructs a remote proxy factory function, which can then be used to construct a proxy module for any given host.

**The TypeRegistry class** - This class handles marshalling and unmarshalling messages based off of type annotations, and exports the `marshal` and `unmarshal` functions. These functions both take the value to be transformed as the first parameter, and the type description itself as the second parameter.

- [Type Abstraction](#type-abstraction)
  - [Valid Types](#valid-types)
  - [Invalid Types](#invalid-types)
  - [Remote Objects](#remote-objects)
  - [Return Types](#return-types)
    - [`Void`](#void)
    - [`Promise<A>`](#promisea)
    - [`Observable<A>`](#observablea)
- [Proxy Generation](#proxy-generation)
- [Marshalling / Unmarshalling System](#marshalling--unmarshalling-system)

## Type Abstraction

The service framework uses a simplified type abstraction that covers a subset of the features of Flow. It consists of a large tagged union, which can be seen in the [types.js](./types.js) file. Parameterized types like `Map`, `Set`, and Object type annotations carry their parameters as data, so that they can be serialized and deserialized properly.

### Valid Types

The following types should serialize properly.
- Primitives
  - `string`
  - `number`
  - `boolean`
- NuclideUri
- Nullable Types, written as `?T`
- Collections
  - `Array<T>`
  - `Set<T>`
  - `Map<K, V>`
  - Object Types, written in the form `{ field: T; ... }`
    - Keys can be optional, which is distinct from a required key that points to a nullable value.
- Date
- Buffer
- RegExp
- Any Type Alias defined in the set of currently loaded service definitions.
  - Defined using the syntax `export type TypeAlias = ...;`
- Any Remote object type.
  - Defined using the syntax `export class RemoteClass {...}`

### Invalid Types
The types listed below are not supported.

- Union Types - I don't think it's possible to distinguish between all of the types in a reliable way. Instead, a Union can be represented in Protobuf-like fashion, with a wrapper class that has nullable components.
  ```js
  export type UnionType = {
    a: ?PossibleTypeA;
    b: ?PossibleTypeB;
    c: ?PossibleTypeC;
  };
  ```
- Callbacks - However, it should be possible to implement this using the `FunctionType` object.

### Remote Objects
Remote objects are pass-by-reference. When they are returned from the server, the RPC framework returns a unique ID for the object. On the client side, this is wrapped inside of a proxy object, where methods can be dispatched as if the object was present locally.

### Return Types
Functions or methods can return one of three things.

#### `Void`
Methods that return `void` are fire-and-forget. They have no concept of completion, and the client is never returned a result.

#### `Promise<A>`
Methods can return a `Promise<A>`, where `A` is any valid type. Additionally, `Promise<void>` is supported, in cases where the method does not return a result, but a client might still want to wait for it's completion.

#### `Observable<A>`
Methods can return an `Observable<A>`, where `A` is any valid type. This should be used in order to stream the results of a query.

## Proxy Generation

The `generateProxy` function does not return a proxy directly, but rather returns a function that can be used to construct proxies. This is because we need a separate proxy for each remote host. Thus, the factory function takes in a client object and closes over it, returning a module that implements the correct API.

The client object must implement the following functions:

- `callRemoteFunction` - Used to call a module-level function, or a static method of a class.
- `callRemoteMethod` - Call a method of a remote object.
- `disposeRemoteObject` - Destroy the id => object mapping of a remote object, and call it's dispose method.
- `marshal` and `unmarshal` - Serialize and deserialize a type, respectively. Likely, the client will implement these functions by delegating to a `TypeRegistry` object.

## Marshalling / Unmarshalling System
The service framework needs to automatically marshal and unmarshal a wide variety of objects, simply by looking at the type annotations of a function. This is accomplished by assigning every type a marshalling and unmarshalling function, keyed in a Map by the name of the type. The TypeRegistry class encapsulates these two maps, along with functions for marshalling a wide variety of types.

***Marshallers can reference other marshallers.*** This is what makes it possible to have parameterized types like `Array<T>`, or object types of the form `{ field: T; ... }`. The marshallers registered under `object` or `array` simple redirect conversions to the appropriate marshaller for the type of their elements.

***Marshallers are asynchronous.*** Thus, they should return a Promise that resolves to the serialized value. This is primarily to cover special cases, and most marshallers can simply `return Promise.resolve(value)`. `async` functions are also a good pattern for creating marshallers.

Note that a type can actually have four total transformation functions - a marshaller and unmarshaller on the client, and a marshaller and unmarshaller on the server. This is to account for cases where the server and client are not symmetrical. See the table below for why four separate functions are required in the case of serializing remote objects.

| Location | Marshaller | Unmarshaller |
|----------|---------------------------------------------------------------------------------------------------------------------------------------|-----------------------------------------------------------------------------------------------------------|
| Server | Return the Object's ID as a string. If the Object doesn't have an ID, generate one and put it into a map that keys from ID => Object. | Lookup the string ID in the global registry and return the Object. |
| Client | Extract the ID of the Proxy Object, and send it as a string. | Return the Proxy object associated from the string ID. If no proxy exists, create one and bake in the ID. |

Due to the fact that these types, such as NuclideUri, require more information than what is known in the TypeRegistry object, their marshallers are registered in the `ServiceRegistry` and `RpcConnection` classes
