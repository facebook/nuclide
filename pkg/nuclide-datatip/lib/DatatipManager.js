'use babel';
/* @flow */

/*
 * Copyright (c) 2015-present, Facebook, Inc.
 * All rights reserved.
 *
 * This source code is licensed under the license found in the LICENSE file in
 * the root directory of this source tree.
 */

import type {
  Datatip,
  DatatipProvider,
} from './types';

import {
  React,
  ReactDOM,
} from 'react-for-atom';

import debounce from '../../commons-node/debounce';
import {arrayCompact, arrayRemove} from '../../commons-node/collection';
import {track, trackTiming} from '../../nuclide-analytics';
import {getLogger} from '../../nuclide-logging';
import UniversalDisposable from '../../commons-node/UniversalDisposable';
import {Observable} from 'rxjs';

import {DatatipComponent, DATATIP_ACTIONS} from './DatatipComponent';
import {PinnedDatatip} from './PinnedDatatip';

import featureConfig from '../../commons-atom/featureConfig';
import performanceNow from '../../commons-node/performanceNow';

const logger = getLogger();

const CUMULATIVE_WHEELX_THRESHOLD = 20;
const DEFAULT_DATATIP_DEBOUNCE_DELAY = 1000;
const DEFAULT_DATATIP_INTERACTED_DEBOUNCE_DELAY = 1000;

function getProviderName(provider: DatatipProvider): string {
  if (provider.providerName == null) {
    logger.error('Datatip provider has no name', provider);
    return 'unknown';
  }
  return provider.providerName;
}

function filterProvidersByScopeName(
  providers: Array<DatatipProvider>,
  scopeName: string,
): Array<DatatipProvider> {
  return providers
    .filter((provider: DatatipProvider) => {
      return (
        provider.inclusionPriority > 0 &&
        provider.validForScope(scopeName)
      );
    })
    .sort((providerA: DatatipProvider, providerB: DatatipProvider) => {
      return providerA.inclusionPriority - providerB.inclusionPriority;
    });
}


function getBufferPosition(
  editor: TextEditor,
  editorView: atom$TextEditorElement,
  event: ?MouseEvent,
): null | atom$Point {
  if (!event) {
    return null;
  }

  const text = editorView.component;
  if (!text) {
    return null;
  }

  const screenPosition = text.screenPositionForMouseEvent(event);
  const pixelPosition = text.pixelPositionForMouseEvent(event);
  const pixelPositionFromScreenPosition =
    text.pixelPositionForScreenPosition(screenPosition);
  // Distance (in pixels) between screenPosition and the cursor.
  const horizontalDistance =
    pixelPosition.left - pixelPositionFromScreenPosition.left;
  // `screenPositionForMouseEvent.column` cannot exceed the current line length.
  // This is essentially a heuristic for "mouse cursor is to the left or right
  // of text content".
  if (pixelPosition.left < 0 ||
      horizontalDistance > editor.getDefaultCharWidth()) {
    return null;
  }
  return editor.bufferPositionForScreenPosition(screenPosition);
}

async function fetchDatatip(editor, position, allProviders, onPinClick) {
  const {scopeName} = editor.getGrammar();
  const providers = filterProvidersByScopeName(allProviders, scopeName);
  if (providers.length === 0) {
    return null;
  }

  let combinedRange = null;
  const renderedProviders = arrayCompact(await Promise.all(
    providers.map(async (provider: DatatipProvider): Promise<?Object> => {
      const name = getProviderName(provider);
      const datatip = await trackTiming(
        name + '.datatip',
        () => provider.datatip(editor, position),
      );
      if (!datatip) {
        return null;
      }
      const {pinnable, component, range} = datatip;
      const ProvidedComponent = component;

      // We track the timing above, but we still want to know the number of
      // popups that are shown.
      track('datatip-popup', {
        scope: scopeName,
        providerName: name,
        rangeStartRow: String(range.start.row),
        rangeStartColumn: String(range.start.column),
        rangeEndRow: String(range.end.row),
        rangeEndColumn: String(range.end.column),
      });

      if (!combinedRange) {
        combinedRange = range;
      } else {
        combinedRange = combinedRange.union(range);
      }

      let action;
      let actionTitle;
      // Datatips are pinnable by default, unless explicitly specified
      // otherwise.
      if (pinnable !== false) {
        action = DATATIP_ACTIONS.PIN;
        actionTitle = 'Pin this Datatip';
      }

      return (
        <DatatipComponent
          action={action}
          actionTitle={actionTitle}
          onActionClick={() => onPinClick(editor, datatip)}
          key={name}>
          <ProvidedComponent />
        </DatatipComponent>
      );
    }),
  ));
  if (renderedProviders.length === 0) {
    return null;
  }

  return {
    range: combinedRange,
    renderedProviders: <div>{renderedProviders}</div>,
  };
}

function renderDatatip(
  editor,
  element,
  {range, renderedProviders}: {
    range: atom$Range,
    renderedProviders: React.Element<any>,
  },
): atom$Marker {
  // Transform the matched element range to the hint range.
  const marker: atom$Marker = editor.markBufferRange(
    range,
    {invalidate: 'never'},
  );

  ReactDOM.render(renderedProviders, element);
  element.style.display = 'block';

  editor.decorateMarker(marker, {
    type: 'overlay',
    position: 'tail',
    item: element,
  });

  editor.decorateMarker(marker, {
    type: 'highlight',
    class: 'nuclide-datatip-highlight-region',
  });

  return marker;
}

const DatatipState = Object.freeze({
  HIDDEN: 'HIDDEN',
  FETCHING: 'FETCHING',
  VISIBLE: 'VISIBLE',
});
type State = $Keys<typeof DatatipState>;

function ensurePositiveNumber(value: any, defaultValue: number): number {
  if (typeof value !== 'number' || value < 0) {
    return defaultValue;
  }
  return value;
}

class DatatipManagerForEditor {
  _blacklistedPosition: ?atom$Point;
  _datatipElement: HTMLElement;
  _datatipProviders: Array<DatatipProvider>;
  _datatipState: State;
  _editor: atom$TextEditor;
  _editorView: atom$TextEditorElement;
  _insideDatatip: boolean;
  _lastHiddenTime: number;
  _lastMoveEvent: ?MouseEvent;
  _marker: ?atom$Marker;
  _pinnedDatatips: Set<PinnedDatatip>;
  _range: ?atom$Range;
  _shouldDropNextMouseMoveAfterFocus: boolean;
  _startFetchingDebounce: () => void;
  _hideIfOutsideDebounce: () => void;
  _subscriptions: UniversalDisposable;
  _interactedWith: boolean;
  _cumulativeWheelX: number;

  constructor(
    editor: atom$TextEditor,
    datatipProviders: Array<DatatipProvider>,
  ) {
    this._editor = editor;
    this._editorView = atom.views.getView(editor);
    this._pinnedDatatips = new Set();
    this._subscriptions = new UniversalDisposable();
    this._datatipProviders = datatipProviders;
    this._datatipElement = document.createElement('div');
    this._datatipElement.className = 'nuclide-datatip-overlay';
    this._datatipState = DatatipState.HIDDEN;
    this._interactedWith = false;
    this._cumulativeWheelX = 0;
    this._lastHiddenTime = 0;
    this._shouldDropNextMouseMoveAfterFocus = false;

    this._subscriptions.add(
      featureConfig.observe(
        'nuclide-datatip.datatipDebounceDelay',
        () => this._setStartFetchingDebounce(),
      ),
      featureConfig.observe(
        'nuclide-datatip.datatipInteractedWithDebounceDelay',
        () => this._setHideIfOutsideDebounce(),
      ),

      Observable.fromEvent(this._editorView, 'mousemove').subscribe(e => {
        if (this._shouldDropNextMouseMoveAfterFocus) {
          this._shouldDropNextMouseMoveAfterFocus = false;
          return;
        }

        this._lastMoveEvent = e;
        if (this._datatipState === DatatipState.HIDDEN) {
          this._startFetchingDebounce();
        } else {
          this._hideIfOutside();
        }
      }),

      Observable.fromEvent(this._editorView, 'mousedown').subscribe(e => {
        let node = e.target;
        while (node !== null) {
          if (node === this._datatipElement) {
            return;
          }
          node = node.parentNode;
        }

        this._hideOrCancel();
      }),

      Observable.fromEvent(this._editorView, 'keydown').subscribe(e => {
        if (e.altKey || e.ctrlKey || e.metaKey || e.shiftKey) {
          return;
        }
        this._hideOrCancel();
      }),

      Observable.fromEvent(this._datatipElement, 'wheel').subscribe(e => {
        this._cumulativeWheelX += Math.abs(e.deltaX);
        if (this._cumulativeWheelX > CUMULATIVE_WHEELX_THRESHOLD) {
          this._interactedWith = true;
        }
        if (this._interactedWith) {
          e.stopPropagation();
        }
      }),

      Observable.fromEvent(this._datatipElement, 'mousedown').subscribe(() => {
        this._interactedWith = true;
      }),

      Observable.fromEvent(this._datatipElement, 'mouseenter').subscribe(() => {
        this._insideDatatip = true;
        this._hideIfOutside();
      }),

      Observable.fromEvent(this._datatipElement, 'mouseleave').subscribe(() => {
        this._insideDatatip = false;
        this._hideIfOutside();
      }),

      this._editorView.onDidChangeScrollTop(() => {
        this._lastMoveEvent = null;
        if (this._datatipState === DatatipState.VISIBLE) {
          this._setState(DatatipState.HIDDEN);
        }
      }),

      atom.commands.add(
        'atom-text-editor',
        'nuclide-datatip:toggle',
        this._toggleDatatip.bind(this),
      ),
    );
  }

  _setStartFetchingDebounce(): void {
    this._startFetchingDebounce = debounce(
      () => {
        this._startFetching(() => getBufferPosition(
          this._editor,
          this._editorView,
          this._lastMoveEvent,
        ));
      },
      ensurePositiveNumber(
        (featureConfig.get('nuclide-datatip.datatipDebounceDelay'): any),
        DEFAULT_DATATIP_DEBOUNCE_DELAY,
      ),
      /* immediate */ false,
    );
  }

  _setHideIfOutsideDebounce(): void {
    this._hideIfOutsideDebounce = debounce(
      () => {
        this._hideIfOutsideImmediate();
      },
      ensurePositiveNumber(
        (featureConfig.get('nuclide-datatip.datatipInteractedWithDebounceDelay'): any),
        DEFAULT_DATATIP_INTERACTED_DEBOUNCE_DELAY,
      ),
      /* immediate */ false,
    );
  }

  dispose(): void {
    this._setState(DatatipState.HIDDEN);
    this._subscriptions.dispose();
    this._datatipElement.remove();
  }

  _setState(newState: State): void {
    const oldState = this._datatipState;
    this._datatipState = newState;

    if (newState === DatatipState.HIDDEN) {
      this._blacklistedPosition = null;
    }
    if (oldState === DatatipState.VISIBLE && newState === DatatipState.HIDDEN) {
      this._hideDatatip();
      return;
    }
  }

  async _startFetching(getPosition: () => ?atom$Point): Promise<void> {
    if (this._datatipState !== DatatipState.HIDDEN) {
      return;
    }
    const position = getPosition();
    if (!position) {
      return;
    }

    this._setState(DatatipState.FETCHING);
    const data = await fetchDatatip(
      this._editor,
      position,
      this._datatipProviders,
      this._handlePinClicked.bind(this),
    );

    if (data === null) {
      this._setState(DatatipState.HIDDEN);
      return;
    }
    if (this._datatipState !== DatatipState.FETCHING) {
      this._setState(DatatipState.HIDDEN);
    }

    if (this._blacklistedPosition &&
        data.range &&
        data.range.containsPoint(this._blacklistedPosition)) {
      this._setState(DatatipState.HIDDEN);
      return;
    }

    const currentPosition = getPosition();
    if (!currentPosition ||
        !data.range ||
        !data.range.containsPoint(currentPosition)) {
      this._setState(DatatipState.HIDDEN);
      return;
    }

    this._setState(DatatipState.VISIBLE);
    this._interactedWith = false;
    this._cumulativeWheelX = 0;
    this._range = data.range;
    this._marker = renderDatatip(this._editor, this._datatipElement, data);
  }

  _hideDatatip(): void {
    this._lastHiddenTime = window.performance.now();
    if (this._marker) {
      this._marker.destroy();
      this._marker = null;
    }
    this._range = null;
    ReactDOM.unmountComponentAtNode(this._datatipElement);
    this._datatipElement.style.display = 'none';
  }

  _hideOrCancel(): void {
    if (this._datatipState === DatatipState.HIDDEN ||
        this._datatipState === DatatipState.FETCHING) {
      this._blacklistedPosition = getBufferPosition(
        this._editor,
        this._editorView,
        this._lastMoveEvent,
      );
      return;
    }

    this._setState(DatatipState.HIDDEN);
  }

  _hideIfOutside(): void {
    if (this._datatipState !== DatatipState.VISIBLE) {
      return;
    }

    if (this._interactedWith) {
      this._hideIfOutsideDebounce();
    } else {
      this._hideIfOutsideImmediate();
    }
  }

  _hideIfOutsideImmediate(): void {
    if (this._datatipState !== DatatipState.VISIBLE) {
      return;
    }
    if (this._insideDatatip) {
      return;
    }
    const currentPosition = getBufferPosition(
      this._editor,
      this._editorView,
      this._lastMoveEvent,
    );
    if (currentPosition &&
        this._range &&
        this._range.containsPoint(currentPosition)) {
      return;
    }

    this._setState(DatatipState.HIDDEN);
  }

  createPinnedDataTip(
    component: ReactClass<any>,
    range: atom$Range,
    pinnable?: boolean,
    editor: TextEditor,
    ): PinnedDatatip {
    const datatip = new PinnedDatatip(
      /* datatip */ {component, range, pinnable},
      editor,
      /* onDispose */ () => {
        this._pinnedDatatips.delete(datatip);
      },
    );
    return datatip;
  }

  _handlePinClicked(editor: TextEditor, datatip: Datatip): void {
    track('datatip-pinned-open');
    const startTime = performanceNow();
    this._setState(DatatipState.HIDDEN);
    this._pinnedDatatips.add(
      new PinnedDatatip(datatip, editor, /* onDispose */ pinnedDatatip => {
        this._pinnedDatatips.delete(pinnedDatatip);
        track('datatip-pinned-close', {duration: performanceNow() - startTime});
      }),
    );
  }

  _toggleDatatip(): void {
    if (atom.workspace.getActiveTextEditor() !== this._editor) {
      return;
    }

    // Note that we don't need to hide the tooltip, we already hide it on
    // keydown, which is going to be triggered before the key binding which is
    // evaluated on keyup.

    if (this._datatipState === DatatipState.HIDDEN &&
        // Unfortunately, when you do keydown of the shortcut, it's going to
        // hide it, we need to make sure that when we do keyup, it doesn't show
        // it up right away. We assume that a keypress is done within 100ms
        // and don't show it again if it was hidden so soon.
        window.performance.now() - this._lastHiddenTime > 100) {
      this._startFetching(() => this._editor.getCursorScreenPosition());
      return;
    }
  }
}

export class DatatipManager {
  _datatipProviders: Array<DatatipProvider>;
  _editorManagers: Map<atom$TextEditor, DatatipManagerForEditor>;
  _subscriptions: UniversalDisposable;

  constructor() {
    this._subscriptions = new UniversalDisposable();
    this._editorManagers = new Map();
    this._datatipProviders = [];

    this._subscriptions.add(atom.workspace.observeTextEditors(editor => {
      const manager = new DatatipManagerForEditor(
        editor,
        this._datatipProviders,
      );
      this._editorManagers.set(editor, manager);
      const dispose = () => {
        manager.dispose();
        this._editorManagers.delete(editor);
      };
      this._subscriptions.add(new UniversalDisposable(dispose));
      editor.onDidDestroy(dispose);
    }));
  }

  addProvider(provider: DatatipProvider): void {
    this._datatipProviders.push(provider);
  }

  removeProvider(provider: DatatipProvider): void {
    arrayRemove(this._datatipProviders, provider);
  }

  createPinnedDataTip(
    component: ReactClass<any>,
    range: atom$Range,
    pinnable?: boolean,
    editor: TextEditor,
  ): PinnedDatatip {
    const manager = this._editorManagers.get(editor);
    if (!manager) {
      throw new Error(
        'Trying to create a pinned data tip on an editor that has ' +
        'no datatip manager',
      );
    }
    return manager.createPinnedDataTip(component, range, pinnable, editor);
  }

  dispose(): void {
    this._subscriptions.dispose();
    this._editorManagers.forEach(manager => {
      manager.dispose();
    });
    this._editorManagers = new Map();
  }
}
