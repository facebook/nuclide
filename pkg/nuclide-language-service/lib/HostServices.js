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
  HostServices,
  Progress,
  ShowNotificationLevel,
} from '../../nuclide-language-service-rpc/lib/rpc-types';
import type {ConnectableObservable} from 'rxjs';
import type {ConsoleApi, ConsoleService} from 'atom-ide-ui';
import type {BusySignalService} from 'atom-ide-ui';
import type {NuclideUri} from 'nuclide-commons/nuclideUri';
import type {TextEdit} from 'nuclide-commons-atom/text-edit';

import invariant from 'assert';
import consumeFirstProvider from 'nuclide-commons-atom/consumeFirstProvider';
import {getLogger} from 'log4js';
import nuclideUri from 'nuclide-commons/nuclideUri';
import {Observable} from 'rxjs';
import {memoize} from 'lodash';
import UniversalDisposable from 'nuclide-commons/UniversalDisposable';
import {forkHostServices} from '../../nuclide-language-service-rpc/lib/HostServicesAggregator';
import {applyTextEditsForMultipleFiles} from 'nuclide-commons-atom/text-edit';

let rootAggregatorPromise: ?Promise<HostServices>;
const logger = getLogger('HostServices');

export async function getHostServices(): Promise<HostServices> {
  // This method doesn't need to be async. But out of laziness we're
  // reusing 'forkHostServices', which is designed to work over NuclideRPC
  // if necessary, so it has to be async.
  if (rootAggregatorPromise == null) {
    const rootServices = new RootHostServices();
    rootAggregatorPromise = forkHostServices(rootServices, logger);
  }
  return forkHostServices(await rootAggregatorPromise, logger);
}

// Following type implements the HostServicesForLanguage interface
(((null: any): RootHostServices): HostServices);

class RootHostServices {
  _busySignalServicePromise: ?Promise<?BusySignalService>;
  _nullProgressMessage: Progress = {
    setTitle: s => {},
    dispose: () => {},
  };

  _getConsoleService = memoize(
    (): Promise<ConsoleService> => consumeFirstProvider('console', '0.1.0'),
  );

  // This method creates registers sources with the atom-ide-console service, but never disposes
  // those registrations; there's not much point. The now-defunct sources will be visible in the
  // Sources UI.
  _getConsoleApi = memoize(
    (source: string): Promise<ConsoleApi> =>
      this._getConsoleService().then(createApi =>
        createApi({id: source, name: source}),
      ),
  );

  consoleNotification(
    source: string,
    level: ShowNotificationLevel,
    text: string,
  ): void {
    this._getConsoleApi(source).then(api => {
      api.append({text, level});
    });
  }

  dialogNotification(
    level: ShowNotificationLevel,
    text: string,
  ): ConnectableObservable<void> {
    // We return a ConnectableObservable such that
    // (1) when code connects to it then we display the dialog
    // (2) when the dialog closes we complete the stream
    // (3) if code unsubscribed before that, then we dismiss the dialog
    return (
      Observable.create(observer => {
        const notification = this._atomNotification(level, text);
        return () => {
          notification.dismiss();
        };
      })
        // Note: notification.onDidDismiss never fires for non-dismissable notifications!
        // However non-dismissable notifications have a fixed 5s duration:
        // https://github.com/atom/notifications/blob/master/lib/notification-element.coffee#L50
        .takeUntil(Observable.timer(5000))
        .publish()
    );
  }

  dialogRequest(
    level: ShowNotificationLevel,
    text: string,
    buttonLabels: Array<string>,
    closeLabel: string,
  ): ConnectableObservable<string> {
    // We return a ConnectedObservable such that
    // (1) when code connects to it then we display the dialog
    // (2) if user clicks a button then we do next(buttonLabel); complete()
    // (3) if user clicks Close then we do next(closeLabel); complete();
    // (4) if code unsubscribed before that then we dismiss the dialog.
    return Observable.create(observer => {
      let result = closeLabel;
      const notification = this._atomNotification(level, text, {
        dismissable: true, // dialog will stay up until user dismisses it
        buttons: buttonLabels.map(label => ({
          text: label,
          onDidClick: () => {
            result = label;
            notification.dismiss(); // they don't auto-dismiss on click
          },
        })),
      });
      notification.onDidDismiss(() => {
        observer.next(result);
        observer.complete();
      });
      return () => notification.dismiss();
    }).publish();
  }

  async applyTextEditsForMultipleFiles(
    changes: Map<NuclideUri, Array<TextEdit>>,
  ): Promise<boolean> {
    return applyTextEditsForMultipleFiles(changes);
  }

  _getBusySignalService(): Promise<?BusySignalService> {
    // TODO(ljw): if the busy-signal-package has been disabled before this
    // this function is called, we'll return a promise that never completes.
    if (this._busySignalServicePromise == null) {
      this._busySignalServicePromise = new Promise((resolve, reject) => {
        atom.packages.serviceHub.consume(
          'atom-ide-busy-signal',
          '0.1.0',
          service => {
            // When the package is provided to us, resolve the promise
            resolve(service);
            // When the package becomes unavailable to us, put in a null promise
            return new UniversalDisposable(() => {
              this._busySignalServicePromise = Promise.resolve(null);
            });
          },
        );
      });
    }
    return this._busySignalServicePromise;
  }

  async showProgress(
    title: string,
    options?: {|debounce?: boolean|},
  ): Promise<Progress> {
    const service = await this._getBusySignalService();
    const busyMessage =
      service == null
        ? this._nullProgressMessage
        : service.reportBusy(title, {...options});
    // The BusyMessage type from atom-ide-busy-signal happens to satisfy the
    // nuclide-rpc-able interface 'Progress': thus, we can return it directly.
    return (busyMessage: Progress);
  }

  showActionRequired(
    title: string,
    options?: {|clickable?: boolean|},
  ): ConnectableObservable<void> {
    return Observable.defer(() => this._getBusySignalService())
      .switchMap(service => {
        return Observable.create(observer => {
          let onDidClick;
          if (options != null && options.clickable) {
            onDidClick = () => {
              observer.next();
            };
          }
          const busyMessage =
            service == null
              ? this._nullProgressMessage
              : service.reportBusy(title, {
                  waitingFor: 'user',
                  onDidClick,
                });
          return () => busyMessage.dispose();
        });
      })
      .publish();
  }

  dispose(): void {
    // No one can ever call this function because RootHostServices and
    // RootAggregator are private to this module, and we don't call dispose.
    invariant(false, 'RootHostServices and RootAggregator cannot be disposed.');
  }

  async childRegister(child: HostServices): Promise<HostServices> {
    return this;
    // Root only ever has exactly one child, the RootAggregator,
    // so we don't bother with registration: when the aggregator relays
    // commands, it will relay them straight to root services.
  }

  _atomNotification(
    level: ShowNotificationLevel,
    text: string,
    options?: atom$NotificationOptions,
  ): atom$Notification {
    switch (level) {
      case 'info':
        return atom.notifications.addInfo(text, options);
      case 'log':
        return atom.notifications.addInfo(text, options);
      case 'warning':
        return atom.notifications.addWarning(text, options);
      case 'error':
        return atom.notifications.addError(text, options);
      default:
        invariant(false, 'Unrecognized ShowMessageLevel');
    }
  }

  // Returns false if there is no such registered command on the active text
  // editor. Otherwise returns true and dispatches the command.
  async dispatchCommand(
    command: string,
    params: {|args: any, projectRoot: NuclideUri|},
  ): Promise<boolean> {
    const textEditor = atom.workspace.getActiveTextEditor();
    const target = textEditor != null ? textEditor.getElement() : null;
    if (target == null) {
      return false;
    }
    const commands = atom.commands.findCommands({target});
    if (commands.find(c => c.name === command) == null) {
      return false;
    }
    // The LSPLanguageService forwards the args directly from the language server
    // and so all the URIs in the args are local to the remote server. Pass in
    // the hostname here so that we can easily resolve the URIs on the client side.
    atom.commands.dispatch(target, command, {
      hostname: nuclideUri.isRemote(params.projectRoot)
        ? nuclideUri.getHostname(params.projectRoot)
        : null,
      args: params.args,
    });
    return true;
  }
}
