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

import type {OutlineForUi, OutlineTreeForUi, OutlineProvider} from '..';
import type {Outline, OutlineTree} from './rpc-types';
import type ActiveEditorRegistry, {
  Result,
} from 'nuclide-commons-atom/ActiveEditorRegistry';

import {Observable} from 'rxjs';
import featureConfig from 'nuclide-commons-atom/feature-config';
import invariant from 'assert';

import {getCursorPositions} from 'nuclide-commons-atom/text-editor';

const LOADING_DELAY_MS = 500;

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
      // Render a blank outline when we change panes.
      // If we haven't received anything after LOADING_DELAY_MS, display a loading indicator.
      return Observable.concat(
        Observable.of({kind: 'empty'}),
        Observable.of({kind: 'loading'}).delay(LOADING_DELAY_MS),
      );
    case 'result':
      const outline = result.result;
      if (outline == null) {
        return Observable.of({kind: 'provider-no-outline'});
      }
      return highlightedOutlines(outline, result.editor);
    case 'provider-error':
      return Observable.of({kind: 'provider-no-outline'});
    default:
      // Don't change the UI after 'edit' or 'save' events.
      // It's better to just leave the existing outline visible until the new results come in.
      return Observable.empty();
  }
}

function highlightedOutlines(
  outline: Outline,
  editor: atom$TextEditor,
): Observable<OutlineForUi> {
  const nameOnly = featureConfig.get('nuclide-outline-view.nameOnly');
  const outlineForUi = {
    kind: 'outline',
    outlineTrees: outline.outlineTrees.map(outlineTree =>
      treeToUiTree(outlineTree, Boolean(nameOnly)),
    ),
    editor,
  };

  return getCursorPositions(editor).map(cursorLocation =>
    highlightCurrentNode(outlineForUi, cursorLocation),
  );
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
    highlighted: false,
    children: outlineTree.children.map(tree => treeToUiTree(tree, nameOnly)),
  };
}

// Return an outline object with the node under the cursor highlighted. Does not mutate the
// original.
function highlightCurrentNode(
  outline: OutlineForUi,
  cursorLocation: atom$Point,
): OutlineForUi {
  invariant(outline.kind === 'outline');
  // $FlowIssue
  return {
    ...outline,
    outlineTrees: highlightCurrentNodeInTrees(
      outline.outlineTrees,
      cursorLocation,
    ),
  };
}

function highlightCurrentNodeInTrees(
  outlineTrees: Array<OutlineTreeForUi>,
  cursorLocation: atom$Point,
): Array<OutlineTreeForUi> {
  // The corresponding UI component uses React.PureComponent.
  // Minimize the amount of re-rendering per keystroke by only copying on change.
  let changed = false;
  const newTrees = outlineTrees.map(tree => {
    const highlighted = shouldHighlightNode(tree, cursorLocation);
    const children = highlightCurrentNodeInTrees(tree.children, cursorLocation);
    if (highlighted === tree.highlighted && children === tree.children) {
      return tree;
    }
    changed = true;
    return {
      ...tree,
      highlighted,
      children,
    };
  });
  return changed ? newTrees : outlineTrees;
}

function shouldHighlightNode(
  outlineTree: OutlineTreeForUi,
  cursorLocation: atom$Point,
): boolean {
  const startPosition = outlineTree.startPosition;
  const endPosition = outlineTree.endPosition;
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
