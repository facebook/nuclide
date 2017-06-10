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

import type {DiagnosticMessage} from '../../atom-ide-diagnostics';
import type {IconName} from 'nuclide-commons-ui/Icon';

import {compareMessagesByFile} from './paneUtils';
import React from 'react';
import DiagnosticsView from './DiagnosticsView';
import analytics from 'nuclide-commons-atom/analytics';
import observePaneItemVisibility
  from 'nuclide-commons-atom/observePaneItemVisibility';
import {renderReactRoot} from 'nuclide-commons-ui/renderReactRoot';
import {isValidTextEditor} from 'nuclide-commons-atom/text-editor';
import {observableFromSubscribeFunction} from 'nuclide-commons/event';
import {toggle} from 'nuclide-commons/observable';
import {bindObservableAsProps} from 'nuclide-commons-ui/bindObservableAsProps';
import {BehaviorSubject, Observable} from 'rxjs';

type PanelProps = {
  +diagnostics: Array<DiagnosticMessage>,
  +pathToActiveTextEditor: ?string,
  +filterByActiveTextEditor: boolean,
  +onFilterByActiveTextEditorChange: (isChecked: boolean) => void,
  +warnAboutLinter: boolean,
  +showTraces: boolean,
  +disableLinter: () => void,
  +onShowTracesChange: (isChecked: boolean) => void,
};

type SerializedDiagnosticsViewModel = {
  deserializer: 'atom-ide-ui.DiagnosticsViewModel',
};

export const WORKSPACE_VIEW_URI = 'atom://nuclide/diagnostics';

const RENDER_DEBOUNCE_TIME = 100;

export class DiagnosticsViewModel {
  _element: ?HTMLElement;
  _props: Observable<PanelProps>;
  _visibility: BehaviorSubject<boolean>;
  _visibilitySubscription: rxjs$ISubscription;

  constructor(
    diagnostics: Observable<Array<DiagnosticMessage>>,
    showTracesStream: Observable<boolean>,
    onShowTracesChange: (showTraces: boolean) => void,
    disableLinter: () => void,
    warnAboutLinterStream: Observable<boolean>,
    initialfilterByActiveTextEditor: boolean,
    onFilterByActiveTextEditorChange: (
      filterByActiveTextEditor: boolean,
    ) => void,
  ) {
    // TODO(T17495163)
    this._visibilitySubscription = observePaneItemVisibility(
      this,
    ).subscribe(visible => {
      this.didChangeVisibility(visible);
    });
    this._visibility = new BehaviorSubject(true);

    this._visibilitySubscription = this._visibility
      .debounceTime(1000)
      .distinctUntilChanged()
      .filter(Boolean)
      .subscribe(() => {
        analytics.track('diagnostics-show-table');
      });

    // A stream that contains the props, but is "muted" when the panel's not visible.
    this._props = toggle(
      getPropsStream(
        diagnostics,
        warnAboutLinterStream,
        showTracesStream,
        onShowTracesChange,
        disableLinter,
        initialfilterByActiveTextEditor,
        onFilterByActiveTextEditorChange,
      )
        .publishReplay(1)
        .refCount(),
      this._visibility.distinctUntilChanged(),
    );
  }

  destroy(): void {
    this._visibilitySubscription.unsubscribe();
  }

  getTitle(): string {
    return 'Diagnostics';
  }

  getIconName(): IconName {
    return 'law';
  }

  getURI(): string {
    return WORKSPACE_VIEW_URI;
  }

  getDefaultLocation(): string {
    return 'bottom';
  }

  serialize(): SerializedDiagnosticsViewModel {
    return {
      deserializer: 'atom-ide-ui.DiagnosticsViewModel',
    };
  }

  didChangeVisibility(visible: boolean): void {
    this._visibility.next(visible);
  }

  getElement(): HTMLElement {
    if (this._element == null) {
      const Component = bindObservableAsProps(this._props, DiagnosticsView);
      const element = renderReactRoot(<Component />);
      element.classList.add('nuclide-diagnostics-ui');
      this._element = element;
    }
    return this._element;
  }
}

function getPropsStream(
  diagnosticsStream: Observable<Array<DiagnosticMessage>>,
  warnAboutLinterStream: Observable<boolean>,
  showTracesStream: Observable<boolean>,
  onShowTracesChange: (showTraces: boolean) => void,
  disableLinter: () => void,
  initialfilterByActiveTextEditor: boolean,
  onFilterByActiveTextEditorChange: (filterByActiveTextEditor: boolean) => void,
): Observable<PanelProps> {
  const activeTextEditorPaths = observableFromSubscribeFunction(
    atom.workspace.observeActivePaneItem.bind(atom.workspace),
  )
    .map(paneItem => {
      if (isValidTextEditor(paneItem)) {
        const textEditor: atom$TextEditor = (paneItem: any);
        return textEditor ? textEditor.getPath() : null;
      }
    })
    .distinctUntilChanged();

  const sortedDiagnostics = Observable.concat(
    Observable.of([]),
    diagnosticsStream
      .debounceTime(RENDER_DEBOUNCE_TIME)
      .map(diagnostics => diagnostics.slice().sort(compareMessagesByFile)),
    // If the diagnostics stream ever terminates, clear all messages.
    Observable.of([]),
  );

  const filterByActiveTextEditorStream = new BehaviorSubject(
    initialfilterByActiveTextEditor,
  );
  const handleFilterByActiveTextEditorChange = (
    filterByActiveTextEditor: boolean,
  ) => {
    filterByActiveTextEditorStream.next(filterByActiveTextEditor);
    onFilterByActiveTextEditorChange(filterByActiveTextEditor);
  };

  return Observable.combineLatest(
    activeTextEditorPaths,
    sortedDiagnostics,
    warnAboutLinterStream,
    filterByActiveTextEditorStream,
    showTracesStream,
  ).map(
    (
      [pathToActiveTextEditor, diagnostics, warnAboutLinter, filter, traces],
    ) => ({
      pathToActiveTextEditor,
      diagnostics,
      warnAboutLinter,
      showTraces: traces,
      onShowTracesChange,
      disableLinter,
      filterByActiveTextEditor: filter,
      onFilterByActiveTextEditorChange: handleFilterByActiveTextEditorChange,
    }),
  );
}
