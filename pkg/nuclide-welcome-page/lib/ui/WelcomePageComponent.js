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

import type {AppState, WelcomePageData} from '../types';

import * as React from 'react';
import classnames from 'classnames';
import invariant from 'assert';
import {connect} from 'react-redux';
import {Checkbox} from 'nuclide-commons-ui/Checkbox';
import * as ActionCreators from '../redux/Actions';

type Props = {
  actionCreators: typeof ActionCreators,
  className?: string,
  hiddenTopics: Set<string>,
  topic: string,
  welcomePages: Map<string, WelcomePageData>,
};

// This state represents the request to hide (or to not hide) the current topic in
// the future, rather than whether it is hidden now.  It can be modified by the
// checkbox and merges with the master state when changed.
// This could also live in the general redux code for this package, but we see
// no strong pressure to move it there yet.  If it causes problems here, we can
// move local state out of this component and consolidate it there.
type State = {shouldHide: boolean};

export default class WelcomePageComponent extends React.Component<
  Props,
  State,
> {
  state = {shouldHide: this.props.hiddenTopics.has(this.props.topic)};

  render(): React.Node {
    const {topic} = this.props;
    const welcomePage = this.props.welcomePages.get(topic);
    invariant(welcomePage != null);
    const hideCheckboxProps = welcomePage.hideCheckboxProps;

    return (
      <div className={classnames(this.props.className, 'welcome-page')}>
        {welcomePage.content}
        <div className={hideCheckboxProps.className}>
          <Checkbox
            checked={this.state.shouldHide}
            onChange={this._handleSetHide(
              topic,
              hideCheckboxProps.checkboxCallback,
            )}
            label={hideCheckboxProps.label}
          />
        </div>
      </div>
    );
  }

  _handleSetHide(
    topic: string,
    checkboxCallback?: boolean => void,
  ): boolean => void {
    return hideTopic => {
      this.setState({shouldHide: hideTopic});
      this.props.actionCreators.setTopicHidden(this.props.topic, hideTopic);
      if (checkboxCallback != null) {
        checkboxCallback(hideTopic);
      }
    };
  }
}

function mapStateToProps(
  state: AppState,
  ownProps: {className?: string, topic: string},
) {
  return {...state, ...ownProps};
}

// $FlowFixMe (>=0.85.0) (T35986896) Flow upgrade suppress
export const WelcomePageContainer = connect(
  mapStateToProps,
  ActionCreators,
  (stateProps, actionCreators) => ({...stateProps, actionCreators}),
)(WelcomePageComponent);
