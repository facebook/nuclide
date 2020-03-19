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
  ScrollbarIndicatorMarkType,
} from '../../nuclide-scrollbar-indicators';
import createPackage from 'nuclide-commons-atom/createPackage';

import type {NuclideUri} from 'nuclide-commons/nuclideUri';
import {arrayPartition} from 'nuclide-commons/collection';
import type {
  DiagnosticUpdater,
  DiagnosticMessage,
} from '../../../modules/atom-ide-ui/pkg/atom-ide-diagnostics/lib/types';

import {observableFromSubscribeFunction} from 'nuclide-commons/event';
import {throttle} from 'nuclide-commons/observable';
import UniversalDisposable from 'nuclide-commons/UniversalDisposable';
import {Subject, Observable} from 'rxjs';

const VISIBLE_TYPES = new Set(['Error']);
const DIAGNOSTICS_THROTTLE_TIME = 200;

function getMarkTypesFromMessages(
  messages: Array<DiagnosticMessage>,
): Map<ScrollbarIndicatorMarkType, Set<ScrollbarIndicatorMark>> {
  const [staleMessages, notStaleMessages] = arrayPartition(messages, message =>
    Boolean(message.stale),
  );
  return new Map([
    ['DIAGNOSTIC_ERROR', visibleLinesFromMessages(notStaleMessages)],
    ['STALE_DIAGNOSTIC_ERROR', visibleLinesFromMessages(staleMessages)],
  ]);
}

function visibleLinesFromMessages(
  messages: Array<DiagnosticMessage>,
): Set<ScrollbarIndicatorMark> {
  const marks = new Set();
  messages.forEach(message => {
    if (VISIBLE_TYPES.has(message.type) && message.range != null) {
      marks.add({
        start: message.range.start.row,
        end: message.range.end.row,
      });
    }
  });
  return marks;
}

function observeEditorPaths(editor): Observable<?NuclideUri> {
  return observableFromSubscribeFunction(cb => editor.onDidChangePath(cb))
    .startWith(editor.getPath())
    .takeUntil(observableFromSubscribeFunction(cb => editor.onDidDestroy(cb)));
}

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

  consumeDiagnosticUpdates(diagnosticUpdater: DiagnosticUpdater): IDisposable {
    const scrollbarUpdates = observableFromSubscribeFunction(cb =>
      atom.workspace.observeTextEditors(cb),
    ).mergeMap(editor =>
      observeEditorPaths(editor)
        .filter(Boolean)
        .switchMap(path =>
          observableFromSubscribeFunction(cb =>
            diagnosticUpdater.observeFileMessages(path, cb),
          ),
        )
        .let(throttle(DIAGNOSTICS_THROTTLE_TIME))
        .map(messages => ({
          markTypes: getMarkTypesFromMessages(messages.messages),
          editor,
        })),
    );

    const disposable = new UniversalDisposable(
      scrollbarUpdates.subscribe(update => {
        this._updates.next(update);
      }),
    );
    this._disposables.add(disposable);
    return disposable;
  }
}

createPackage(module.exports, Activation);
