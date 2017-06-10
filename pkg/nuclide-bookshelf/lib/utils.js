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
  BookShelfState,
  RepositoryShortHeadChange,
  SerializedBookShelfState,
} from './types';

import {
  ActiveShortHeadChangeBehavior,
  ACTIVE_SHORTHEAD_CHANGE_BEHAVIOR_CONFIG,
} from './constants';

import type {NuclideUri} from 'nuclide-commons/nuclideUri';

import Immutable from 'immutable';
import invariant from 'assert';
import {Observable} from 'rxjs';
import featureConfig from 'nuclide-commons-atom/feature-config';
import nuclideUri from 'nuclide-commons/nuclideUri';
import {repositoryForPath} from '../../nuclide-vcs-base';
import {track} from '../../nuclide-analytics';

export function getEmptBookShelfState(): BookShelfState {
  return {
    repositoryPathToState: Immutable.Map(),
  };
}

// Maps are serialized as key/value pairs array to match Map `enries` format.
export function serializeBookShelfState(
  bookShelfState: BookShelfState,
): SerializedBookShelfState {
  const {repositoryPathToState} = bookShelfState;
  const serializedRepositoryPathToState = Array.from(
    repositoryPathToState.entries(),
  ).map(([repositoryPath, repositoryState]) => {
    const serializedShortHeadToFileList = {
      activeShortHead: repositoryState.activeShortHead,
      shortHeadsToFileList: Array.from(
        repositoryState.shortHeadsToFileList.entries(),
      ),
    };
    return [repositoryPath, serializedShortHeadToFileList];
  });
  return {
    repositoryPathToState: serializedRepositoryPathToState,
  };
}

export function deserializeBookShelfState(
  serializedBookShelfState: ?SerializedBookShelfState,
): BookShelfState {
  if (
    serializedBookShelfState == null ||
    serializedBookShelfState.repositoryPathToState == null
  ) {
    return getEmptBookShelfState();
  }
  const repositoryPathToState = Immutable.Map(
    serializedBookShelfState.repositoryPathToState.map(
      ([repositoryPath, repositoryState]) => {
        return [
          repositoryPath,
          {
            activeShortHead: repositoryState.activeShortHead,
            isRestoring: false,
            shortHeadsToFileList: Immutable.Map(
              repositoryState.shortHeadsToFileList,
            ),
          },
        ];
      },
    ),
  );
  return {
    repositoryPathToState,
  };
}

export function getRepoPathToEditors(): Map<
  NuclideUri,
  Array<atom$TextEditor>,
> {
  const reposToEditors = new Map();
  atom.workspace
    .getTextEditors()
    .filter(
      textEditor => textEditor.getPath() != null && textEditor.getPath() !== '',
    )
    .map(textEditor => ({
      textEditor,
      repository: repositoryForPath(textEditor.getPath() || ''),
    }))
    .filter(({repository}) => repository != null)
    .forEach(({repository, textEditor}) => {
      invariant(repository);
      const repositoryPath = repository.getWorkingDirectory();
      reposToEditors.set(
        repositoryPath,
        (reposToEditors.get(repositoryPath) || []).concat([textEditor]),
      );
    });
  return reposToEditors;
}

export function shortHeadChangedNotification(
  repository: atom$Repository,
  newShortHead: string,
  restorePaneItemState: (
    repository: atom$Repository,
    newShortHead: string,
  ) => mixed,
): Observable<void> {
  return Observable.create(observer => {
    const workingDirectoryName = nuclideUri.basename(
      repository.getWorkingDirectory(),
    );

    // TODO(most): Should we handle empty bookmark switches differently?
    const newShortHeadDisplayText = newShortHead.length > 0
      ? `to \`${newShortHead}\``
      : '';

    const shortHeadChangeNotification = atom.notifications.addInfo(
      `\`${workingDirectoryName}\`'s active bookmark has changed ${newShortHeadDisplayText}`,
      {
        detail: 'Would you like to open the files you had active then?\n \n' +
          "ProTip: Change the default behavior from 'Nuclide Settings>IDE Settings>Book Shelf'",
        dismissable: true,
        buttons: [
          {
            onDidClick: () => {
              restorePaneItemState(repository, newShortHead);
              observer.complete();
            },
            text: 'Open files',
          },
          {
            onDidClick: () => {
              featureConfig.set(
                ACTIVE_SHORTHEAD_CHANGE_BEHAVIOR_CONFIG,
                ActiveShortHeadChangeBehavior.ALWAYS_IGNORE,
              );
              observer.complete();
            },
            text: 'Always ignore',
          },
        ],
      },
    );

    const dismissSubscription = shortHeadChangeNotification.onDidDismiss(() => {
      track('bookshelf-dismiss-restore-prompt');
      observer.complete();
    });

    return function unsubscribe() {
      dismissSubscription.dispose();
      shortHeadChangeNotification.dismiss();
    };
  });
}

export function getShortHeadChangesFromStateStream(
  states: Observable<BookShelfState>,
): Observable<RepositoryShortHeadChange> {
  return states
    .pairwise()
    .flatMap(
      (
        [oldBookShelfState, newBookShelfState]: [
          BookShelfState,
          BookShelfState,
        ],
      ) => {
        const {
          repositoryPathToState: oldRepositoryPathToState,
        } = oldBookShelfState;

        return Observable.from(
          Array.from(newBookShelfState.repositoryPathToState.entries())
            .filter(([repositoryPath, newRepositoryState]) => {
              const oldRepositoryState = oldRepositoryPathToState.get(
                repositoryPath,
              );
              return (
                oldRepositoryState != null &&
                oldRepositoryState.activeShortHead !==
                  newRepositoryState.activeShortHead
              );
            })
            .map(([repositoryPath, newRepositoryState]) => {
              const {activeShortHead} = newRepositoryState;
              return {
                repositoryPath,
                activeShortHead,
              };
            }),
        );
      },
    );
}
