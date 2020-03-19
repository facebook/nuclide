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
import * as React from 'react';
import ReactDOM from 'react-dom';

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
 * Patches React's internals to keep record of components that are never
 * unmounted. Having mounted React components after the creator has been
 * disposed is a sign that there are problems in the cleanup logic.
 */
const mountedRootComponents: Map<Element, React.Node> = new Map();

const oldReactRender = ReactDOM.render.bind(ReactDOM);
// $FlowFixMe Patching for test
ReactDOM.render = function render<ElementType: React$ElementType>(
  element: React$Element<ElementType>,
  container: Element,
  callback?: () => void,
): React$ElementRef<ElementType> {
  mountedRootComponents.set(container, element);
  return oldReactRender(element, container, callback);
};

const oldReactUnmountComponentAtNode = ReactDOM.unmountComponentAtNode.bind(
  ReactDOM,
);
// $FlowFixMe Patching for test
ReactDOM.unmountComponentAtNode = function unmountComponentAtNode(
  container: Element,
): boolean {
  mountedRootComponents.delete(container);
  return oldReactUnmountComponentAtNode(container);
};

export function getMountedReactRootNames(): Array<string> {
  return Array.from(mountedRootComponents)
    .map(([element, container]) => element)
    .map(element => {
      const constructor = element.constructor;
      // $FlowFixMe(>=0.68.0) Flow suppress (T27187857)
      if (typeof constructor.displayName === 'string') {
        return constructor.displayName;
      } else if (typeof constructor.name === 'string') {
        return constructor.name;
      } else {
        return 'Unknown';
      }
    });
}
