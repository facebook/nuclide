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

import {
  getDefaultConnectionProfile,
  getOfficialRemoteServerCommand,
  getSavedConnectionProfiles,
  onSavedConnectionProfilesDidChange,
  saveConnectionConfig,
  saveConnectionProfiles,
} from './connection-profile-utils';
import ConnectionDialog from './ConnectionDialog';
import CreateConnectionProfileForm from './CreateConnectionProfileForm';
import {getLogger} from 'log4js';
import {getUniqueHostsForProfiles} from './connection-profile-utils';
import {PromiseQueue} from '../../commons-node/promise-executors';
import React from 'react';
import ReactDOM from 'react-dom';

const logger = getLogger('nuclide-remote-projects');
let dialogPromiseQueue: ?PromiseQueue = null;

export type OpenConnectionDialogOptions = {
  initialServer: string,
  initialCwd: string,
  initialRemoteServerCommand?: string,
};

/**
 * Opens the remote connection dialog flow, which includes asking the user
 * for connection parameters (e.g. username, server name, etc), and optionally
 * asking for additional (e.g. 2-fac) authentication.
 */
export function openConnectionDialog(
  options?: OpenConnectionDialogOptions,
): Promise<?RemoteConnection> {
  if (!dialogPromiseQueue) {
    dialogPromiseQueue = new PromiseQueue();
  }

  return dialogPromiseQueue.submit(
    () =>
      new Promise((resolve, reject) => {
        // During the lifetime of this 'openConnectionDialog' flow, the 'default'
        // connection profile should not change (even if it is reset by the user
        // connecting to a remote project from another Atom window).
        const defaultConnectionProfile: NuclideRemoteConnectionProfile = getDefaultConnectionProfile(
          options,
        );
        // The `compositeConnectionProfiles` is the combination of the default connection
        // profile plus any user-created connection profiles. Initialize this to the
        // default connection profile. This array of profiles may change in the lifetime
        // of `openConnectionDialog` flow.
        let compositeConnectionProfiles: Array<
          NuclideRemoteConnectionProfile,
        > = [defaultConnectionProfile];
        // Add any previously-created (saved) connection profiles.
        compositeConnectionProfiles = compositeConnectionProfiles.concat(
          getSavedConnectionProfiles(),
        );

        // We want to observe changes in the saved connection profiles during the
        // lifetime of this connection dialog, because the user can add/delete
        // a profile from a connection dialog.
        let connectionProfilesSubscription: ?IDisposable = null;
        function cleanupSubscriptionFunc(): void {
          if (connectionProfilesSubscription) {
            connectionProfilesSubscription.dispose();
          }
        }

        function onDeleteProfileClicked(indexToDelete: number) {
          if (indexToDelete === 0) {
            // no-op: The default connection profile can't be deleted.
            // TODO jessicalin: Show this error message in a better place.
            atom.notifications.addError(
              'The default connection profile cannot be deleted.',
            );
            return;
          }
          if (compositeConnectionProfiles) {
            if (indexToDelete >= compositeConnectionProfiles.length) {
              logger.fatal(
                'Tried to delete a connection profile with an index that does not exist. ' +
                  'This should never happen.',
              );
              return;
            }
            // Remove the index of the profile to delete.
            let newConnectionProfiles = compositeConnectionProfiles
              .slice(0, indexToDelete)
              .concat(compositeConnectionProfiles.slice(indexToDelete + 1));
            // Remove the first index, because this is the default connection profile,
            // not a user-created profile.
            newConnectionProfiles = newConnectionProfiles.slice(1);
            saveConnectionProfiles(newConnectionProfiles);
          }
        }

        let basePanel;
        let newProfileForm;

        function saveProfile(
          index: number,
          profile: NuclideRemoteConnectionProfile,
        ): void {
          const profiles = compositeConnectionProfiles.slice();
          profiles.splice(index, 1, profile);

          // Don't include the default connection profile.
          saveConnectionProfiles(profiles.slice(1));
        }

        /*
     * When the "+" button is clicked (the user intends to add a new connection profile),
     * open a new dialog with a form to create one.
     * This new dialog will be prefilled with the info from the default connection profile.
     */
        function onAddProfileClicked() {
          if (basePanel != null) {
            basePanel.destroy();
            basePanel = null;
          }

          // If there is already an open form, don't open another one.
          if (newProfileForm) {
            return;
          }

          const hostElementForNewProfileForm = document.createElement('div');
          let newProfilePanel = null;

          // Props
          function closeNewProfileForm(
            newProfile?: NuclideRemoteConnectionProfile,
          ) {
            newProfileForm = null;
            ReactDOM.unmountComponentAtNode(hostElementForNewProfileForm);
            if (newProfilePanel != null) {
              newProfilePanel.destroy();
              newProfilePanel = null;
            }
            openBaseDialog(newProfile);
          }

          function onSave(newProfile: NuclideRemoteConnectionProfile) {
            // Don't include the default connection profile.
            const userCreatedProfiles = compositeConnectionProfiles
              .slice(1)
              .concat(newProfile);
            saveConnectionProfiles(userCreatedProfiles);
            closeNewProfileForm(newProfile);
          }

          const initialDialogProps = {
            onCancel: closeNewProfileForm,
            onSave,
            initialFormFields: defaultConnectionProfile.params,
            profileHosts: getUniqueHostsForProfiles(
              compositeConnectionProfiles,
            ),
          };

          newProfilePanel = atom.workspace.addModalPanel({
            item: hostElementForNewProfileForm,
          });

          // Pop up a dialog that is pre-filled with the default params.
          newProfileForm = ReactDOM.render(
            <CreateConnectionProfileForm {...initialDialogProps} />,
            hostElementForNewProfileForm,
          );
        }

        function openBaseDialog(
          selectedProfile?: NuclideRemoteConnectionProfile,
        ) {
          const hostEl = document.createElement('div');
          let indexOfInitiallySelectedConnectionProfile;
          if (selectedProfile == null) {
            // Select the default connection profile, which is always index 0.
            indexOfInitiallySelectedConnectionProfile = 0;
          } else {
            const selectedDisplayTitle = selectedProfile.displayTitle;
            indexOfInitiallySelectedConnectionProfile = compositeConnectionProfiles.findIndex(
              profile => profile.displayTitle === selectedDisplayTitle,
            );
          }

          // The connection profiles could change, but the rest of the props passed
          // to the ConnectionDialog will not.
          // Note: the `cleanupSubscriptionFunc` is called when the dialog closes:
          // `onConnect`, `onError`, or `onCancel`.
          const baseDialogProps = {
            indexOfInitiallySelectedConnectionProfile,
            onAddProfileClicked,
            onCancel: () => {
              resolve(/* connection */ null);
              cleanupSubscriptionFunc();
            },
            onClosed: () => {
              // Unmount the ConnectionDialog and clean up the host element.
              ReactDOM.unmountComponentAtNode(hostEl);
              if (basePanel != null) {
                basePanel.destroy();
              }
            },
            onConnect: async (connection, config) => {
              resolve(connection);
              saveConnectionConfig(config, getOfficialRemoteServerCommand());
              cleanupSubscriptionFunc();
            },
            onError: (err_, config) => {
              resolve(/* connection */ null);
              saveConnectionConfig(config, getOfficialRemoteServerCommand());
              cleanupSubscriptionFunc();
            },
            onDeleteProfileClicked,
            onSaveProfile: saveProfile,
          };

          // If/when the saved connection profiles change, we want to re-render the dialog
          // with the new set of connection profiles.
          connectionProfilesSubscription = onSavedConnectionProfilesDidChange(
            (newProfiles: ?Array<NuclideRemoteConnectionProfile>) => {
              compositeConnectionProfiles = newProfiles
                ? [defaultConnectionProfile].concat(newProfiles)
                : [defaultConnectionProfile];

              const newDialogProps = {
                ...baseDialogProps,
                connectionProfiles: compositeConnectionProfiles,
              };
              ReactDOM.render(<ConnectionDialog {...newDialogProps} />, hostEl);
            },
          );

          basePanel = atom.workspace.addModalPanel({item: hostEl});

          // $FlowFixMe
          const parentEl: ?HTMLElement = hostEl.parentElement;
          if (parentEl != null) {
            // Atom sets the width of all modals, but the connection dialog
            // is best with more width, so reach out to the parent (an atom-panel.modal)
            // and override the maxWidth.
            parentEl.style.maxWidth = '80em';
          }

          const initialDialogProps = {
            ...baseDialogProps,
            connectionProfiles: compositeConnectionProfiles,
          };
          ReactDOM.render(<ConnectionDialog {...initialDialogProps} />, hostEl);
        }

        // Select the last profile that was used. It's possible the config changed since the last time
        // this was opened and the profile no longer exists. If the profile is not found,
        // `openBaseDialog` will select the "default" / "Most Recent" option.
        openBaseDialog(
          compositeConnectionProfiles.find(
            profile =>
              profile.displayTitle ===
              defaultConnectionProfile.params.displayTitle,
          ),
        );
      }),
  );
}
