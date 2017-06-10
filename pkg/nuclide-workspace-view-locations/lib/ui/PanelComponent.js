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

/* global getComputedStyle */

import UniversalDisposable from 'nuclide-commons/UniversalDisposable';
import {nextAnimationFrame} from 'nuclide-commons/observable';
import rectContainsPoint from '../../../commons-node/rectContainsPoint';
import {View} from '../../../nuclide-ui/View';
import {ToggleButton} from './ToggleButton';
import invariant from 'assert';
import classnames from 'classnames';
import React from 'react';
import ReactDOM from 'react-dom';
import {Observable, Subject} from 'rxjs';

const MINIMUM_SIZE = 100;
const DEFAULT_INITIAL_SIZE = 300;
const HANDLE_SIZE = 4;

type Position = 'top' | 'right' | 'bottom' | 'left';

type DefaultProps = {
  onResize: (width: number) => mixed,
};

type Props = {
  draggingItem: boolean, // TODO: Change to the actual item so that we can get the width.
  paneContainer: atom$PaneContainer,
  position: Position,
  initialSize: ?number,
  active: boolean,
  toggle: () => void,
  onResize: (width: number) => mixed,
};

type State = {
  resizing: boolean,
  shouldAnimate: boolean,
  showDropTarget: boolean,
  size: ?number,
  showToggleButton: boolean,
};

/**
 * A container for centralizing the logic for making panels resizable.
 */
export class PanelComponent extends React.Component {
  _activeChanges: Subject<boolean>;
  _disposables: ?UniversalDisposable;
  _dropTargetDisposable: ?UniversalDisposable;
  _toggleButtonEl: ?HTMLElement;
  _resizeDisposable: ?UniversalDisposable;

  props: Props;
  state: State;
  static defaultProps: DefaultProps = {
    onResize: width => {},
  };

  constructor(props: Object) {
    super(props);
    this.state = {
      resizing: false,
      size: this.props.initialSize,
      shouldAnimate: props.draggingItem,
      showDropTarget: false,
      showToggleButton: false,
    };

    // Bind main events to this object. _updateSize is only ever bound within these.
    (this: any)._handleResizeHandleDragStart = this._handleResizeHandleDragStart.bind(
      this,
    );
    (this: any)._handleMouseMove = this._handleMouseMove.bind(this);
    (this: any)._handleMouseUp = this._handleMouseUp.bind(this);
    (this: any)._handleDragLeave = this._handleDragLeave.bind(this);
    (this: any)._handleToggleButton = this._handleToggleButton.bind(this);
    (this: any)._revealDropTarget = this._revealDropTarget.bind(this);

    this._activeChanges = new Subject();
  }

  componentDidMount(): void {
    const panelContainerEl = document.querySelector(
      `atom-panel-container.${this.props.position}`,
    );
    this._disposables = new UniversalDisposable(
      // Note: This method is called via `requestAnimationFrame` rather than `process.nextTick` like
      // Atom's tree-view does because this does not have a guarantee a paint will have already
      // happened when `componentDidMount` gets called the first time.
      nextAnimationFrame.subscribe(() => {
        this._repaint();
      }),
    );

    // The panel container should always be in the DOM, but in tests it may not be. In those cases
    // we just don't add the listeners. This is an ugly hack, but we should easily notice if it
    // breaks.
    if (panelContainerEl == null) {
      return;
    }

    const {position} = this.props;
    this._disposables.add(
      // In order to provide as large of a mouse target as possible, we use the entire panel
      // container. When detecting whether the mouse has left the area, we also include the space
      // taken up by the toggle button.
      Observable.fromEvent(panelContainerEl, 'mouseenter')
        .switchMap(enterEvent =>
          Observable.concat(
            Observable.of(enterEvent),
            Observable.merge(
              // We want to include the toggle button area when determining whether we've left, so we
              // need to use "move" events. We only start caring about them after the first leave
              // event, though, so we're doing as little work as possible. BUT...
              Observable.fromEvent(panelContainerEl, 'mouseleave')
                .take(1)
                .switchMap(event =>
                  Observable.fromEvent(window, 'mousemove').startWith(event),
                )
                .filter(event =>
                  shouldHideToggleButton(event, panelContainerEl, position),
                ),
              // ...mouseleave won't be triggered if you're dragging, so listen for dragend too...
              Observable.fromEvent(window, 'dragend').filter(event =>
                shouldHideToggleButton(event, panelContainerEl, position),
              ),
              // ...nor is it triggered when the pane is hidden (using a command or by removing the
              // last item), so we listen to that too.
              this._activeChanges
                .distinctUntilChanged()
                .filter(active => !active),
            ).take(1),
          ),
        )
        .map(event => (event.type === 'mouseenter' ? true : false))
        .distinctUntilChanged()
        .subscribe(showToggleButton => {
          this.setState({showToggleButton});
        }),
    );
  }

  componentWillUnmount() {
    if (this._resizeDisposable != null) {
      this._resizeDisposable.dispose();
    }
    if (this._dropTargetDisposable != null) {
      this._dropTargetDisposable.dispose();
    }
    invariant(this._disposables != null);
    this._disposables.dispose();
  }

  /**
   * Forces the potentially scrollable region to redraw so its scrollbars are drawn with styles from
   * the active theme. This mimics the login in Atom's tree-view [`onStylesheetChange`][1].
   *
   * [1] https://github.com/atom/tree-view/blob/v0.201.5/lib/tree-view.coffee#L722
   */
  _repaint() {
    const element = ReactDOM.findDOMNode(this);
    // $FlowFixMe
    const isVisible = getComputedStyle(element).getPropertyValue('visibility');

    if (isVisible) {
      // Force a redraw so the scrollbars are styled correctly based on the theme
      // $FlowFixMe
      element.style.display = 'none';
      // $FlowFixMe
      element.offsetWidth;
      // $FlowFixMe
      element.style.display = '';
    }
  }

  componentWillReceiveProps(nextProps: Props): void {
    // Update the `shouldAnimate` state. This needs to be written to the DOM before updating the
    // class that changes the animated property. Normally we'd have to defer the class change a
    // frame to ensure the property is animated (or not) appropriately, however we luck out in this
    // case because the drag start always happens before the item is dragged into the toggle button.
    if (nextProps.active !== this.props.active) {
      // Never animate toggling visiblity...
      this.setState({shouldAnimate: false});
    } else if (
      !nextProps.active &&
      nextProps.draggingItem &&
      !this.props.draggingItem
    ) {
      // ...but do animate if you start dragging while the panel is hidden.
      this.setState({shouldAnimate: true});
    }

    if (nextProps.active !== this.props.active) {
      this._activeChanges.next(nextProps.active);
    }
  }

  render(): React.Element<any> {
    const size = Math.max(
      MINIMUM_SIZE,
      this.state.size == null ? this._getInitialSize() : this.state.size,
    );
    const open = this.props.active || this.state.showDropTarget;
    const widthOrHeight = getWidthOrHeight(this.props.position);

    const wrapperClassName = classnames(
      'nuclide-workspace-views-panel-wrapper',
      this.props.position,
      {
        'nuclide-panel-active': this.props.active,
      },
    );
    const className = classnames(
      'nuclide-workspace-views-panel',
      this.props.position,
    );
    const maskClassName = classnames('nuclide-workspace-views-panel-mask', {
      'nuclide-panel-should-animate': this.state.shouldAnimate,
    });

    const handle = (
      <Handle
        position={this.props.position}
        mode={open ? 'resize' : 'open'}
        onResizeStart={this._handleResizeHandleDragStart}
        toggle={this.props.toggle}
      />
    );

    return (
      <div className={wrapperClassName}>
        {/* We need to change the size of the mask... */}
        <div
          className={maskClassName}
          style={{[widthOrHeight]: open ? size : HANDLE_SIZE}}>
          {/* ...but the content needs to maintain a constant size. */}
          <div className={className} style={{[widthOrHeight]: size}}>
            {handle}
            <div className="nuclide-workspace-views-panel-content">
              <View item={this.props.paneContainer} />
            </div>
            <ResizeCursorOverlay
              position={this.props.position}
              resizing={this.state.resizing}
            />
          </div>
        </div>
        {/*
          The toggle button must be rendered outside the mask because (1) it shouldn't be masked and
          (2) if we made the mask larger to avoid masking it, the mask would block mouse events.
        */}
        <ToggleButton
          ref={this._handleToggleButton}
          onDragEnter={this._revealDropTarget}
          visible={
            this.state.showToggleButton || (this.props.draggingItem && !open)
          }
          position={this.props.position}
          open={open}
          toggle={this.props.toggle}
        />
      </div>
    );
  }

  _revealDropTarget(): void {
    if (this._dropTargetDisposable != null) {
      this._dropTargetDisposable.dispose();
    }
    this.setState({showDropTarget: true});
    this._dropTargetDisposable = new UniversalDisposable(
      // When we start showing the drop target, listen for when the mouse leaves in order to hide
      // it. We should be able to use `onDragLeave` but for some reason, that's only being triggered
      // sporadically with the correct target.
      Observable.merge(
        Observable.fromEvent(window, 'drag').filter(event => {
          const toggleButtonEl = this._toggleButtonEl;
          const el = ReactDOM.findDOMNode(this);
          if (el == null || toggleButtonEl == null) {
            return false;
          }
          // $FlowFixMe
          const panelArea = el.getBoundingClientRect();
          const toggleButtonArea = toggleButtonEl.getBoundingClientRect();
          const mousePosition = {x: event.pageX, y: event.pageY};
          return (
            !rectContainsPoint(panelArea, mousePosition) &&
            !rectContainsPoint(toggleButtonArea, mousePosition)
          );
        }),
        Observable.fromEvent(window, 'dragend'),
      ).subscribe(this._handleDragLeave),
    );
  }

  _handleToggleButton(toggleButton: ?ToggleButton): void {
    // $FlowFixMe
    this._toggleButtonEl = toggleButton == null
      ? null
      : ReactDOM.findDOMNode(toggleButton);
  }

  _handleDragLeave(): void {
    if (this._dropTargetDisposable != null) {
      this._dropTargetDisposable.dispose();
      this._dropTargetDisposable = null;
    }
    this.setState({showDropTarget: false});
  }

  _handleResizeHandleDragStart(): void {
    if (this._resizeDisposable != null) {
      this._resizeDisposable.dispose();
    }
    this._resizeDisposable = new UniversalDisposable(
      Observable.fromEvent(window, 'mousemove').subscribe(
        this._handleMouseMove,
      ),
      Observable.fromEvent(window, 'mouseup').subscribe(this._handleMouseUp),
    );
    this.setState({resizing: true});
  }

  _handleMouseMove(event: SyntheticMouseEvent): void {
    if (event.buttons === 0) {
      // We missed the mouseup event. For some reason it happens on Windows
      this._handleMouseUp(event);
      return;
    }

    const containerEl = ReactDOM.findDOMNode(this);
    let size = 0;
    switch (this.props.position) {
      case 'left':
        // $FlowFixMe
        size = event.pageX - containerEl.getBoundingClientRect().left;
        break;
      case 'top':
        // $FlowFixMe
        size = event.pageY - containerEl.getBoundingClientRect().top;
        break;
      case 'bottom':
        // $FlowFixMe
        size = containerEl.getBoundingClientRect().bottom - event.pageY;
        break;
      case 'right':
        // $FlowFixMe
        size = containerEl.getBoundingClientRect().right - event.pageX;
        break;
    }
    this._updateSize(size);
  }

  _handleMouseUp(event: SyntheticMouseEvent): void {
    if (this._resizeDisposable) {
      this._resizeDisposable.dispose();
    }
    this.setState({resizing: false});
  }

  // Whether this is width or height depends on the orientation of this panel.
  _updateSize(newSize: number): void {
    this.setState({size: newSize});
    this.props.onResize.call(null, newSize);
  }

  _getInitialSize(): number {
    let initialSize;

    if (this.props.initialSize != null) {
      initialSize = this.props.initialSize;
    } else {
      // The item may not have been activated yet. If that's the case, just use the first item.
      const activePaneItem =
        this.props.paneContainer.getActivePaneItem() ||
        this.props.paneContainer.getPaneItems()[0];
      if (activePaneItem != null) {
        initialSize = getPreferredSize(activePaneItem, this.props.position);
      }
    }
    return initialSize == null ? DEFAULT_INITIAL_SIZE : initialSize;
  }
}

function getPreferredSize(item: Object, position: Position): ?number {
  switch (position) {
    case 'top':
    case 'bottom':
      return typeof item.getPreferredHeight === 'function'
        ? item.getPreferredHeight()
        : null;
    case 'left':
    case 'right':
      return typeof item.getPreferredWidth === 'function'
        ? item.getPreferredWidth()
        : null;
    default:
      throw new Error(`Invalid position: ${position}`);
  }
}

function ResizeCursorOverlay(props: {
  resizing: boolean,
  position: Position,
}): ?React.Element<any> {
  // We create an overlay to always display the resize cursor while the user is resizing the panel,
  // even if their mouse leaves the handle.
  return props.resizing
    ? <div
        className={`nuclide-workspace-views-panel-resize-cursor-overlay ${props.position}`}
      />
    : null;
}

type HandleProps = {
  mode: 'resize' | 'open',
  position: Position,
  toggle: () => void,
  onResizeStart: () => void,
};

function Handle(props: HandleProps): React.Element<any> {
  const widthOrHeight = getWidthOrHeight(props.position);
  const className = classnames(
    'nuclide-workspace-views-panel-handle',
    props.position,
    {
      'nuclide-workspace-views-panel-handle-resize': props.mode === 'resize',
      'nuclide-workspace-views-panel-handle-open': props.mode === 'open',
    },
  );
  return (
    <div
      className={className}
      style={{[widthOrHeight]: HANDLE_SIZE}}
      onMouseDown={props.mode === 'resize' ? props.onResizeStart : null}
      onClick={props.mode === 'open' ? props.toggle : null}
    />
  );
}

function getWidthOrHeight(position: Position): 'width' | 'height' {
  return position === 'left' || position === 'right' ? 'width' : 'height';
}

function shouldHideToggleButton(
  event: MouseEvent,
  panelContainerEl: HTMLElement,
  position: Position,
): boolean {
  const panelContainerBounds = panelContainerEl.getBoundingClientRect();
  const affordance = 20;
  const toggleButtonSize = 50 / 2; // This needs to match the value in the CSS.
  const bounds = {
    top: panelContainerBounds.top,
    right: panelContainerBounds.right,
    bottom: panelContainerBounds.bottom,
    left: panelContainerBounds.left,
  };
  switch (position) {
    case 'top':
      bounds.bottom += toggleButtonSize + affordance;
      bounds.top = 0; // We want to include the header.
      break;
    case 'right':
      bounds.left -= toggleButtonSize + affordance;
      break;
    case 'bottom':
      bounds.top -= toggleButtonSize + affordance;
      invariant(document.body != null);
      bounds.bottom = document.body.clientHeight; // We want to include the footer.
      break;
    case 'left':
      bounds.right += toggleButtonSize + affordance;
      break;
  }
  return !rectContainsPoint(bounds, {x: event.pageX, y: event.pageY});
}
