/**
 * Copyright (c) 2017-present, Facebook, Inc.
 * All rights reserved.
 *
 * This source code is licensed under the BSD-style license found in the
 * LICENSE file in the root directory of this source tree. An additional grant
 * of patent rights can be found in the PATENTS file in the same directory.
 *
 * @flow
 * @format
 */

import type {
  Outline,
  OutlineProvider,
  OutlineTree,
  OutlineTreeKind,
} from './types';
import type {TokenizedText} from 'nuclide-commons/tokenized-text';
import type ActiveEditorRegistry, {
  Result,
} from 'nuclide-commons-atom/ActiveEditorRegistry';

import {Observable} from 'rxjs';
import featureConfig from 'nuclide-commons-atom/feature-config';
import {getCursorPositions} from 'nuclide-commons-atom/text-editor';
import {arrayEqual} from 'nuclide-commons/collection';

const LOADING_DELAY_MS = 500;
const OUTLINE_DEBOUNCE_DELAY = 100;

import type {NodePath} from 'nuclide-commons-ui/SelectableTree';

export type OutlineTreeForUi = {
  icon?: string, // from atom$Octicon, but we use string for convenience of remoting
  kind?: OutlineTreeKind, // kind you can pass to the UI for theming
  plainText?: string,
  tokenizedText?: TokenizedText,

  startPosition: atom$Point,
  endPosition?: atom$Point,
  landingPosition?: atom$Point,
  children: Array<OutlineTreeForUi>,
};

/**
 * Includes additional information that is useful to the UI, but redundant or nonsensical for
 * providers to include in their responses.
 */
export type OutlineForUi =
  | {
      // The initial state at startup.
      kind: 'empty',
    }
  | {
      // The thing that currently has focus is not a text editor.
      kind: 'not-text-editor',
    }
  | {
      // Currently awaiting results from a provider (for longer than a certain delay).
      kind: 'loading',
    }
  | {
      // Indicates that no provider is registered for the given grammar.
      kind: 'no-provider',
      // Human-readable name for the grammar.
      grammar: string,
    }
  | {
      // Indicates that a provider is registered but that it did not return an outline.
      kind: 'provider-no-outline',
    }
  | {
      kind: 'outline',
      outlineTrees: Array<OutlineTreeForUi>,
      highlightedPaths: Array<NodePath>,
      /**
       * Use a TextEditor instead of a path so that:
       * - If there are multiple editors for a file, we always jump to outline item
       *   locations in the correct editor.
       * - Jumping to outline item locations works for new, unsaved files.
       */
      editor: atom$TextEditor,
    };

export function createOutlines(
  editorService: ActiveEditorRegistry<OutlineProvider, ?Outline>,
): Observable<OutlineForUi> {
  return outlinesForProviderResults(editorService.getResultsStream());
}

function outlinesForProviderResults(
  providerResults: Observable<Result<OutlineProvider, ?Outline>>,
): Observable<OutlineForUi> {
  return providerResults.switchMap(uiOutlinesForResult);
}

function uiOutlinesForResult(
  result: Result<OutlineProvider, ?Outline>,
): Observable<OutlineForUi> {
  switch (result.kind) {
    case 'not-text-editor':
      return Observable.of({kind: 'not-text-editor'});
    case 'no-provider':
      return Observable.of({
        kind: 'no-provider',
        grammar: result.grammar.name,
      });
    case 'pane-change':
      // Originally, we displayed a empty pane immediately, but this caused an undesireable
      // flickering effect so we prefer stale information for the first LOADING_DELAY_MS.
      // If we haven't received anything after LOADING_DELAY_MS, display a loading indicator.
      return Observable.concat(
        Observable.of({kind: 'loading'}).delay(LOADING_DELAY_MS),
      );
    case 'result':
      const outline = result.result;
      if (outline == null) {
        return Observable.of({kind: 'provider-no-outline'});
      }
      return rootOutline(outline, result.editor);
    case 'provider-error':
      return Observable.of({kind: 'provider-no-outline'});
    default:
      // Don't change the UI after 'edit' or 'save' events.
      // It's better to just leave the existing outline visible until the new results come in.
      return Observable.empty();
  }
}

function rootOutline(
  outline: Outline,
  editor: atom$TextEditor,
): Observable<OutlineForUi> {
  const nameOnly = featureConfig.get('atom-ide-outline-view.nameOnly');
  const outlineTrees = outline.outlineTrees.map(outlineTree =>
    treeToUiTree(outlineTree, Boolean(nameOnly)),
  );

  return getHighlightedPaths(outline, editor).map(highlightedPaths => ({
    kind: 'outline',
    highlightedPaths,
    outlineTrees,
    editor,
  }));
}

function treeToUiTree(
  outlineTree: OutlineTree,
  nameOnly: boolean,
): OutlineTreeForUi {
  const shortName = nameOnly && outlineTree.representativeName != null;
  return {
    icon: nameOnly ? undefined : outlineTree.icon,
    kind: nameOnly ? undefined : outlineTree.kind,
    plainText: shortName
      ? outlineTree.representativeName
      : outlineTree.plainText,
    tokenizedText: shortName ? undefined : outlineTree.tokenizedText,
    startPosition: outlineTree.startPosition,
    endPosition: outlineTree.endPosition,
    landingPosition: outlineTree.landingPosition,
    children: outlineTree.children.map(tree => treeToUiTree(tree, nameOnly)),
  };
}

function getHighlightedPaths(
  outline: Outline,
  editor: atom$TextEditor,
): Observable<Array<NodePath>> {
  return (
    getCursorPositions(editor)
      .debounceTime(OUTLINE_DEBOUNCE_DELAY)
      // optimization: the outline never needs to update when navigating within a row
      .distinctUntilChanged((p1, p2) => p1.row === p2.row)
      .map(position => {
        return highlightedPathsForOutline(outline, position);
      })
      .distinctUntilChanged((p1, p2) => arrayEqual(p1, p2, arrayEqual))
  );
}

function highlightedPathsForOutline(
  outline: Outline,
  position: atom$Point,
): Array<NodePath> {
  const paths = [];
  function findHighlightedNodes(
    currentNode: OutlineTree,
    currentPath: NodePath,
  ) {
    if (shouldHighlightNode(currentNode, position)) {
      paths.push(currentPath);
    }
    if (currentNode.children) {
      currentNode.children.forEach((n, i) =>
        findHighlightedNodes(n, currentPath.concat([i])),
      );
    }
  }
  outline.outlineTrees.forEach((o, i) => findHighlightedNodes(o, [i]));

  return paths;
}

function shouldHighlightNode(
  outlineTree: OutlineTree,
  cursorLocation: atom$Point,
): boolean {
  const {startPosition, endPosition} = outlineTree;
  if (endPosition == null) {
    return false;
  }
  if (outlineTree.children.length !== 0) {
    const childStartPosition = outlineTree.children[0].startPosition;
    // Since the parent is rendered in the list above the children, it doesn't really make sense to
    // highlight it if you are below the start position of any child. However, if you are at the top
    // of a class it does seem desirable to highlight it.
    return (
      cursorLocation.isGreaterThanOrEqual(startPosition) &&
      cursorLocation.isLessThan(childStartPosition)
    );
  }
  return (
    cursorLocation.isGreaterThanOrEqual(startPosition) &&
    cursorLocation.isLessThanOrEqual(endPosition)
  );
}
