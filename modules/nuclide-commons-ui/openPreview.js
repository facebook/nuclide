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

import type {NuclideUri} from 'nuclide-commons/nuclideUri';

import type {GoToLocationOptions} from 'nuclide-commons-atom/go-to-location';
import {goToLocation} from 'nuclide-commons-atom/go-to-location';
import {isPending} from 'nuclide-commons-atom/pane-item';
import {delayTime} from 'nuclide-commons/promise';

type OpenablePreview = {|
  cancel: () => void,
  confirm: () => Promise<?atom$TextEditor>,
  _promise: Promise<?atom$TextEditor>,
|};

let preview: ?atom$TextEditor;
let marker: ?atom$Marker;
let originalPoint: ?{
  item: atom$PaneItem,
  point: ?atom$Point,
};
let lastOpenablePreview: ?OpenablePreview;

let activeOpenableId = 0;

// Previews a particular destination using goToLocation. This may involve opening
// a new pane if the destination uri is not the active item. However, if the
// user has disabled preview panes, we won't show them a preview.

// openPreview supports being called many times, and it deallocates prior
// previews on its own when this happens. It also returns the user's focus when
// to the original destination when cancelled. This *could* be implemented using
// a stack, but this simpler implementation just holds global references and restores
// focus using the active item and position that was present when the first preview occurred.
export default function openPreview(
  uri: NuclideUri,
  // $FlowIgnore
  options?: GoToLocationOptions = {},
  openDelay?: number = 0,
): OpenablePreview {
  const {line, column} = options;
  const thisOpenableId = ++activeOpenableId;

  if (lastOpenablePreview != null) {
    lastOpenablePreview.cancel();
  }

  let canceled;
  let confirmed;

  const activeItem = atom.workspace.getActivePaneItem();
  const activeEditor = atom.workspace.getActiveTextEditor();

  if (preview == null && activeItem != null) {
    // this is the first preview in a potential "stack" of previews.
    // persist the current position so we can return to it later.
    originalPoint = {
      item: activeItem,
      point:
        activeItem === activeEditor && activeEditor != null
          ? activeEditor.getCursorBufferPosition()
          : null,
    };
  }

  const isWithinSameFile = uri === (activeEditor && activeEditor.getURI());
  const arePendingPanesEnabled = Boolean(
    atom.config.get('core.allowPendingPaneItems'),
  );

  let promise;
  if (isWithinSameFile || arePendingPanesEnabled) {
    // a common case is scrolling through many results, cancelling one after
    // the other. give things a chance to cancel before going throught the work
    // of rendering a preview
    promise = delayTime(openDelay).then(() => {
      if (preview != null && isPending(preview) && preview.isModified()) {
        // To avoid leaving behind a "Save changes before close?" dialog, forcefully
        // destroy any pane that is both pending *and* modified
        preview.destroy();
      }

      if (canceled) {
        return Promise.resolve();
      } else {
        return goToLocation(uri, {
          line,
          column,
          center: true,
          activateItem: true,
          activatePane: false,
          pending: true,
          moveCursor: false,
        }).then(newPreview => {
          if (
            canceled &&
            isPending(newPreview) &&
            // don't destroy the pane if it's not new (e.g. within the same file --
            // like a symbol within the originating file)
            originalPoint != null &&
            newPreview !== originalPoint.item
          ) {
            newPreview.destroy();
            return;
          }

          // the pane may have been reused: e.g. previewing a line in the same file
          // so make sure it wasn't. Then destroy the old preview if it's not the
          // original pane.
          if (preview != null && isPending(preview) && preview !== newPreview) {
            preview.destroy();
          }

          if (marker != null) {
            marker.destroy();
            marker = null;
          }

          preview = newPreview;

          // highlight the relevant line (and possibly point if there's a column)
          // if a line is provided in the options
          if (line != null) {
            marker = preview.markBufferPosition({
              row: line,
              column: column == null ? 0 : column,
            });
            preview.decorateMarker(marker, {
              type: 'line',
              class: 'nuclide-line-preview',
            });
          }

          return newPreview;
        });
      }
    });
  } else {
    promise = Promise.resolve();
  }

  const openablePreview = {
    cancel() {
      canceled = true;

      if (activeOpenableId !== thisOpenableId) {
        // the next preview has cleaned up our markers for us
        return;
      }

      if (confirmed) {
        throw new Error(
          'A preview cannot be cancelled after it has been confirmed.',
        );
      }

      if (
        preview != null &&
        (originalPoint == null || preview !== originalPoint.item)
      ) {
        preview.destroy();
      }
      preview = null;

      if (marker != null) {
        marker.destroy();
        marker = null;
      }
    },
    confirm() {
      if (activeOpenableId !== thisOpenableId) {
        // another preview is currently being shown
        throw new Error(
          'Another preview has become active after this one was shown. Cannot confirm.',
        );
      }

      if (canceled) {
        throw new Error(
          'A preview cannot be confirmed after it has been cancelled',
        );
      }

      confirmed = true;

      const goToLocationPromise = goToLocation(uri, options).then(newEditor => {
        newEditor.terminatePendingState();
        if (
          preview != null &&
          preview !== newEditor &&
          (originalPoint == null || preview !== originalPoint.item)
        ) {
          // This case seems very unlikely: if the editor opened on confirmation
          // is not the same editor that was used for the preview pane, destroy
          // the preview pane
          preview.destroy();
        }
      });

      if (marker != null) {
        marker.destroy();
        marker = null;
      }
      preview = null;

      return goToLocationPromise;
    },
    // exported for test
    _promise: promise,
  };

  lastOpenablePreview = openablePreview;
  return openablePreview;
}
