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

import type {DOMMeasurements} from '../commons-atom/observe-element-dimensions';

import React from 'react';
import {MeasuredComponent} from './MeasuredComponent';
import {Button} from 'nuclide-commons-ui/Button';

type Props = {
  children?: React.Element<any>,
  maxHeight: number, // Maximum height of the component in px
  showMoreByDefault?: boolean,
};

type State = {
  showingMore: boolean,
  currentHeight: number,
};

/** A component which sets a max height and includes a "Show More" button
 * aligned at the bottom. Clicking "Show More" will remove the max height restriction
 * and expand the component to full height.
 */
export class ShowMoreComponent extends React.Component {
  props: Props;
  state: State;

  constructor(props: Props) {
    super(props);
    this.state = {
      // Defaults to false if showMoreByDefault not specified
      showingMore:
        this.props.showMoreByDefault != null && this.props.showMoreByDefault,
      currentHeight: 0,
    };
  }

  _updateMeasurements = (newMeasurements: DOMMeasurements): void => {
    if (newMeasurements.scrollHeight !== this.state.currentHeight) {
      this.setState({
        currentHeight: newMeasurements.scrollHeight,
      });
    }
  };

  render(): React.Element<any> {
    const {showingMore, currentHeight} = this.state;
    const {maxHeight} = this.props;

    const showMessage = showingMore ? 'Show Less' : 'Show More';
    const conditionalStyle = !showingMore
      ? {
          maxHeight: `${maxHeight}px`,
          overflowY: 'hidden',
        }
      : {};
    const displayNoneIfBelowMaxHeight =
      currentHeight <= maxHeight ? {display: 'none'} : {};
    const showMoreButton = (
      <div
        className="nuclide-ui-show-more-button-container"
        style={displayNoneIfBelowMaxHeight}>
        <Button onClick={this._toggleShowMore} size="EXTRA_SMALL">
          {showMessage}
        </Button>
      </div>
    );

    return (
      <div>
        <div
          className="nuclide-ui-show-more-component"
          style={conditionalStyle}>
          <div
            className="nuclide-ui-show-more-gradient"
            style={displayNoneIfBelowMaxHeight}
          />
          <MeasuredComponent onMeasurementsChanged={this._updateMeasurements}>
            {this.props.children}
          </MeasuredComponent>
        </div>
        {showMoreButton}
      </div>
    );
  }

  _toggleShowMore = (): void => {
    this.setState({showingMore: !this.state.showingMore});
  };
}
