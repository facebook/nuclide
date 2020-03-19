/**
 * Copyright (c) 2015-present, Facebook, Inc.
 * All rights reserved.
 *
 * This source code is licensed under the license found in the LICENSE file in
 * the root directory of this source tree.
 *
 * @flow strict-local
 * @format
 */

import nuclideUri from 'nuclide-commons/nuclideUri';

const MAX_HIGHLIGHT_MARKERS = 400;

// Patches the highlight-selected package to only highlight the first `MAX_HIGHLIGHT_MARKERS`
// occurrences of the lighted term. Doing so unbounded causes a single long, blocking
// operation while markers are created.
export default function patchHighlightView(): IDisposable {
  let disposed;

  atom.packages.onDidActivatePackage(pkg => {
    if (pkg.name !== 'highlight-selected') {
      return;
    }

    if (pkg.metadata.version !== '0.14.0') {
      // This patch assumes a lot about the internals of this specific version.
      // In the case this is not 0.14.0, don't attempt to patch.
      return;
    }

    const highlightSelectedPackageDir = nuclideUri.dirname(
      require.resolve(atom.packages.loadedPackages['highlight-selected'].path),
    );
    const escapeRegExp = require(nuclideUri.resolve(
      highlightSelectedPackageDir,
      'escape-reg-exp',
    ));
    const HighlightedAreaView = require(nuclideUri.resolve(
      highlightSelectedPackageDir,
      'highlighted-area-view',
    ));

    const oldHighlightSelectionInEditor =
      HighlightedAreaView.prototype.highlightSelectionInEditor;

    HighlightedAreaView.prototype.highlightSelectionInEditor = function patchedHighlightSelectionInEditor(
      ...args
    ) {
      if (disposed) {
        return oldHighlightSelectionInEditor.apply(this, args);
      }

      return highlightSelectionInEditorWithLimit.apply(this, args);
    };

    // Vendored from coffeescript compiler output derived from
    // https://github.com/richrace/highlight-selected/blob/ee83dad21f033b2610d247253224b0b7818271e7/lib/highlighted-area-view.coffee#L165
    // TODO: (wbinnssmith) T36697705 Remove when config option upstreamed
    /* eslint-disable */
    function highlightSelectionInEditorWithLimit(
      editor,
      regexSearch,
      regexFlags,
      originalEditor,
    ) {
      var markerLayer, markerLayerForHiddenMarkers, markerLayers;
      if (editor == null) {
        return;
      }

      markerLayers = this.editorToMarkerLayerMap[editor.id];
      if (markerLayers == null) {
        return;
      }

      markerLayer = markerLayers['visibleMarkerLayer'];
      markerLayerForHiddenMarkers = markerLayers['selectedMarkerLayer'];
      editor.scan(new RegExp(regexSearch, regexFlags), result => {
        if (this.resultCount >= MAX_HIGHLIGHT_MARKERS) {
          return;
        }

        var marker, newResult;
        newResult = result;
        if (atom.config.get('highlight-selected.onlyHighlightWholeWords')) {
          editor.scanInBufferRange(
            new RegExp(escapeRegExp(result.match[1])),
            result.range,
            function(e) {
              return (newResult = e);
            },
          );
        }
        if (newResult == null) {
          return;
        }

        this.resultCount += 1;
        if (
          this.showHighlightOnSelectedWord(newResult.range, this.selections) &&
          (originalEditor != null ? originalEditor.id : void 0) === editor.id
        ) {
          marker = markerLayerForHiddenMarkers.markBufferRange(newResult.range);
          this.emitter.emit('did-add-selected-marker', marker);
          return this.emitter.emit('did-add-selected-marker-for-editor', {
            marker: marker,
            editor: editor,
          });
        } else {
          marker = markerLayer.markBufferRange(newResult.range);
          this.emitter.emit('did-add-marker', marker);
          return this.emitter.emit('did-add-marker-for-editor', {
            marker: marker,
            editor: editor,
          });
        }
      });
      return editor.decorateMarkerLayer(markerLayer, {
        type: 'highlight',
        class: this.makeClasses(),
      });
    }
    /* eslint-enable */
  });

  return {
    dispose() {
      disposed = true;
    },
  };
}
