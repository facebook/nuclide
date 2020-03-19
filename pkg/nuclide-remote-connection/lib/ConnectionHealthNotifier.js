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

import type {XhrConnectionHeartbeat} from 'big-dig/src/client/XhrConnectionHeartbeat';

import invariant from 'assert';
import {trackEvent} from 'nuclide-analytics';
import UniversalDisposable from 'nuclide-commons/UniversalDisposable';
import {getLogger} from 'log4js';

const logger = getLogger('nuclide-remote-connection');

const HEARTBEAT_AWAY_REPORT_COUNT = 3;
const HEARTBEAT_NOTIFICATION_ERROR = 1;
const HEARTBEAT_NOTIFICATION_WARNING = 2;

type HeartbeatNotification = {
  notification: atom$Notification,
  code: string,
};

// Returning true short-circuits the default error handling in onHeartbeatError()
export type OnHeartbeatErrorCallback = (errorCode: string) => boolean;

// Provides feedback to the user of the health of a ReliableSocket.
export class ConnectionHealthNotifier {
  _heartbeatNetworkAwayCount: number;
  _lastHeartbeatNotification: ?HeartbeatNotification;
  _subscription: IDisposable;
  _onHeartbeatError: ?OnHeartbeatErrorCallback;

  constructor(host: string, port: number, heartbeat: XhrConnectionHeartbeat) {
    this._heartbeatNetworkAwayCount = 0;
    this._lastHeartbeatNotification = null;

    const uri = `https://${host}:${port}`;

    /**
     * Adds an Atom notification for the detected heartbeat network status
     * The function makes sure not to add many notifications for the same event and prioritize
     * new events.
     */
    const addHeartbeatNotification = (
      type: number,
      errorCode: string,
      message: string,
      dismissable: boolean,
      askToReload: boolean,
    ) => {
      const {code, notification: existingNotification} =
        this._lastHeartbeatNotification || {};
      if (code && code === errorCode && dismissable) {
        // A dismissable heartbeat notification with this code is already active.
        return;
      }
      let notification = null;
      const options = {dismissable, buttons: []};
      if (askToReload) {
        options.buttons.push({
          className: 'icon icon-zap',
          onDidClick() {
            atom.reload();
          },
          text: 'Reload Atom',
        });
      }
      switch (type) {
        case HEARTBEAT_NOTIFICATION_ERROR:
          notification = atom.notifications.addError(message, options);
          break;
        case HEARTBEAT_NOTIFICATION_WARNING:
          notification = atom.notifications.addWarning(message, options);
          break;
        default:
          throw new Error('Unrecongnized heartbeat notification type');
      }
      if (existingNotification) {
        existingNotification.dismiss();
      }
      invariant(notification);
      this._lastHeartbeatNotification = {
        notification,
        code: errorCode,
      };
    };

    const onHeartbeat = () => {
      if (this._lastHeartbeatNotification) {
        // If there has been existing heartbeat error/warning,
        // that means connection has been lost and we shall show a message about connection
        // being restored without a reconnect prompt.
        const {notification} = this._lastHeartbeatNotification;
        notification.dismiss();
        atom.notifications.addSuccess(
          'Connection restored to Nuclide Server at: ' + uri,
        );
        this._heartbeatNetworkAwayCount = 0;
        this._lastHeartbeatNotification = null;
      }
    };

    const notifyNetworkAway = (code: string) => {
      this._heartbeatNetworkAwayCount++;
      if (this._heartbeatNetworkAwayCount >= HEARTBEAT_AWAY_REPORT_COUNT) {
        addHeartbeatNotification(
          HEARTBEAT_NOTIFICATION_WARNING,
          code,
          `Nuclide server cannot be reached at "${uri}".<br/>` +
            ' Nuclide will reconnect when the network is restored.',
          /* dismissable */ true,
          /* askToReload */ false,
        );
      }
    };

    const onHeartbeatError = (error: any) => {
      const {code, message, originalCode} = error;
      // Don't keep tracking consecutive NETWORK_AWAY events:
      // the user's probably offline anyway so analytics events just pile up.
      if (
        code !== 'NETWORK_AWAY' ||
        this._heartbeatNetworkAwayCount < HEARTBEAT_AWAY_REPORT_COUNT
      ) {
        trackEvent({
          type: 'heartbeat-error',
          data: {
            code: code || '',
            originalCode: originalCode || '',
            message: message || '',
            host,
          },
        });
      }
      logger.info('Heartbeat network error:', code, originalCode, message);

      if (this._onHeartbeatError != null && this._onHeartbeatError(error)) {
        return;
      }

      switch (code) {
        case 'NETWORK_AWAY':
          // Notify switching networks, disconnected, timeout, unreachable server or fragile
          // connection.
          notifyNetworkAway(code);
          break;
        case 'SERVER_CRASHED':
          // Server shut down or port no longer accessible.
          // Notify the server was there, but now gone.
          addHeartbeatNotification(
            HEARTBEAT_NOTIFICATION_ERROR,
            code,
            '**Nuclide Server Crashed**<br/>' +
              'Please reload Atom to restore your remote project connection.',
            /* dismissable */ true,
            /* askToReload */ true,
          );
          break;
        case 'PORT_NOT_ACCESSIBLE':
          // Notify never heard a heartbeat from the server.
          addHeartbeatNotification(
            HEARTBEAT_NOTIFICATION_ERROR,
            code,
            '**Nuclide Server Is Not Reachable**<br/>' +
              `It could be running on a port that is not accessible: ${String(
                port,
              )}.`,
            /* dismissable */ true,
            /* askToReload */ false,
          );
          break;
        case 'INVALID_CERTIFICATE':
          // Notify the client certificate is not accepted by nuclide server
          // (certificate mismatch).
          addHeartbeatNotification(
            HEARTBEAT_NOTIFICATION_ERROR,
            code,
            '**Certificate Expired**<br/>' +
              // The expiration date should be synced with
              // nuclide-server/scripts/nuclide_server_manager.py.
              'The Nuclide server certificate has most likely expired.<br>' +
              'For your security, certificates automatically expire after 14 days.<br>' +
              'Please reload Atom to restore your remote project connection.',
            /* dismissable */ true,
            /* askToReload */ true,
          );
          break;
        case 'CERT_SIGNATURE_FAILURE':
          addHeartbeatNotification(
            HEARTBEAT_NOTIFICATION_ERROR,
            code,
            '**Certificate No Longer Valid**<br/>' +
              'The Nuclide server cert is no longer valid for this client.<br>' +
              'This can happen  when you connect to the server with another ' +
              'client, which is not currently supported.<br>' +
              'Please reload Atom to restore your remote project connection.',
            /* dismissable */ true,
            /* askToReload */ true,
          );
          break;
        default:
          notifyNetworkAway(code);
          logger.error('Unrecongnized heartbeat error code: ' + code, message);
          break;
      }
    };
    this._subscription = new UniversalDisposable(
      heartbeat.onHeartbeat(onHeartbeat),
      heartbeat.onHeartbeatError(onHeartbeatError),
    );
  }

  // Sets function to be called on Heartbeat error.
  // Function should return true to short-circuit the rest of the error logic.
  setOnHeartbeatError(onHeartbeatError: ?OnHeartbeatErrorCallback): void {
    this._onHeartbeatError = onHeartbeatError;
  }

  dispose(): void {
    this._subscription.dispose();
  }
}
