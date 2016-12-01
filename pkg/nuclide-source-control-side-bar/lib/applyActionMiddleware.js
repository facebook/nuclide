'use babel';
/* @flow */

/*
 * Copyright (c) 2015-present, Facebook, Inc.
 * All rights reserved.
 *
 * This source code is licensed under the license found in the LICENSE file in
 * the root directory of this source tree.
 */

import type {Action} from './types';
import type {AppState} from '..';

import * as ActionType from './ActionType';
import {HgRepositoryClient} from '../../nuclide-hg-repository-client';
import invariant from 'assert';
import {observableFromSubscribeFunction} from '../../commons-node/event';
import {repositoryForPath} from '../../nuclide-hg-git-bridge';
import {Observable} from 'rxjs';
import featureConfig from '../../commons-atom/featureConfig';
import {STACKED_CONFIG_KEY} from './constants';

const HANDLED_ACTION_TYPES = [
  ActionType.CREATE_BOOKMARK,
  ActionType.DELETE_BOOKMARK,
  ActionType.FETCH_PROJECT_REPOSITORIES,
  ActionType.RENAME_BOOKMARK,
  ActionType.UPDATE_TO_BOOKMARK,
];

export function applyActionMiddleware(
  actions: Observable<Action>,
  getState: () => AppState,
): Observable<Action> {
  const output = Observable.merge(
    // Skip unhandled ActionTypes.
    actions.filter(action => HANDLED_ACTION_TYPES.indexOf(action.type) === -1),

    actions.filter(action => action.type === ActionType.CREATE_BOOKMARK)
      .switchMap(action => {
        invariant(action.type === ActionType.CREATE_BOOKMARK);

        const {name, repository} = action.payload;
        if (repository.getType() !== 'hg') {
          return Observable.empty();
        }

        invariant(repository instanceof HgRepositoryClient);

        const stacked: boolean = (featureConfig.get(STACKED_CONFIG_KEY): any);
        let createBookmarkTask;

        if (stacked) {
          createBookmarkTask = Observable.fromPromise(repository.createBookmark(name));
        } else {
          createBookmarkTask = Observable.fromPromise(repository.checkoutForkBase())
            .switchMap(() => Observable.fromPromise(repository.createBookmark(name)));
        }

        // TODO(most): Add loading indicators.
        return createBookmarkTask
          .catch(error => {
            atom.notifications.addWarning('Failed to create bookmark', {
              detail: error,
              dismissable: true,
            });
            return Observable.empty();
          })
          .ignoreElements();
      }),

    // Fetch and subscribe to repositories and their bookmarks.
    actions.filter(action => action.type === ActionType.FETCH_PROJECT_REPOSITORIES)
      .switchMap(action => {
        const {projectDirectories} = getState();

        return Observable.from(projectDirectories).flatMap(directory => {
          const repository = repositoryForPath(directory.getPath());
          if (repository == null) {
            return Observable.empty();
          }

          const setDirectoryAction = {
            payload: {
              directory,
              repository,
            },
            type: ActionType.SET_DIRECTORY_REPOSITORY,
          };

          if (repository.getType() !== 'hg') {
            return Observable.of(setDirectoryAction);
          }

          // Type was checked with `getType`. Downcast to safely access members with Flow.
          invariant(repository instanceof HgRepositoryClient);

          const bookmarkUpdates = Observable.merge(
            observableFromSubscribeFunction(
              // Re-fetch when the list of bookmarks changes.
              repository.onDidChangeBookmarks.bind(repository),
            ),
            observableFromSubscribeFunction(
              // Re-fetch when the active bookmark changes (called "short head" to match
              // Atom's Git API).
              repository.onDidChangeShortHead.bind(repository),
            ),
          )
          .startWith(null) // Kick it off the first time
          .switchMap(() => {
            return Observable.fromPromise(repository.getBookmarks());
          })
          .map(bookmarks => ({
            type: ActionType.SET_REPOSITORY_BOOKMARKS,
            payload: {
              bookmarks,
              // TODO(most): figure out flow type incompatability.
              repository: (repository: any),
            },
          }));

          const statusUpdates = Observable.merge(
            observableFromSubscribeFunction(
              repository.onDidChangeStatuses.bind(repository),
            ),
            observableFromSubscribeFunction(
              repository.onDidChangeStatus.bind(repository),
            ),
          )
          .startWith(null)
          .switchMap(() => {
            return Observable.of({
              payload: {
                directory,
                repository,
              },
              type: ActionType.UPDATE_UNCOMMITTED_CHANGES,
            });
          });

          return Observable.of(setDirectoryAction).concat(
            Observable.merge(bookmarkUpdates, statusUpdates),
          );
        });
      }),

    actions.filter(action => action.type === ActionType.UPDATE_TO_BOOKMARK)
      .switchMap(action => {
        // Action was filtered, invariant check to downcast in Flow.
        invariant(action.type === ActionType.UPDATE_TO_BOOKMARK);

        const {bookmark, repository} = action.payload;
        return Observable
          .fromPromise(repository.checkoutReference(bookmark.bookmark, false))
          .ignoreElements()
          .catch(error => {
            atom.notifications.addWarning('Failed Updating to Bookmark', {
              description: 'Revert or commit uncommitted changes before changing bookmarks.',
              detail: error,
              dismissable: true,
            });

            return Observable.empty();
          });
      }),

    actions.filter(action => action.type === ActionType.RENAME_BOOKMARK)
      .groupBy(action => {
        // Action was filtered, invariant check to downcast in Flow.
        invariant(action.type === ActionType.RENAME_BOOKMARK);
        return action.payload.bookmark.rev;
      })
      .flatMap(renames => {
        return renames.switchMap(action => {
          // Action was filtered, invariant check to downcast in Flow.
          invariant(action.type === ActionType.RENAME_BOOKMARK);
          const {repository} = action.payload;

          if (!(repository instanceof HgRepositoryClient)) {
            atom.notifications.addWarning('Failed Renaming Bookmark', {
              detail: `Expected repository type 'hg' but found ${repository.getType()}`,
              dismissable: true,
            });
            return Observable.empty();
          }
          const {
            bookmark,
            nextName,
          } = action.payload;

          return Observable.of({
            payload: {
              bookmark,
              repository,
            },
            type: ActionType.SET_BOOKMARK_IS_LOADING,
          }).concat(
            Observable
              .fromPromise(repository.renameBookmark(bookmark.bookmark, nextName))
              .ignoreElements()
              .catch(error => {
                atom.notifications.addWarning('Failed Renaming Bookmark', {
                  detail: error,
                  dismissable: true,
                });

                return Observable.of({
                  payload: {
                    bookmark,
                    repository,
                  },
                  type: ActionType.UNSET_BOOKMARK_IS_LOADING,
                });
              }),
          );
        });
      }),

    actions.filter(action => action.type === ActionType.DELETE_BOOKMARK)
      .groupBy(action => {
        // Action was filtered, invariant check to downcast in Flow.
        invariant(action.type === ActionType.DELETE_BOOKMARK);
        return action.payload.bookmark.rev;
      })
      .flatMap(renames => {
        return renames.switchMap(action => {
          // Action was filtered, invariant check to downcast in Flow.
          invariant(action.type === ActionType.DELETE_BOOKMARK);
          const {repository} = action.payload;

          if (!(repository instanceof HgRepositoryClient)) {
            atom.notifications.addWarning('Failed Deleting Bookmark', {
              detail: `Expected repository type 'hg' but found ${repository.getType()}`,
              dismissable: true,
            });
            return Observable.empty();
          }
          const {bookmark} = action.payload;

          return Observable.of({
            payload: {
              bookmark,
              repository,
            },
            type: ActionType.SET_BOOKMARK_IS_LOADING,
          }).concat(
            Observable
              .fromPromise(repository.deleteBookmark(bookmark.bookmark))
              .ignoreElements()
              .catch(error => {
                atom.notifications.addWarning('Failed Deleting Bookmark', {
                  detail: error,
                  dismissable: true,
                });

                return Observable.of({
                  payload: {
                    bookmark,
                    repository,
                  },
                  type: ActionType.UNSET_BOOKMARK_IS_LOADING,
                });
              }),
          );
        });
      }),
  );
  return output.share();
}
