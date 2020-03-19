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

export type HideCheckboxProps = {
  checkboxCallback?: boolean => void,
  className?: string,
  label?: string,
};

export type WelcomePagePaneProps = {
  title?: string,
  className?: string,
};

export type WelcomePage = {
  hideCheckboxProps?: HideCheckboxProps,
  content: React$Node,
  menuLabel: string,
  paneProps?: WelcomePagePaneProps,
  topic: string,
};

export type ShowPageOptions = {
  override?: boolean,
};

export type WelcomePageApi = {
  +showPageForTopic: (string, options?: ShowPageOptions) => void,
};

export type ShowAll = {
  type: 'SHOW_ALL',
  args: {},
};

export type ShowOne = {
  type: 'SHOW_ONE',
  args: {
    topic: string,
  },
};

export type WelcomePageData = {
  content: React$Node,
  hideCheckboxProps: HideCheckboxProps,
};

export type AppState = {
  shouldHide: boolean,
  welcomePages: Map<string, WelcomePageData>,
  hiddenTopics: Set<string>,
  isWelcomePageVisible: boolean,
};

export type Store = {
  getState(): AppState,
  dispatch(action: Action): void,
  subscribe(listener: () => mixed): () => void,
};

export type AddWelcomePageAction = {
  type: 'ADD_WELCOME_PAGE',
  payload: {
    welcomePage: WelcomePage,
  },
};

export type DeleteWelcomePageAction = {
  type: 'DELETE_WELCOME_PAGE',
  payload: {
    topic: string,
  },
};

export type UpdateWelcomePageVisibilityAction = {
  type: 'UPDATE_WELCOME_PAGE_VISIBILITY',
  payload: {
    isVisible: boolean,
  },
};

export type SetTopicHiddenAction = {
  type: 'SET_TOPIC_HIDDEN',
  payload: {
    topic: string,
    shouldHide: boolean,
  },
};

export type Action =
  | AddWelcomePageAction
  | DeleteWelcomePageAction
  | UpdateWelcomePageVisibilityAction
  | SetTopicHiddenAction;
