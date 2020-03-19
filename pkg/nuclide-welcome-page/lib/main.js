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

import type {
  ShowPageOptions,
  Store,
  WelcomePage,
  WelcomePageApi,
  WelcomePagePaneProps,
} from './types';

import {goToLocation} from 'nuclide-commons-atom/go-to-location';
import * as React from 'react';
import invariant from 'assert';
import createPackage from 'nuclide-commons-atom/createPackage';
import {destroyItemWhere} from 'nuclide-commons-atom/destroyItemWhere';
import UniversalDisposable from 'nuclide-commons/UniversalDisposable';
import {createStore} from 'redux';
import {viewableFromReactElement} from '../../commons-atom/viewableFromReactElement';
import {
  getHiddenTopics,
  setHiddenTopics,
  migrateShowOnboardingConfigValue,
} from './config';
import * as Actions from './redux/Actions';
import {createEmptyAppState} from './redux/createEmptyAppState';
import rootReducer from './redux/rootReducer';
import {getURIForTopic} from './ui/WelcomePageGadget';
import WelcomePageGadget from './ui/WelcomePageGadget';

export type {WelcomePage, WelcomePageApi};

const SHOW_ALL_COMMAND_NAME = 'nuclide-welcome-page:show-all-welcome-pages';
const SHOW_COMMAND_NAME_PREFIX = 'nuclide-welcome-page:show-';

function getShowCommandNameForTopic(topic: string): string {
  return SHOW_COMMAND_NAME_PREFIX + topic;
}

// Since we depend on the topic string format for the construction of pane URI
// and show command, it must match this REGEX. Matches dash-delimited alphabetical
// strings starting with a letter and ending with -welcome-page
const WELCOME_PAGE_TOPIC_REGEX = /^[A-Za-z]+([-]?[A-Za-z]*)-welcome-page$/;

class Activation {
  _disposables: UniversalDisposable;
  _store: Store;

  constructor() {
    migrateShowOnboardingConfigValue();
    const hiddenTopics = getHiddenTopics();
    this._store = createStore(rootReducer, createEmptyAppState(hiddenTopics));
    this._disposables = new UniversalDisposable(
      this._registerDisplayAllCommand(),
      this._store.subscribe(() => {
        setHiddenTopics(this._store.getState().hiddenTopics);
      }),
    );
  }

  dispose(): void {
    this._disposables.dispose();
  }

  consumeWelcomePage(welcomePage: WelcomePage): IDisposable {
    this._store.dispatch(Actions.addWelcomePage(welcomePage));
    const topic = welcomePage.topic;
    invariant(WELCOME_PAGE_TOPIC_REGEX.test(topic));

    // Add opener and command (based on topic) for individual welcome pages
    return new UniversalDisposable(
      atom.workspace.addOpener(uri => {
        if (uri === getURIForTopic(topic)) {
          return this._createWelcomePageViewable(topic, welcomePage.paneProps);
        }
      }),
      this._registerCommandForTopic(topic, welcomePage.menuLabel),
      // clean up all welcome page panes before removing welcome pages from store
      () => {
        destroyItemWhere(item => item instanceof WelcomePageGadget).then(() =>
          this._store.dispatch(Actions.deleteWelcomePage(topic)),
        );
      },
    );
  }

  _registerCommandForTopic(topic: string, menuLabel: string): IDisposable {
    const showCommand = getShowCommandNameForTopic(topic);
    return new UniversalDisposable(
      atom.commands.add('atom-workspace', showCommand, () => {
        this.showPageForTopic(topic, {override: true});
      }),
      // Add menu item for individual welcome pages
      atom.menu.add([
        {
          label: 'Nuclide',
          submenu: [
            {
              label: 'Welcome Page',
              submenu: [
                {
                  label: 'Topics',
                  submenu: [
                    {
                      label: menuLabel,
                      command: showCommand,
                    },
                  ],
                },
              ],
            },
          ],
        },
      ]),
    );
  }

  _registerDisplayAllCommand(): IDisposable {
    return new UniversalDisposable(
      // show all welcome page sections, hidden or not
      atom.commands.add('atom-workspace', SHOW_ALL_COMMAND_NAME, () => {
        for (const topic of this._store.getState().welcomePages.keys()) {
          this.showPageForTopic(topic, {override: true});
        }
      }),
    );
  }

  // TODO: is there a better place to put this?
  _createWelcomePageViewable(
    topic: string,
    paneProps?: WelcomePagePaneProps,
  ): atom$Pane {
    return viewableFromReactElement(
      <WelcomePageGadget
        paneProps={paneProps}
        store={this._store}
        topic={topic}
      />,
    );
  }

  provideWelcomePageApi(): WelcomePageApi {
    return this;
  }

  showPageForTopic(topic: string, options?: ShowPageOptions = {}): void {
    const {welcomePages, hiddenTopics} = this._store.getState();
    const showAnyway =
      options != null && options.override != null && options.override;
    if (showAnyway || (welcomePages.has(topic) && !hiddenTopics.has(topic))) {
      // if the topic exists and isn't hidden
      goToLocation(getURIForTopic(topic));
    }
  }
}

createPackage(module.exports, Activation);
