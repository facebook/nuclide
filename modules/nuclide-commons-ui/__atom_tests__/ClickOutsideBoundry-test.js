/**
 * Copyright (c) 2017-present, Facebook, Inc.
 * All rights reserved.
 *
 * This source code is licensed under the BSD-style license found in the
 * LICENSE file in the root directory of this source tree. An additional grant
 * of patent rights can be found in the PATENTS file in the same directory.
 *
 * @flow strict-local
 * @format
 * @emails oncall+nuclide
 */
import * as React from 'react';
import invariant from 'assert';
import {render} from 'react-dom';
import ClickOutsideBoundary from '../ClickOutsideBoundary';

const clickId = (id: string) => {
  const node = document.getElementById(id);
  invariant(node != null, `node ${id} should be present in the DOM`);
  node.click();
};

// A component which removes itself from the DOM when clicked.
// $FlowFixMe(>=0.53.0) Flow suppress
class ClickAway extends React.Component<$FlowFixMeProps, $FlowFixMeState> {
  constructor(props) {
    super(props);
    this.state = {visible: true};
  }

  handleClick = () => {
    this.setState({visible: false});
  };

  render() {
    return this.state.visible ? (
      <span {...this.props} onClick={this.handleClick}>
        Click to dismiss
      </span>
    ) : null;
  }
}

describe('ClickOutsideBoundary - onClickOutside handler', () => {
  let app;
  let onClickOutside;

  beforeEach(() => {
    app = document.createElement('div');
    window.document.body.appendChild(app);
    onClickOutside = jest.fn();
  });

  afterEach(() => {
    window.document.body.removeChild(app);
  });

  describe('_is_ called for an external click', () => {
    it('on a parent', () => {
      render(
        <div id="container">
          <ClickOutsideBoundary onClickOutside={onClickOutside}>
            <div id="target" />
          </ClickOutsideBoundary>
        </div>,
        app,
      );
      clickId('container');
      expect(onClickOutside).toHaveBeenCalled();
    });

    it('on a sibling', () => {
      render(
        <div>
          <ClickOutsideBoundary onClickOutside={onClickOutside}>
            <div id="target" />
          </ClickOutsideBoundary>
          <div id="sibling" />
        </div>,
        app,
      );
      clickId('sibling');
      expect(onClickOutside).toHaveBeenCalled();
    });

    it('on a sibling that disappears after render', () => {
      // This would fail if we tool the approach of ignoring all
      // clicks on elements that were not in the DOM.
      render(
        <div>
          <ClickOutsideBoundary onClickOutside={onClickOutside}>
            <div id="target" />
          </ClickOutsideBoundary>
          <ClickAway id="click-away" />
        </div>,
        app,
      );
      clickId('click-away');
      expect(onClickOutside).toHaveBeenCalled();
    });
  });

  describe('is _not_ called for an internal click', () => {
    it('under normal conditions', () => {
      render(
        <ClickOutsideBoundary onClickOutside={onClickOutside}>
          <div id="target" />
        </ClickOutsideBoundary>,
        app,
      );
      clickId('target');
      expect(onClickOutside).not.toHaveBeenCalled();
    });

    it('when the target leaves the DOM before the event reaches window.document', () => {
      // A simple approach: `this.rootNode.contains(e.target)` would fail this test.
      const onClickInside = jest.fn();
      render(
        <ClickOutsideBoundary onClickOutside={onClickOutside}>
          <div onClick={onClickInside}>
            <ClickAway id="click-away" />
          </div>
        </ClickOutsideBoundary>,
        app,
      );
      clickId('click-away');
      expect(onClickInside).toHaveBeenCalled();
      expect(onClickOutside).not.toHaveBeenCalled();
    });
  });
});
