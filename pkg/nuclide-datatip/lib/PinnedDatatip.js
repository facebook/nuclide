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

import type {Datatip} from './types';

type Position = {
  x: number,
  y: number,
};

import {CompositeDisposable, Disposable} from 'atom';
import React from 'react';
import ReactDOM from 'react-dom';
import {Observable} from 'rxjs';
import invariant from 'assert';
import classnames from 'classnames';

import {DatatipComponent, DATATIP_ACTIONS} from './DatatipComponent';

const LINE_END_MARGIN = 20;

let _mouseMove$;
function documentMouseMove$(): Observable<MouseEvent> {
  if (_mouseMove$ == null) {
    _mouseMove$ = Observable.fromEvent(document, 'mousemove');
  }
  return _mouseMove$;
}

let _mouseUp$;
function documentMouseUp$(): Observable<MouseEvent> {
  if (_mouseUp$ == null) {
    _mouseUp$ = Observable.fromEvent(document, 'mouseup');
  }
  return _mouseUp$;
}

export class PinnedDatatip {
  _boundDispose: Function;
  _boundHandleMouseDown: Function;
  _boundHandleMouseEnter: Function;
  _boundHandleMouseLeave: Function;
  _boundHandleCapturedClick: Function;
  _mouseUpTimeout: ?number;
  _hostElement: HTMLElement;
  _marker: ?atom$Marker;
  _rangeDecoration: ?atom$Decoration;
  _mouseSubscription: ?rxjs$ISubscription;
  _subscriptions: atom$CompositeDisposable;
  _datatip: Datatip;
  _editor: TextEditor;
  _hostElement: HTMLElement;
  _boundDispose: Function;
  _dragOrigin: ?Position;
  _isDragging: boolean;
  _offset: Position;
  _isHovering: boolean;
  _hideDataTips: () => void;

  constructor(
    datatip: Datatip,
    editor: TextEditor,
    onDispose: (pinnedDatatip: PinnedDatatip) => void,
    hideDataTips: () => void,
  ) {
    this._subscriptions = new CompositeDisposable();
    this._subscriptions.add(new Disposable(() => onDispose(this)));
    this._datatip = datatip;
    this._editor = editor;
    this._marker = null;
    this._rangeDecoration = null;
    this._hostElement = document.createElement('div');
    this._hostElement.className = 'nuclide-datatip-overlay';
    this._boundDispose = this.dispose.bind(this);
    this._boundHandleMouseDown = this.handleMouseDown.bind(this);
    this._boundHandleMouseEnter = this.handleMouseEnter.bind(this);
    this._boundHandleMouseLeave = this.handleMouseLeave.bind(this);
    this._boundHandleCapturedClick = this.handleCapturedClick.bind(this);
    this._hostElement.addEventListener(
      'mouseenter',
      this._boundHandleMouseEnter,
    );
    this._hostElement.addEventListener(
      'mouseleave',
      this._boundHandleMouseLeave,
    );
    this._subscriptions.add(
      new Disposable(() => {
        this._hostElement.removeEventListener(
          'mouseenter',
          this._boundHandleMouseEnter,
        );
        this._hostElement.removeEventListener(
          'mouseleave',
          this._boundHandleMouseLeave,
        );
      }),
    );
    this._mouseUpTimeout = null;
    this._offset = {x: 0, y: 0};
    this._isDragging = false;
    this._dragOrigin = null;
    this._isHovering = false;
    this._hideDataTips = hideDataTips;
    this.render();
  }

  handleMouseEnter(event: MouseEvent): void {
    this._isHovering = true;
    this._hideDataTips();
  }

  handleMouseLeave(event: MouseEvent): void {
    this._isHovering = false;
  }

  isHovering(): boolean {
    return this._isHovering;
  }

  handleGlobalMouseMove(event: Event): void {
    const evt: MouseEvent = (event: any);
    const {_dragOrigin} = this;
    invariant(_dragOrigin);
    this._isDragging = true;
    this._offset = {
      x: evt.clientX - _dragOrigin.x,
      y: evt.clientY - _dragOrigin.y,
    };
    this.render();
  }

  handleGlobalMouseUp(): void {
    // If the datatip was moved, push the effects of mouseUp to the next tick,
    // in order to allow cancelation of captured events (e.g. clicks on child components).
    this._mouseUpTimeout = setTimeout(() => {
      this._isDragging = false;
      this._dragOrigin = null;
      this._mouseUpTimeout = null;
      this._ensureMouseSubscriptionDisposed();
      this.render();
    }, 0);
  }

  _ensureMouseSubscriptionDisposed(): void {
    if (this._mouseSubscription != null) {
      this._mouseSubscription.unsubscribe();
      this._mouseSubscription = null;
    }
  }

  handleMouseDown(event: Event): void {
    const evt: MouseEvent = (event: any);
    this._dragOrigin = {
      x: evt.clientX - this._offset.x,
      y: evt.clientY - this._offset.y,
    };
    this._ensureMouseSubscriptionDisposed();
    this._mouseSubscription = documentMouseMove$()
      .takeUntil(documentMouseUp$())
      .subscribe(
        (e: MouseEvent) => {
          this.handleGlobalMouseMove(e);
        },
        (error: any) => {},
        () => {
          this.handleGlobalMouseUp();
        },
      );
  }

  handleCapturedClick(event: SyntheticEvent): void {
    if (this._isDragging) {
      event.stopPropagation();
    }
  }

  // Ensure positioning of the Datatip at the end of the current line.
  _updateHostElementPosition(): void {
    const {_editor, _datatip, _hostElement, _offset} = this;
    const {range} = _datatip;
    const charWidth = _editor.getDefaultCharWidth();
    const lineLength = _editor.getBuffer().getLines()[range.start.row].length;
    _hostElement.style.display = 'block';
    _hostElement.style.top =
      -_editor.getLineHeightInPixels() + _offset.y + 'px';
    _hostElement.style.left =
      (lineLength - range.end.column) * charWidth +
      LINE_END_MARGIN +
      _offset.x +
      'px';
  }

  render(): void {
    const {_editor, _datatip, _hostElement, _isDragging, _isHovering} = this;
    this._updateHostElementPosition();
    ReactDOM.render(
      <DatatipComponent
        action={DATATIP_ACTIONS.CLOSE}
        actionTitle="Close this datatip"
        className={classnames(
          _isDragging ? 'nuclide-datatip-dragging' : '',
          'nuclide-datatip-pinned',
        )}
        datatip={_datatip}
        onActionClick={this._boundDispose}
        onMouseDown={this._boundHandleMouseDown}
        onClickCapture={this._boundHandleCapturedClick}
      />,
      _hostElement,
    );

    let rangeClassname = 'nuclide-datatip-highlight-region';
    if (_isHovering) {
      rangeClassname += ' nuclide-datatip-highlight-region-active';
    }

    if (this._marker == null) {
      const marker: atom$Marker = _editor.markBufferRange(_datatip.range, {
        invalidate: 'never',
      });
      this._marker = marker;
      _editor.decorateMarker(marker, {
        type: 'overlay',
        position: 'head',
        item: this._hostElement,
      });
      this._rangeDecoration = _editor.decorateMarker(marker, {
        type: 'highlight',
        class: rangeClassname,
      });
    } else {
      // `this._rangeDecoration` is guaranteed to exist iff `this._marker` exists.
      invariant(this._rangeDecoration);
      this._rangeDecoration.setProperties({
        type: 'highlight',
        class: rangeClassname,
      });
    }
  }

  dispose(): void {
    if (this._mouseUpTimeout != null) {
      clearTimeout(this._mouseUpTimeout);
    }
    if (this._marker != null) {
      this._marker.destroy();
    }
    if (this._mouseSubscription != null) {
      this._mouseSubscription.unsubscribe();
    }
    ReactDOM.unmountComponentAtNode(this._hostElement);
    this._hostElement.remove();
    this._subscriptions.dispose();
  }
}
