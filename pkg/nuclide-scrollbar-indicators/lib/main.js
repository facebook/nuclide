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

export type {ScrollbarIndicatorMarkType} from './constants';
export {scrollbarMarkTypes} from './constants';

import type {ThemeColors} from './themeColors';
import type {Props} from './ScrollBar';

import type {ScrollbarIndicatorMarkType} from './constants';
import {memoize} from 'lodash';
import observePaneItemVisibility from 'nuclide-commons-atom/observePaneItemVisibility';
import {bindObservableAsProps} from 'nuclide-commons-ui/bindObservableAsProps';
import {renderReactRoot} from 'nuclide-commons-ui/renderReactRoot';
import {setUnion} from 'nuclide-commons/collection';
import {observableFromSubscribeFunction} from 'nuclide-commons/event';
import Model from 'nuclide-commons/Model';
import {throttle, nextAnimationFrame} from 'nuclide-commons/observable';
import * as React from 'react';
import Immutable from 'immutable';
import createPackage from 'nuclide-commons-atom/createPackage';
import UniversalDisposable from 'nuclide-commons/UniversalDisposable';
import nullthrows from 'nullthrows';
import {Observable} from 'rxjs';
import {scrollbarMarkTypes} from './constants';
import ScrollBar from './ScrollBar';

import {getThemeChangeEvents, getThemeColors} from './themeColors';

export type ScrollbarIndicatorMark = {|
  +start: number,
  +end: number,
|};

export type ScrollbarIndicatorUpdate = {
  editor: atom$TextEditor,
  markTypes: Map<ScrollbarIndicatorMarkType, Set<ScrollbarIndicatorMark>>,
};
export type ScrollbarIndicatorProvider = {
  onUpdate: ((ScrollbarIndicatorUpdate) => void) => IDisposable,
};

type EditorMarks = Immutable.Map<
  atom$TextEditor,
  Immutable.Map<
    ScrollbarIndicatorMarkType,
    Immutable.Map<ScrollbarIndicatorProvider, Set<ScrollbarIndicatorMark>>,
  >,
>;

const markLinesFromProviderMarks = memoize(providerMarks =>
  setUnion(...providerMarks.values()),
);
markLinesFromProviderMarks.cache = new WeakMap();

class Activation {
  _disposables: UniversalDisposable;
  _model: Model<{editorLines: EditorMarks, colors: ?ThemeColors}>;

  constructor() {
    this._disposables = new UniversalDisposable();
    this._model = new Model({editorLines: Immutable.Map(), colors: null});

    this._disposables.add(
      getThemeChangeEvents().subscribe(colors => {
        this._model.setState({colors: getThemeColors()});
      }),
      atom.workspace.observeTextEditors(editor => {
        const props: Observable<Props> = Observable.combineLatest(
          this._model.toObservable().map(state => ({
            markTypes: state.editorLines.get(editor) || Immutable.Map(),
            colors: state.colors,
          })),
          observePaneItemVisibility(editor),
          observableFromSubscribeFunction(cb =>
            // Take note: This is called every time a character is added/removed`.
            // $FlowFixMe - `editor.displayLayer is not a public API
            editor.displayLayer.onDidChange(cb),
          )
            .startWith(null)
            // `editor.getScreenLineCount()` should be fast, since the
            // displayLayer keeps this data cached. However, it does force a
            // quick check to see if the cache needs to be recomputed.
            .map(() => editor.getScreenLineCount())
            .distinctUntilChanged()
            .map(screenLineCount => {
              return {
                screenLineCount,
                // Computing the mapping from file line number to the displayed
                // line number can be expensive. As far as I can tell, the
                // results can be cached as long as folds or soft line wraps
                // don't change.
                //
                // The following attempt at caching assumes that every fold/wrap
                // change triggers a display layer change and results in a
                // change to screenLineCount, which I _think_ is safe. The cache
                // will be unnecessarily cleared every time a line is added or
                // removed, but I don't know of a way to directly detect
                // fold/wrap changes.
                //
                // This mostly just saves us from the following situation:
                //
                // You have a large number of diagnostics. As you type these
                // are rapidly rerevaluated and replaced with results which
                // are 90% the same.
                //
                // -- @jeldredge
                screenRowForBufferRow: memoize(
                  row => editor.screenPositionForBufferPosition([row, 0]).row,
                ),
              };
            }),
        )
          .map(
            ([
              {markTypes, markers, colors},
              editorIsVisible,
              {screenLineCount, screenRowForBufferRow},
            ]) => ({
              editorIsVisible,
              colors,
              markTypes: markTypes.map(markLinesFromProviderMarks),
              screenRowForBufferRow,
              screenLineCount,
            }),
          )
          .let(throttle(nextAnimationFrame, {leading: false}));

        const Component = bindObservableAsProps(props, ScrollBar);
        const node = renderReactRoot(<Component />);

        const editorView = atom.views.getView(editor);

        const scrollBarView = editorView.getElementsByClassName(
          'vertical-scrollbar',
        )[0];

        nullthrows(scrollBarView.parentNode).insertBefore(
          node,
          scrollBarView.nextSibling,
        );

        this._disposables.addUntilDestroyed(editor, () => {
          node.remove();
        });
      }),
    );
  }

  dispose(): void {
    this._disposables.dispose();
  }

  consumeScrollbarIndicators(
    provider: ScrollbarIndicatorProvider,
  ): IDisposable {
    const disposable = new UniversalDisposable(
      observableFromSubscribeFunction(cb => provider.onUpdate(cb)).subscribe(
        ({editor, markTypes}) => {
          if (editor.isDestroyed()) {
            return;
          }

          // `update` contains a reference to an editor which we'll hold onto
          // to reference its marks. Make sure we properly dispose of that
          // editor's entries when it's destroyed, and don't create a disposable
          // for that editor if it already exists in the map (in which case the
          // disposable should already exist)
          if (!this._model.state.editorLines.get(editor)) {
            this._disposables.addUntilDestroyed(editor, () => {
              this._model.setState({
                editorLines: this._model.state.editorLines.delete(editor),
              });
            });
          }

          const newEditorLines = Object.values(scrollbarMarkTypes).reduce(
            (editorLines, _type) => {
              // Object.values returns mixed, so we have to tell Flow that we
              // trust the types of these `type`s.
              const type: ScrollbarIndicatorMarkType = (_type: any);
              const typeMarks = markTypes.get(type) || new Set();
              return editorLines.updateIn(
                [editor, type, provider],
                marks => typeMarks,
              );
            },
            this._model.state.editorLines,
          );
          this._model.setState({editorLines: newEditorLines});
        },
      ),
    );
    this._disposables.add(disposable);
    return disposable;
  }
}

createPackage(module.exports, Activation);
