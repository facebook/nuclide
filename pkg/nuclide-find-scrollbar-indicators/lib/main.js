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

import type {
  ScrollbarIndicatorUpdate,
  ScrollbarIndicatorProvider,
} from '../../nuclide-scrollbar-indicators';
import createPackage from 'nuclide-commons-atom/createPackage';
import {MutationObservable} from 'nuclide-commons-ui/observable-dom';
import {macrotask} from 'nuclide-commons/observable';
import {observableFromSubscribeFunction} from 'nuclide-commons/event';
import UniversalDisposable from 'nuclide-commons/UniversalDisposable';
import {Subject, Observable} from 'rxjs';

type FindService = {
  resultsMarkerLayerForTextEditor(atom$TextEditor): atom$DisplayMarkerLayer,
};

class Activation {
  _disposables: UniversalDisposable;
  _updates: Subject<ScrollbarIndicatorUpdate>;

  constructor(state: ?mixed) {
    this._disposables = new UniversalDisposable();
    this._updates = new Subject();
  }

  dispose(): void {
    this._disposables.dispose();
  }

  provideScrollbarIndicators(): ScrollbarIndicatorProvider {
    return {
      onUpdate: cb => new UniversalDisposable(this._updates.subscribe(cb)),
    };
  }

  consumeFind(findService: FindService): IDisposable {
    // atom/find-and-replace uses the presence of a `find-visible` class on the
    // workspace to determine if it should show its own highlights.
    // We will follow that lead.
    const workspace = atom.views.getView(atom.workspace);
    const getFindIsVisible = (): boolean =>
      workspace.classList.contains('find-visible');

    const findVisiblity = new MutationObservable(workspace, {
      attributes: true,
      attributeFilter: ['class'],
    })
      .map(getFindIsVisible)
      .startWith(getFindIsVisible())
      .distinctUntilChanged()
      .shareReplay(1);

    const disposable = new UniversalDisposable(
      observableFromSubscribeFunction(cb =>
        atom.workspace.observeTextEditors(cb),
      )
        .mergeMap(editor => {
          const searchMarkerLayer = findService.resultsMarkerLayerForTextEditor(
            editor,
          );

          return Observable.combineLatest(
            findVisiblity,
            observableFromSubscribeFunction(cb =>
              searchMarkerLayer.onDidUpdate(cb),
            ),
          )
            .switchMap(([visible]) => {
              if (!visible) {
                return Observable.of({editor, markTypes: new Map()});
              }
              // TODO: I'm not sure why this macrotask is needed, but calling
              // `getMarkers` without it seems to return no markers.
              return macrotask.first().map(() => {
                const marks = searchMarkerLayer.getMarkers().map(marker => {
                  const range = marker.getBufferRange();
                  return {
                    start: range.start.row,
                    end: range.end.row,
                  };
                });
                return {
                  editor,
                  markTypes: new Map([['SEARCH_RESULT', new Set(marks)]]),
                };
              });
            })
            .takeUntil(
              observableFromSubscribeFunction(cb => editor.onDidDestroy(cb)),
            );
        })
        .subscribe(update => {
          this._updates.next(update);
        }),
    );
    this._disposables.add(disposable);
    return disposable;
  }
}

createPackage(module.exports, Activation);
