# nuclide-workspace-views

A registry for location-agnostic views.

## Approach

This package is designed to work with Atom's view abstractions: specifically,
the [view registry][ViewRegistry] and [panes][Pane].

In order to display something in an Atom pane or panel, you give it any object
which can be associated with a DOM element via Atom's [ViewRegistry]. Atom's
APIs refer to these objects using the generic term "items." Generally, they can
be thought of as view-models—stateful objects that a view's state is bound to.
However, they can also be HTMLElements themselves, have a reference to one,
[etc][createView]. For lack of a better word, we call these objects
**"viewables"**.

The Workspace Views package is primarily a registry for two things:

* Factories, called "openers", that can create viewables
* "location" objects, which are capable of displaying viewables

### Openers

The most common way of interacting with nuclide-workspace-views is by
registering an opener via the exposed Atom service. Openers define how to create
a viewable instance, given a URI. The API is based on
[`atom.workspace.open`][open]'s with the hope that we'll eventually be able to
merge the functionality into Atom by extending that API. Here's an example:

```js
const disposables = new CompositeDisposable();
export function consumeWorkspaceViewsService(api) {
  disposables.add(
    api.addOpener(uri => {
      if (uri === 'atom://mypackage/gadget') {
        return new ExampleGadget();
      }
    },
  );
}
```

There's also a `toggle()` method which can be used to easily create a toggle
command:

```js
atom.commands.add(
  'atom-workspace',
  'mypackage:toggle-gadget',
  () => { api.toggle('atom://mypackage/gadget'); },
);
```

**IMPORTANT**: In order for the toggle command to work as expected, your
viewable must implement a `getURI()` method that returns the same URI used to
open it. For example:

```js
class ExampleGadget {
  // [Some methods omitted]

  getURI() {
    return 'atom://mypackage/gadget';
  }
}
```

### Locations

The other side of nuclide-workspace-views is having multiple "location" objects
which are capable of displaying things. To make this possible, we define a
minimal Location interface based on Atom's [Pane]. See the [Location type
definition](./lib/types.js) for specifics. A location may be modal (only show
one thing at a time) or display several things simultaneously with one active
(e.g. a tabbed interface) or several active (e.g. a split pane). Experiment!

## Viewables and React

nuclide-workspace-views builds on Atom's abstractions—especially its
[ViewRegistry]. However, Nuclide defines its views using React elements and the
view registry only handles HTMLElements; how do we bridge the gap?

### Option 1: `renderReactRoot()`

The Atom [ViewRegistry] will look for a `getElement()` method on your object.
The `renderReactRoot()` utility will allow you to implement it easily, and make
sure cleanup is done correctly:

```js
class ExampleGadgetModel {
  getElement() {
    return renderReactRoot(<ExampleGadgetView />);
  }
}

function ExampleGadgetView() {
  return <div>Hello World!</div>;
}
```

It's important to note that this method will only be called once, so the element
you return will have to be bound to the state of the model. If you're using
Observables to store your state, this can be done with the
`bindObservableAsProps` utility:

```js
class ExampleGadgetModel {
  getElement() {
    // 1. Get a stream of states from somewhere. For this example, we'll just
    // create one.
    const states = Observable.of({firstName: 'Jean', lastName: 'Grey'});
    // 2. Map each state to the format that the View expects.
    const props = states.map(state => ({
      name: `${state.firstName} ${state.lastName}`,
    }));
    // 3. Create a bound version of the component.
    const BoundView = bindObservableAsProps(props, ExampleGadgetView);
    // 4. Return the stateful view.
    return renderReactRoot(<BoundView />);
  }
}

function ExampleGadgetView(props) {
  return <div>Hello {props.name}!</div>;
}
```

To use observables, but with a more familiar imperative API, you can extend
SimpleModel:

```js
class ExampleGadgetModel extends SimpleModel {
  constructor() {
    super();
    this.state = // Set the initial state.
  }
  onSomeEvent() {
    this.setState({count: this.state.count + 1});
  }
  getElement() {
    // 1. Use `Observable.from` to convert a simple model to a stream of states.
    const states = Observable.from(this);

    // ...
  }
}
```

If you're not using observables to manage state, you could subscribe to changes
manually in your view:

```js
class ExampleGadgetModel {
  getElement() {
    return renderReactRoot(<ExampleGadgetView model={this} />);
  }
  onChange(callback) {
    // ...
  }
  getFirstName() {
    // ...
  }
  getLastName() {
    // ...
  }
}

class ExampleGadgetView extends React.Component {
  componentDidMount() {
    this._subscription = this.props.model.onChange(this._updateState);
  }
  componentWillUnmount() {
    this._subscription.dispose();
  }
  _updateState = stateFromModel => {
    const firstName = this.props.model.getFirstName();
    const lastName = this.props.model.getLastName();
    this.setState({
      name: `${firstName} ${lastName}`,
    });
  }
  render() {
    return <div>Hello {this.state.name}!</div>;
  }
}
```

### Option 2: `viewableFromReactElement()`

If you'd like to store your state in a React component instead of a separate
model, Nuclide has a utility function called `viewableFromReactElement()`.

```js
class ExampleGadgetComponent extends React.Component {
  // ...

  render() {
    return <div>Hello {this.state.name}!</div>;
  }
}
```

Then use `viewableFromReactElement()` in your opener:

```js
api.addOpener(uri => {
  if (uri === 'atom://mypackage/gadget') {
    return viewableFromReactElement(<ExampleGadgetComponent />);
  }
};
```

The object returned by `viewableFromReactElement()` is a mounted React
component. That means that it will have all the methods that you define on your
component class. This can be used for Atom interop—you can add any methods to
your component that Atom normally looks for in pane items, like `getTitle()`,
`getIconName()`, `getURI()`, etc.

### Option 3: Go Your Own Way

The first two options make it easier to use React components, but they're by no
means necessary. Remember, these objects are associated with views via Atom's
view registry, so you can use any technique that Atom recognizes like
registering a custom view provider or anything [else][createView] Atom supports.

## Serialization

There's nothing really special about serialization. If you want to make sure
your view comes back after Atom is restarted, give it a `serialize()` method and
register a deserializer. (The preferred method is by adding it to your
package.json.) **Do not** use the URI and `atom.workspace.open` or
`workspaceViewsService.open` to deserialize. These has side-effects.

## Cleanup

Views opened by your package won't automatically be destroyed when the package
deactivates, but the service does expose an API to do this for you:
`destroyWhere()`. Just pass it a predicate function which will be used to
determine which views to destroy:

```js
disposables.add(
  new Disposable(
    () => api.destroyWhere(item => item instanceof ExampleGadgetView),
  ),
);
```

## Goals:

1. Reduce the UI clutter that comes from a growing number of "panels."
2. Give users more control over where the views appear.
3. Where possible, simplify the definition of these UI elements and increase
   consistency of UIs.

[ViewRegistry]: https://atom.io/docs/api/latest/ViewRegistry
[createView]: https://github.com/atom/atom/blob/e5da1011d4de9ff9251797f1f5a0093c5b57bd3d/src/view-registry.coffee#L173-L207
[Pane]: https://atom.io/docs/api/latest/Pane
[open]: https://atom.io/docs/api/latest/Workspace#instance-open
