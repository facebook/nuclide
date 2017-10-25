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

import type {NuclideUri} from 'nuclide-commons/nuclideUri';
import type {EditorLocation, Location} from './Location';

import {setPositionAndScroll} from 'nuclide-commons-atom/text-editor';
import {maybeToString} from 'nuclide-commons/string';
import {NavigationStack} from './NavigationStack';
import invariant from 'assert';
import nuclideUri from 'nuclide-commons/nuclideUri';
import {
  getPathOfLocation,
  getLocationOfEditor,
  editorOfLocation,
} from './Location';
import {Observable} from 'rxjs';

function log(message: string): void {
  // Uncomment this to debug
  // console.log(message);
}

// Handles the state machine that responds to various atom events.
//
// After a Nav move, any non-nav moves or scroll changes update the current
// nav location. So that a nav-stack move(forward/backwards) will return
// position and scroll after the non-nav move/scrolls.
//
// When doing a forwards/backwards nav-stack move, ignore all events
// until the move is complete.
//
// There are several user scenarios, each which spawn different event orders:
// - startup - open file
//     - onActivate, activePaneStopChanging
// - changing tabs
//     - onActivate, activePaneStopChanging
// - atom.workspace.open of closed file
//     - create, scroll, activate, open, scroll, activePaneStopChanging
// - atom.workspace.open of open file, no scroll or move
//     - activate, open, activePaneStopChanging
// - atom.workspace.open of open file, with move
//     - activate, position, open, scroll, activePaneStopChanging
// - atom.workspace.open of current file
//     - position, open, scroll
//
// - nuclide-atom-helpers.goToLocationInEditor
//     - position, onOptInNavigation, [scroll]
//
// In general, when we get a new event, if the editor is not the current,
// then we push a new element on the nav stack; if the editor of the new event
// does match the top of the nav stack, then we update the top of the nav stack
// with the new location.
//
// This works except for the last case of open into the current file.
//
// To deal with the above - we do the following hack:
// If an open occurs and it is not within an activate/activePaneStopChanging pair,
// and the top matches the newly opened editor, then we have the last case
// of 'open within the current file'. So, we restore the current top to its
// previous location before pushing a new top.
export class NavigationStackController {
  _navigationStack: NavigationStack;
  // Indicates that we're processing a forward/backwards navigation in the stack.
  // While processing a navigation stack move we don't update the nav stack.
  _isNavigating: boolean;
  // Indicates that we are in the middle of a activate/onDidStopChangingActivePaneItem
  // pair of events.
  _inActivate: boolean;
  // The last location update we've seen. See discussion below on event order.
  _lastLocation: ?EditorLocation;

  constructor() {
    this._navigationStack = new NavigationStack();
    this._isNavigating = false;
    this._inActivate = false;
    this._lastLocation = null;
  }

  _updateStackLocation(editor: atom$TextEditor): void {
    if (this._isNavigating) {
      return;
    }

    // See discussion below on event order ...
    const previousEditor = this._navigationStack.getCurrentEditor();
    if (previousEditor === editor) {
      const previousLocation = this._navigationStack.getCurrent();
      invariant(previousLocation != null && previousLocation.type === 'editor');
      this._lastLocation = {...previousLocation};
    }
    this._navigationStack.attemptUpdate(getLocationOfEditor(editor));
  }

  updatePosition(editor: atom$TextEditor, newBufferPosition: atom$Point): void {
    log(
      `updatePosition ${newBufferPosition.row}, ` +
        `${newBufferPosition.column} ${maybeToString(editor.getPath())}`,
    );

    this._updateStackLocation(editor);
  }

  // scrollTop is in Pixels
  updateScroll(editor: atom$TextEditor, scrollTop: number): void {
    log(`updateScroll ${scrollTop} ${maybeToString(editor.getPath())}`);

    this._updateStackLocation(editor);
  }

  onCreate(editor: atom$TextEditor): void {
    log(`onCreate ${maybeToString(editor.getPath())}`);

    this._navigationStack.editorOpened(editor);
    this._updateStackLocation(editor);
  }

  onDestroy(editor: atom$TextEditor): void {
    log(`onDestroy ${maybeToString(editor.getPath())}`);

    this._navigationStack.editorClosed(editor);
  }

  // Open is always preceded by activate, unless opening the current file
  onOpen(editor: atom$TextEditor): void {
    log(`onOpen ${maybeToString(editor.getPath())}`);

    // Hack alert, an atom.workspace.open of a location in the current editor,
    // we get the location update before the onDidOpen event, and we don't get
    // an activate/onDidStopChangingActivePaneItem pair. So here,
    // we restore top of the stack to the previous location before pushing a new
    // nav stack entry.
    if (
      !this._inActivate &&
      this._lastLocation != null &&
      this._lastLocation.editor === editor &&
      this._navigationStack.getCurrentEditor() === editor
    ) {
      this._navigationStack.attemptUpdate(this._lastLocation);
      this._navigationStack.push(getLocationOfEditor(editor));
    } else {
      this._updateStackLocation(editor);
    }
    this._lastLocation = null;
  }

  onActivate(editor: atom$TextEditor): void {
    log(`onActivate ${maybeToString(editor.getPath())}`);
    this._inActivate = true;
    this._updateStackLocation(editor);
  }

  onActiveStopChanging(editor: atom$TextEditor): void {
    log(`onActivePaneStopChanging ${maybeToString(editor.getPath())}`);
    this._inActivate = false;
  }

  onOptInNavigation(editor: atom$TextEditor): void {
    log(`onOptInNavigation ${maybeToString(editor.getPath())}`);
    // Opt-in navigation is handled in the same way as a file open with no preceding activation
    this.onOpen(editor);
  }

  // When closing a project path, we remove all stack entries contained in that
  // path which are not also contained in a project path which is remaining open.
  removePath(
    removedPath: NuclideUri,
    remainingDirectories: Array<NuclideUri>,
  ): void {
    log(
      `Removing path ${removedPath} remaining: ${JSON.stringify(
        remainingDirectories,
      )}`,
    );
    this._navigationStack.filter(location => {
      const uri = getPathOfLocation(location);
      return (
        uri == null ||
        !nuclideUri.contains(removedPath, uri) ||
        remainingDirectories.find(directory =>
          nuclideUri.contains(directory, uri),
        ) != null
      );
    });
  }

  async _navigateTo(location: ?Location): Promise<void> {
    invariant(!this._isNavigating);
    if (location == null) {
      return;
    }

    this._isNavigating = true;
    try {
      const editor = await editorOfLocation(location);
      // Note that this will not actually update the scroll position
      // The scroll position update will happen on the next tick.
      log(
        `navigating to: ${location.scrollTop} ${JSON.stringify(
          location.bufferPosition,
        )}`,
      );
      setPositionAndScroll(editor, location.bufferPosition, location.scrollTop);
    } finally {
      this._isNavigating = false;
    }
  }

  async navigateForwards(): Promise<void> {
    log('navigateForwards');
    if (!this._isNavigating) {
      await this._navigateTo(this._navigationStack.next());
    }
  }

  async navigateBackwards(): Promise<void> {
    log('navigateBackwards');
    if (!this._isNavigating) {
      await this._navigateTo(this._navigationStack.previous());
    }
  }

  observeStackChanges(): Observable<NavigationStack> {
    return Observable.of(this._navigationStack).concat(
      this._navigationStack.observeChanges(),
    );
  }

  // For Testing.
  getLocations(): Array<Location> {
    return this._navigationStack.getLocations();
  }

  // For Testing.
  getIndex(): number {
    return this._navigationStack.getIndex();
  }
}
