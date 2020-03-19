/**
 * Copyright (c) 2015-present, Facebook, Inc.
 * All rights reserved.
 *
 * This source code is licensed under the license found in the LICENSE file in
 * the root directory of this source tree.
 *
 * @flow strict-local
 * @format
 */

import type {AppState, Action, WelcomePage} from '../types';

import {getLogger} from 'log4js';
import {track} from 'nuclide-analytics';
import * as ActionTypes from './ActionTypes';

const log = getLogger('nuclide-welcome-page');

export default function rootReducer(state: AppState, action: Action): AppState {
  switch (action.type) {
    case ActionTypes.ADD_WELCOME_PAGE:
      return _addWelcomePage(state, action.payload.welcomePage);
    case ActionTypes.DELETE_WELCOME_PAGE:
      return _deleteWelcomePage(state, action.payload.topic);
    case ActionTypes.UPDATE_WELCOME_PAGE_VISIBILITY:
      return {...state, isWelcomePageVisible: action.payload.isVisible};
    case ActionTypes.SET_TOPIC_HIDDEN:
      return _setTopicHidden(
        state,
        action.payload.topic,
        action.payload.shouldHide,
      );
  }

  return state;
}

function _addWelcomePage(state: AppState, welcomePage: WelcomePage): AppState {
  const welcomePages = new Map(state.welcomePages);
  const {topic, content} = welcomePage;
  if (welcomePages.has(topic)) {
    log.warn(`Duplicate welcome page for topic '${topic}'`);
    return state;
  }
  welcomePages.set(topic, {
    content,
    hideCheckboxProps: {
      className: 'welcome-page-hide-checkbox',
      label: "Don't show this again",
      ...welcomePage.hideCheckboxProps,
    },
  });
  return {...state, welcomePages};
}

function _deleteWelcomePage(state: AppState, topic: string): AppState {
  const welcomePages = new Map(state.welcomePages);
  welcomePages.delete(topic);
  return {...state, welcomePages};
}

function _setTopicHidden(
  state: AppState,
  topic: string,
  shouldHide: boolean,
): AppState {
  const hiddenTopics = new Set(state.hiddenTopics);
  const isHidden = hiddenTopics.has(topic);
  if (!isHidden && shouldHide) {
    hiddenTopics.add(topic);
    log.info(`Hiding topic: ${topic}]`);
  } else if (isHidden && !shouldHide) {
    hiddenTopics.delete(topic);
    log.info(`Unhiding topic: ${topic}`);
  }
  track('nuclide-welcome-page-set-topic-hidden', {
    topic,
    shouldHide,
  });
  return {...state, hiddenTopics};
}
