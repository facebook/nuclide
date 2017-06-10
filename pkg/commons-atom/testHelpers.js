/**
 * Copyright (c) 2015-present, Facebook, Inc.
 * All rights reserved.
 *
 * This source code is licensed under the license found in the LICENSE file in
 * the root directory of this source tree.
 *
 * @flow
 * @format
 */

import invariant from 'assert';
import nuclideUri from 'nuclide-commons/nuclideUri';

/**
 * Use this function to simulate keyboard shortcuts or special keys, e.g. cmd-v,
 * escape, or tab. For regular text input the TextEditor.insertText method
 * should be used.
 *
 * @param key A single character key to be sent or a special token such as
 * 'escape' or 'tab'.
 * @param target The DOM element to which this event will be sent.
 * @param metaKeys An object denoting which meta keys are pressed for this
 * keyboard event.
 */
export function dispatchKeyboardEvent(
  key: string,
  target: ?HTMLElement,
  metaKeys: {
    alt?: boolean,
    cmd?: boolean,
    ctrl?: boolean,
    shift?: boolean,
  } = {},
): void {
  const {alt, cmd, ctrl, shift} = metaKeys;
  // Atom requires `key` to be uppercase when `shift` is specified.
  invariant(shift !== true || key.toUpperCase() === key);
  invariant(target != null);
  const event = atom.keymaps.constructor.buildKeydownEvent(key, {
    target,
    alt: Boolean(alt),
    cmd: Boolean(cmd),
    ctrl: Boolean(ctrl),
    shift: Boolean(shift),
  });
  atom.keymaps.handleKeyboardEvent(event);
}

/**
 * Custom matchers for jasmine testing, as described in:
 * http://jasmine.github.io/1.3/introduction.html#section-Writing_a_custom_matcher.
 */
export const rangeMatchers = {
  /**
   * Determines if two Ranges are equal. This function should not be called
   * directly, but rather added as a Jasmine custom matcher.
   * @param The expected result from the test.
   * @this A JasmineMatcher object.
   * @returns True if the Ranges are equal.
   */
  toEqualAtomRange(expected: ?atom$Range): boolean {
    return Boolean(this.actual && expected && this.actual.isEqual(expected));
  },

  /**
   * Same as `toEqualAtomRange` but for an array of Ranges. This function should
   * not be called directly, but rather added as a Jasmine custom matcher.
   * @param The expected result from the test.
   * @this A JasmineMatcher object.
   * @returns True if the array of Ranges are equal.
   */
  toEqualAtomRanges(expected: ?Array<atom$Range>): boolean {
    let allEqual = true;
    if (!this.actual || !expected) {
      return false;
    }
    this.actual.some((range, index) => {
      invariant(expected); // Tell Flow this is definitely non-null now.
      if (range.isEqual(expected[index])) {
        return false;
      } else {
        allEqual = false;
        return true;
      }
    });
    return allEqual;
  },
};

/**
 * Set the project. If there are one or more projects set previously, this
 * replaces them all with the one(s) provided as the argument `projectPath`.
 */
export function setLocalProject(projectPath: string | Array<string>): void {
  if (Array.isArray(projectPath)) {
    atom.project.setPaths(projectPath);
  } else {
    atom.project.setPaths([projectPath]);
  }
}

/**
 * Waits for the specified file to become the active text editor.
 * Can only be used in a Jasmine context.
 */
export function waitsForFile(
  filename: string,
  timeoutMs: number = 10000,
): void {
  waitsFor(`${filename} to become active`, timeoutMs, () => {
    const editor = atom.workspace.getActiveTextEditor();
    if (editor == null) {
      return false;
    }
    const editorPath = editor.getPath();
    if (editorPath == null) {
      return false;
    }
    return nuclideUri.basename(editorPath) === filename;
  });
}

export function waitsForFilePosition(
  filename: string,
  row: number,
  column: number,
  timeoutMs: number = 10000,
): void {
  waitsFor(
    `${filename} to become active at ${row}:${column}`,
    timeoutMs,
    () => {
      const editor = atom.workspace.getActiveTextEditor();
      if (editor == null) {
        return false;
      }
      const editorPath = editor.getPath();
      if (editorPath == null) {
        return false;
      }
      const pos = editor.getCursorBufferPosition();
      return (
        nuclideUri.basename(editorPath) === filename &&
        pos.row === row &&
        pos.column === column
      );
    },
  );
}

/**
 * Reaches into React's internals to look for components that have not been
 * unmounted. Having mounted React components after the creator has been
 * disposed is a sign that there are problems in the cleanup logic.
 *
 * If ReactComponentTreeHook ever goes missing, make sure we're not testing
 * with the bundled version of React. If it's still missing, then retire this
 * test.
 *
 * If the displayNames are not helpful in identifying the unmounted component,
 * open Atom with `atom --dev` and inspect the components with:
 *
 *    ReactComponentTreeHook = require.cache[
 *      Object.keys(require.cache).find(x => x.endsWith('/ReactComponentTreeHook.js'))
 *    ].exports;
 *
 *    ReactComponentTreeHook.getRootIDs().map(rootID => {
 *      console.log(ReactComponentTreeHook.getElement(rootID));
 *    });
 */
export function getMountedReactRootNames(): Array<string> {
  const ReactComponentTreeHookPath = Object.keys(require.cache).find(x =>
    x.endsWith('react/lib/ReactComponentTreeHook.js'),
  );
  invariant(
    ReactComponentTreeHookPath != null,
    'ReactComponentTreeHook could not be found in the module cache.',
  );
  const ReactComponentTreeHook =
    require.cache[ReactComponentTreeHookPath].exports;
  const reactRootNames = ReactComponentTreeHook.getRootIDs().map(rootID => {
    return ReactComponentTreeHook.getDisplayName(rootID);
  });
  return reactRootNames;
}
