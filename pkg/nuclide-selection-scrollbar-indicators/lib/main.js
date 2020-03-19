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
  ScrollbarIndicatorMark,
} from '../../nuclide-scrollbar-indicators';

import createPackage from 'nuclide-commons-atom/createPackage';
import {observableFromSubscribeFunction} from 'nuclide-commons/event';
import {arrayEqual} from 'nuclide-commons/collection';
import UniversalDisposable from 'nuclide-commons/UniversalDisposable';
import {Subject, Observable} from 'rxjs';

function marksDiffer(
  rangeA: ScrollbarIndicatorMark,
  rangeB: ScrollbarIndicatorMark,
): boolean {
  return rangeA.start === rangeB.start && rangeA.end === rangeB.end;
}

function getCursorPositions(
  editor: atom$TextEditor,
): Observable<Array<atom$Point>> {
  return Observable.merge(
    observableFromSubscribeFunction(cb => editor.onDidChangeCursorPosition(cb)),
    observableFromSubscribeFunction(cb => editor.onDidAddCursor(cb)),
    observableFromSubscribeFunction(cb => editor.onDidRemoveCursor(cb)),
  ).map(() => editor.getCursorBufferPositions());
}

class Activation {
  _disposables: UniversalDisposable;
  _updates: Subject<ScrollbarIndicatorUpdate>;

  constructor(state: ?mixed) {
    this._disposables = new UniversalDisposable();
    this._updates = new Subject();
    this._disposables.add(
      observableFromSubscribeFunction(cb =>
        atom.workspace.observeTextEditors(cb),
      )
        .mergeMap(editor => {
          return Observable.combineLatest(
            getCursorPositions(editor)
              .map(cursorPoints => cursorPoints.map(point => point.row))
              .distinctUntilChanged(arrayEqual)
              .map(rows => {
                return new Set(rows.map(row => ({start: row, end: row})));
              }),
            observableFromSubscribeFunction(cb =>
              editor.onDidChangeSelectionRange(cb),
            )
              .map(({newBufferRange}) => {
                return {
                  start: newBufferRange.start.row,
                  end: newBufferRange.end.row,
                };
              })
              .distinctUntilChanged(marksDiffer),
          ).map(([cursors, selection]) => {
            return {
              editor,
              markTypes: new Map([
                ['CURSOR', cursors],
                ['SELECTION', new Set([selection])],
              ]),
            };
          });
        })
        .subscribe((update: ScrollbarIndicatorUpdate) => {
          this._updates.next(update);
        }),
    );
  }

  dispose(): void {
    this._disposables.dispose();
  }

  provideScrollbarIndicators(): ScrollbarIndicatorProvider {
    return {
      onUpdate: cb => new UniversalDisposable(this._updates.subscribe(cb)),
    };
  }
}

createPackage(module.exports, Activation);
