# Hyperclick

Pluggable text-clicking UI for [Atom](https://atom.io/).

Hyperclick is triggered by two events:
- `<cmd>` or `<cmd-mousemove>` underlines clickable text under the mouse.
- `<cmd-mousedown>` performs the action associated with the clickable text.
- `<cmd-alt-enter>` performs the action on the text under the cursor.

## Known Providers

Check out the wiki: https://github.com/facebooknuclide/hyperclick/wiki/Known-Providers

## Demo

Install `hyperclick` with this [demo package](https://github.com/oclbdk/hyperclick-provider-demo)
to recreate the screencast below.

![hyperclick-demo](https://thumbs.gfycat.com/EcstaticEvilEstuarinecrocodile-size_restricted.gif)

## Provider API

### Example

Declare the provider callback in the `package.json` (e.g. `getProvider`).

```js
"providedServices": {
  "hyperclick": {
    "versions": {
      "0.1.0": "getProvider"
    }
  }
}
```

NOTE: Providers for `hyperclick.provider@0.0.0` are still accepted, but that naming is now deprecated.
Please use `hyperclick@0.1.0` for new providers.

Define the provider callback in `lib/main.js`.

```js
export function getProvider() {
  return {
    priority: 1
    grammarScopes: ['source.js'], // JavaScript files
    getSuggestionForWord(
      textEditor: TextEditor,
      text: string,
      range: Range
    ): ?HyperclickSuggestion {
      return {
        // The range(s) to underline as a visual cue for clicking.
        range,
        // The function to call when the underlined text is clicked.
        callback() {},
      };
    },
  };
}
```

### Details

You must define one of these methods on the provider:

- `getSuggestionForWord(textEditor: TextEditor, text: string, range: Range)`

  Use this to provide a suggestion for single-word matches.
  Optionally set `wordRegExp` on the provider to adjust word-matching.

  - `textEditor`: The text editor the event originated from.
  - `text`: The string containing the word under the mouse.
  - `range`: The buffer position of `text` in the text editor.

- `getSuggestion(textEditor: TextEditor, position: Point)`

  Use this to provide a suggestion if it can have non-contiguous ranges.
  A primary use-case for this is Objective-C methods.

  - `textEditor`: The text editor the event originated from.
  - `position`: The buffer position of the mouse in the text editor.

The methods return a suggestion or a `Promise` that resolves to a suggestion:

- `range`: A range or array of ranges to underline as a visual cue for clicking.

  To distinguish ranges and arrays, this can't be a Range-compatible array.
  For example, use `new Range([0, 0], [0, 10])` instead of `[[0, 0], [0, 10]]`.

- `callback`: The function to call when the underlined text is clicked.

  If there are multiple possibilities, this can be an array of objects with:

    - `title`: A string to present in the UI for the user to select.
    - `rightLabel`(optional): An indicator denoting the "kind" of suggestion this represents
    - `callback`: The function to call when the user selects this object.

Additional provider fields:

- `priority`: The higher this is, the more precedence the provider gets.

  Hyperclick only returns suggestions from a single provider, so this is a
  workaround for providers to override others. `priority` defaults to 0.

- `grammarScopes`: An (optional) `Array` of grammar `scopeNames` to provide suggestions for.
  Your provider will only be triggered in matching text editors.
