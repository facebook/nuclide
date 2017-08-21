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

import type {RemoteConnection} from '../../nuclide-remote-connection';
import type {NuclideRemoteConnectionProfile} from './connection-types';
// eslint-disable-next-line nuclide-internal/import-type-style
import type {Props as RemoteProjectConnectionModalProps} from './RemoteProjectConnectionModal';

import showModal from '../../nuclide-ui/showModal';
import {
  getDefaultConnectionProfile,
  getOfficialRemoteServerCommand,
  getSavedConnectionProfiles,
  onSavedConnectionProfilesDidChange,
  saveConnectionConfig,
  saveConnectionProfiles,
} from './connection-profile-utils';
import {getUniqueHostsForProfiles} from './connection-profile-utils';
import RemoteProjectConnectionModal from './RemoteProjectConnectionModal';
import {observableFromSubscribeFunction} from 'nuclide-commons/event';
import {bindObservableAsProps} from 'nuclide-commons-ui/bindObservableAsProps';
import {getLogger as getLogger_} from 'log4js';
import React from 'react';
import {BehaviorSubject, Observable} from 'rxjs';

export type OpenConnectionDialogOptions = {
  initialServer: string,
  initialCwd: string,
  initialRemoteServerCommand?: string,
};

const getLogger = () => getLogger_('nuclide-remote-projects');

/**
 * Opens the remote connection dialog flow, which includes asking the user
 * for connection parameters (e.g. username, server name, etc), and optionally
 * asking for additional (e.g. 2-fac) authentication.
 */
export function openConnectionDialog(
  dialogOptions?: OpenConnectionDialogOptions,
): Promise<?RemoteConnection> {
  return new Promise(resolve => {
    showModal(
      dismiss => {
        const StatefulModal = bindObservableAsProps(
          createPropsStream({dismiss, onConnected: resolve, dialogOptions}),
          RemoteProjectConnectionModal,
        );
        return <StatefulModal />;
      },
      {shouldDismissOnClickOutsideModal: () => false},
    );
  });
}

/**
 * Creates an observable that contains the props of the wizard component. When the state changes,
 * the observable emits new props and (thanks to `bindObservableAsProps`), we re-render the
 * component.
 */
function createPropsStream({dismiss, onConnected, dialogOptions}) {
  // During the lifetime of this 'openConnectionDialog' flow, the 'default'
  // connection profile should not change (even if it is reset by the user
  // connecting to a remote project from another Atom window).
  const defaultConnectionProfile = getDefaultConnectionProfile(dialogOptions);

  const initialConnectionProfiles = [
    defaultConnectionProfile,
    ...getSavedConnectionProfiles(),
  ];

  // These props don't change over the lifetime of the modal.
  const staticProps = {
    defaultConnectionProfile,
    initialFormFields: defaultConnectionProfile.params,
    profileHosts: getUniqueHostsForProfiles(initialConnectionProfiles),

    onScreenChange: screen => {
      updateState({screen});
    },
    onConnect: async (connection, config) => {
      onConnected(connection);
      saveConnectionConfig(config, getOfficialRemoteServerCommand());
    },
    onCancel: () => {
      onConnected(null);
      dismiss();
    },
    onError: (err_, config) => {
      onConnected(/* connection */ null);
      saveConnectionConfig(config, getOfficialRemoteServerCommand());
    },
    onClosed: () => {
      dismiss();
    },
    onSaveProfile(
      index: number,
      profile: NuclideRemoteConnectionProfile,
    ): void {
      const connectionProfiles = states.getValue().connectionProfiles.slice();
      // Override the existing version.
      connectionProfiles.splice(index, 1, profile);
      updateState({connectionProfiles});
    },
    onDeleteProfileClicked(indexToDelete: number): void {
      if (indexToDelete === 0) {
        // no-op: The default connection profile can't be deleted.
        // TODO jessicalin: Show this error message in a better place.
        atom.notifications.addError(
          'The default connection profile cannot be deleted.',
        );
        return;
      }
      const {connectionProfiles, selectedProfileIndex} = states.getValue();
      if (connectionProfiles) {
        if (indexToDelete >= connectionProfiles.length) {
          getLogger().fatal(
            'Tried to delete a connection profile with an index that does not exist. ' +
              'This should never happen.',
          );
          return;
        }
        const nextConnectionProfiles = connectionProfiles.slice();
        nextConnectionProfiles.splice(indexToDelete, 1);
        const nextSelectedProfileIndex =
          selectedProfileIndex >= indexToDelete
            ? selectedProfileIndex - 1
            : selectedProfileIndex;
        updateState({
          selectedProfileIndex: nextSelectedProfileIndex,
          connectionProfiles: nextConnectionProfiles,
        });
      }
    },
    onProfileCreated(newProfile: NuclideRemoteConnectionProfile) {
      const connectionProfiles = [
        ...states.getValue().connectionProfiles,
        newProfile,
      ];
      updateState({
        connectionProfiles,
        selectedProfileIndex: connectionProfiles.length - 1,
        screen: 'connect',
      });
    },
    onProfileSelected(selectedProfileIndex: number): void {
      updateState({selectedProfileIndex});
    },
  };

  function updateState(nextState: Object, saveProfiles: boolean = true): void {
    const prevState = states.getValue();
    states.next({...prevState, ...nextState});

    // If the connection profiles changed, save them to the config. The `saveProfiles` option allows
    // us to opt out because this is a bi-directional sync and we don't want to cause an infinite
    // loop!
    if (
      saveProfiles &&
      nextState.connectionProfiles != null &&
      nextState.connectionProfiles !== prevState.connectionProfiles
    ) {
      // Don't include the first profile when saving since that's the default.
      saveConnectionProfiles(nextState.connectionProfiles.slice(1));
    }
  }

  const states = new BehaviorSubject({
    screen: 'connect',
    selectedProfileIndex: 0,
    connectionProfiles: initialConnectionProfiles,
  });

  const props: Observable<
    RemoteProjectConnectionModalProps,
  > = states.map(state => ({...state, ...staticProps}));

  const savedProfilesStream = observableFromSubscribeFunction(
    onSavedConnectionProfilesDidChange,
  ).map(() => getSavedConnectionProfiles());

  return Observable.using(
    () =>
      // If something else changes the saved profiles, we want to update our state to reflect those
      // changes.
      savedProfilesStream.subscribe(savedProfiles => {
        updateState(
          {connectionProfiles: [defaultConnectionProfile, ...savedProfiles]},
          // Don't write the changes to the config; that's where we got them from and we don't want
          // to cause an infinite loop.
          false,
        );
      }),
    () => props,
  );
}
