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

import type {Action, BookShelfState, SerializedBookShelfState} from './types';

import {accumulateState} from './accumulateState';
import {
  ActiveShortHeadChangeBehavior,
  ACTIVE_SHORTHEAD_CHANGE_BEHAVIOR_CONFIG,
} from './constants';
import {applyActionMiddleware} from './applyActionMiddleware';
import {BehaviorSubject, Observable, Subject} from 'rxjs';
import {Commands} from './Commands';
import createPackage from 'nuclide-commons-atom/createPackage';
import {
  deserializeBookShelfState,
  getEmptBookShelfState,
  serializeBookShelfState,
} from './utils';
import {getHgRepositoryStream} from '../../nuclide-vcs-base';
import {getLogger} from 'log4js';
import featureConfig from 'nuclide-commons-atom/feature-config';
import invariant from 'assert';
import UniversalDisposable from 'nuclide-commons/UniversalDisposable';
import {observableFromSubscribeFunction} from 'nuclide-commons/event';
import {
  shortHeadChangedNotification,
  getShortHeadChangesFromStateStream,
} from './utils';
import {track} from 'nuclide-analytics';

function createStateStream(
  actions: Observable<Action>,
  initialState: BookShelfState,
): BehaviorSubject<BookShelfState> {
  const states = new BehaviorSubject(initialState);
  // eslint-disable-next-line nuclide-internal/unused-subscription
  actions
    .scan(accumulateState, initialState)
    .catch(error => {
      getLogger('nuclide-bookshelf').fatal(
        'bookshelf middleware got broken',
        error,
      );
      atom.notifications.addError(
        'Nuclide bookshelf broke, please report a bug to help us fix it!',
      );
      return Observable.empty();
    })
    .subscribe(states);
  return states;
}

class Activation {
  _disposables: UniversalDisposable;
  _states: BehaviorSubject<BookShelfState>;
  _commands: Commands;

  constructor(state: ?SerializedBookShelfState) {
    let initialState;
    try {
      initialState = deserializeBookShelfState(state);
    } catch (error) {
      getLogger('nuclide-bookshelf').error(
        'failed to deserialize nuclide-bookshelf state',
        state,
        error,
      );
      initialState = getEmptBookShelfState();
    }

    const actions = new Subject();
    const states = (this._states = createStateStream(
      applyActionMiddleware(actions, () => this._states.getValue()),
      initialState,
    ));

    const dispatch = action => {
      actions.next(action);
    };
    const commands = new Commands(dispatch, () => states.getValue());

    const addedRepoSubscription = getHgRepositoryStream().subscribe(
      repository => {
        // $FlowFixMe wrong repository type
        commands.addProjectRepository(repository);
      },
    );

    const paneStateChangeSubscription = Observable.merge(
      observableFromSubscribeFunction(
        atom.workspace.onDidAddPaneItem.bind(atom.workspace),
      ),
      observableFromSubscribeFunction(
        atom.workspace.onDidDestroyPaneItem.bind(atom.workspace),
      ),
    ).subscribe(() => {
      commands.updatePaneItemState();
    });

    const shortHeadChangeSubscription = getShortHeadChangesFromStateStream(
      states,
    )
      .switchMap(({repositoryPath, activeShortHead}) => {
        const repository = atom.project.getRepositories().filter(repo => {
          return repo != null && repo.getWorkingDirectory() === repositoryPath;
        })[0];
        invariant(
          repository != null,
          'shortHead changed on a non-existing repository!',
        );

        switch (featureConfig.get(ACTIVE_SHORTHEAD_CHANGE_BEHAVIOR_CONFIG)) {
          case ActiveShortHeadChangeBehavior.ALWAYS_IGNORE:
            track('bookshelf-always-ignore');
            return Observable.empty();
          case ActiveShortHeadChangeBehavior.ALWAYS_RESTORE:
            track('bookshelf-always-restore');
            // The restore needs to wait for the change shorthead state update to complete
            // before triggering a cascaded state update when handling the restore action.
            // TODO(most): move away from `nextTick`.
            process.nextTick(() => {
              commands.restorePaneItemState(repository, activeShortHead);
            });
            return Observable.empty();
          default:
            // Including ActiveShortHeadChangeBehavior.PROMPT_TO_RESTORE
            track('bookshelf-prompt-restore');
            return shortHeadChangedNotification(
              repository,
              activeShortHead,
              commands.restorePaneItemState,
            );
        }
      })
      .subscribe();

    this._disposables = new UniversalDisposable(
      actions.complete.bind(actions),
      addedRepoSubscription,
      paneStateChangeSubscription,
      shortHeadChangeSubscription,
    );
  }

  dispose() {
    this._disposables.dispose();
  }

  serialize(): ?SerializedBookShelfState {
    try {
      return serializeBookShelfState(this._states.getValue());
    } catch (error) {
      getLogger('nuclide-bookshelf').error(
        'failed to serialize nuclide-bookshelf state',
        error,
      );
      return null;
    }
  }
}

createPackage(module.exports, Activation);
