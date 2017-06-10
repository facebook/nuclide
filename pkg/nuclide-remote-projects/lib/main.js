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

import type {HomeFragments} from '../../nuclide-home/lib/types';
import type {
  RemoteConnectionConfiguration,
} from '../../nuclide-remote-connection/lib/RemoteConnection';
import type {NuclideUri} from 'nuclide-commons/nuclideUri';
import type {OpenConnectionDialogOptions} from './open-connection';

import {getLogger} from 'log4js';
import {loadBufferForUri, bufferForUri} from '../../nuclide-remote-connection';
import {getOpenFileEditorForRemoteProject} from './utils';
import featureConfig from 'nuclide-commons-atom/feature-config';
import loadingNotification from '../../commons-atom/loading-notification';
import invariant from 'assert';
import {CompositeDisposable} from 'atom';
import {
  RemoteConnection,
  RemoteDirectory,
  ServerConnection,
  getGrepServiceByNuclideUri,
} from '../../nuclide-remote-connection';
import {trackImmediate} from '../../nuclide-analytics';
import {openConnectionDialog} from './open-connection';
import nuclideUri from 'nuclide-commons/nuclideUri';
import RemoteDirectorySearcher from './RemoteDirectorySearcher';
import RemoteDirectoryProvider from './RemoteDirectoryProvider';
import RemoteProjectsController from './RemoteProjectsController';
import RemoteProjectsServiceImpl from './RemoteProjectsService';
import patchAtomWorkspaceReplace from './patchAtomWorkspaceReplace';
import {setNotificationService} from './AtomNotifications';

const logger = getLogger('nuclide-remote-projects');

export type RemoteProjectsService = {
  /**
   * A simple way to wait for remote projects to finish reloading after startup.
   * Resolves with a list of successfully reloaded project paths.
   * If reloading has already finished, this immediately resolves.
   */
  waitForRemoteProjectReload(
    callback: (loadedProjects: Array<string>) => mixed,
  ): IDisposable,

  /**
   * Attempts to open a remote connection, first by attempting the previously cached connection
   * and then by opening a connection dialog.
   */
  createRemoteConnection(
    config: SerializableRemoteConnectionConfiguration,
  ): Promise<?RemoteConnection>,

  /**
   * Start the flow to open a remote connection by opening a connection dialog, regardless of
   * the previously cached connections.
   */
  openConnectionDialog(
    config: OpenConnectionDialogOptions,
  ): Promise<?RemoteConnection>,

  /**
   * Find an existing connection or create one given the remote connetion details.
   */
  findOrCreate(
    config: RemoteConnectionConfiguration,
  ): Promise<RemoteConnection>,
};

/**
 * Stores the host and cwd of a remote connection.
 */
export type SerializableRemoteConnectionConfiguration = {
  host: string,
  cwd: string,
  displayTitle: string,
};

let packageSubscriptions: ?CompositeDisposable = null;
let controller: ?RemoteProjectsController = null;
let remoteProjectsService: ?RemoteProjectsServiceImpl = null;

const CLOSE_PROJECT_DELAY_MS = 100;
const pendingFiles = {};

function createSerializableRemoteConnectionConfiguration(
  config: RemoteConnectionConfiguration,
): SerializableRemoteConnectionConfiguration {
  return {
    host: config.host,
    cwd: config.cwd,
    displayTitle: config.displayTitle,
  };
}

function addRemoteFolderToProject(connection: RemoteConnection): IDisposable {
  const workingDirectoryUri = connection.getUriForInitialWorkingDirectory();
  // If restoring state, then the project already exists with local directory and wrong repo
  // instances. Hence, we remove it here, if existing, and add the new path for which we added a
  // workspace opener handler.
  atom.project.removePath(workingDirectoryUri);

  atom.project.addPath(workingDirectoryUri);

  const subscription = atom.project.onDidChangePaths(paths => {
    if (paths.indexOf(workingDirectoryUri) !== -1) {
      return;
    }

    // The project was removed from the tree.
    subscription.dispose();
    if (connection.isOnlyConnection()) {
      closeOpenFilesForRemoteProject(connection);
    }

    // Integration tests close the connection manually, so skip the rest.
    if (atom.inSpecMode()) {
      return;
    }

    // Delay closing the underlying socket connection until registered subscriptions have closed.
    // We should never depend on the order of registration of the `onDidChangePaths` event,
    // which also dispose consumed service's resources.
    setTimeout(closeRemoteConnection, CLOSE_PROJECT_DELAY_MS);
  });

  function closeRemoteConnection() {
    const closeConnection = (shutdownIfLast: boolean) => {
      connection.close(shutdownIfLast);
    };

    if (!connection.isOnlyConnection()) {
      logger.info(
        'Remaining remote projects using Nuclide Server - no prompt to shutdown',
      );
      const shutdownIfLast = false;
      closeConnection(shutdownIfLast);
      return;
    }

    if (connection.alwaysShutdownIfLast()) {
      closeConnection(true);
      return;
    }

    const shutdownServerAfterDisconnection = featureConfig.get(
      'nuclide-remote-projects.shutdownServerAfterDisconnection',
    );
    invariant(typeof shutdownServerAfterDisconnection === 'boolean');
    closeConnection(shutdownServerAfterDisconnection);
  }

  return subscription;
}

function closeOpenFilesForRemoteProject(connection: RemoteConnection): void {
  const remoteProjectConfig = connection.getConfig();
  const openInstances = getOpenFileEditorForRemoteProject(remoteProjectConfig);
  for (const openInstance of openInstances) {
    const {uri, editor, pane} = openInstance;
    // It's possible to open files outside of the root of the connection.
    // Only clean up these files if we're the only connection left.
    if (
      connection.isOnlyConnection() ||
      nuclideUri.contains(connection.getUriForInitialWorkingDirectory(), uri)
    ) {
      pane.removeItem(editor);
      editor.destroy();
    }
  }
}

function getRemoteRootDirectories(): Array<atom$Directory> {
  // TODO: Use nuclideUri instead.
  return atom.project
    .getDirectories()
    .filter(directory => directory.getPath().startsWith('nuclide:'));
}

/**
 * Removes any Directory (not RemoteDirectory) objects that have Nuclide
 * remote URIs.
 */
function deleteDummyRemoteRootDirectories() {
  for (const directory of atom.project.getDirectories()) {
    if (
      nuclideUri.isRemote(directory.getPath()) &&
      !RemoteDirectory.isRemoteDirectory(directory)
    ) {
      atom.project.removePath(directory.getPath());
    }
  }
}

/**
 * The same TextEditor must be returned to prevent Atom from creating multiple tabs
 * for the same file, because Atom doesn't cache pending opener promises.
 */
async function createEditorForNuclide(uri: NuclideUri): Promise<TextEditor> {
  try {
    let buffer;
    try {
      buffer = await loadingNotification(
        loadBufferForUri(uri),
        `Opening \`${nuclideUri.nuclideUriToDisplayString(uri)}\`...`,
        1000 /* delay */,
      );
    } catch (err) {
      // Suppress ENOENT errors which occur if the file doesn't exist.
      // This is the same thing Atom does when opening a file (given a URI) that doesn't exist.
      if (err.code !== 'ENOENT') {
        throw err;
      }
      // If `loadBufferForURI` fails, then the buffer is removed from Atom's list of buffers.
      // `buffer.file` is marked as destroyed, making it useless. So we create
      // a new `buffer` and call `finishLoading` so that the `buffer` is marked
      // as `loaded` and the proper events are fired. The effect of all of this
      // is that files that don't exist remotely anymore are shown as empty
      // unsaved text editors.
      buffer = bufferForUri(uri);
      buffer.finishLoading();
    }
    // When in "large file mode", syntax highlighting and line wrapping are
    // disabled (among other things). This makes large files more usable.
    // Atom does this for local files.
    // https://github.com/atom/atom/blob/v1.9.8/src/workspace.coffee#L547
    const largeFileMode = buffer.getText().length > 2 * 1024 * 1024; // 2MB

    // In Atom 1.11.0, `buildTextEditor` will call `textEditorRegistry.maintainGrammar`
    // and `textEditorRegistry.maintainConfig` with the new editor. Since
    // `createEditorForNuclide` is called via `openURIInPane` -> `addOpener`,
    // that process will also call `maintainGrammar` and `maintainConfig`. This
    // results in `undefined` disposables created in `Workspace.subscribeToAddedItems`.
    // So when a pane is closed, the call to a non-existent `dispose` throws.
    if (typeof atom.textEditors.build === 'function') {
      // https://github.com/atom/atom/blob/v1.11.0-beta5/src/workspace.coffee#L564
      const editor = atom.textEditors.build({
        buffer,
        largeFileMode,
        autoHeight: false,
      });
      return editor;
    } else {
      const editor = atom.workspace.buildTextEditor({buffer, largeFileMode});
      if (!atom.textEditors.editors.has(editor)) {
        // https://github.com/atom/atom/blob/v1.9.8/src/workspace.coffee#L559-L562
        const disposable = atom.textEditors.add(editor);
        editor.onDidDestroy(() => {
          disposable.dispose();
        });
      }
      return editor;
    }
  } catch (err) {
    logger.warn('buffer load issue:', err);
    atom.notifications.addError(`Failed to open ${uri}: ${err.message}`);
    throw err;
  }
}

/**
 * Check if the remote buffer has already been initialized in editor.
 * This checks if the buffer is instance of NuclideTextBuffer.
 */
function isRemoteBufferInitialized(editor: TextEditor): boolean {
  const buffer = editor.getBuffer();
  if (buffer && buffer.constructor.name === 'NuclideTextBuffer') {
    return true;
  }
  return false;
}

async function reloadRemoteProjects(
  remoteProjects: Array<SerializableRemoteConnectionConfiguration>,
): Promise<void> {
  // This is intentionally serial.
  // The 90% use case is to have multiple remote projects for a single connection;
  // after the first one succeeds the rest should require no user action.
  const reloadedProjects: Array<string> = [];
  for (const config of remoteProjects) {
    invariant(remoteProjectsService);
    // eslint-disable-next-line no-await-in-loop
    const connection = await remoteProjectsService.createRemoteConnection(
      config,
    );
    if (!connection) {
      logger.info(
        'No RemoteConnection returned on restore state trial:',
        config.host,
        config.cwd,
      );

      // Atom restores remote files with a malformed URIs, which somewhat resemble local paths.
      // If after an unsuccessful connection user modifies and saves them he's presented
      // with a credential requesting dialog, as the file is attempted to be saved into
      // /nuclide:/<hostname> folder. If the user will approve the elevation and actually save
      // the file all kind of weird stuff happens (see t10842295) since the difference between the
      // remote and the valid local path becomes less aparent.
      // Anyway - these files better be closed.
      atom.workspace.getTextEditors().forEach(textEditor => {
        if (textEditor == null) {
          return;
        }

        const path = textEditor.getPath();
        if (path == null) {
          return;
        }

        if (path.startsWith(`nuclide:/${config.host}`)) {
          textEditor.destroy();
        }
      });
    } else {
      // It's fine the user connected to a different project on the same host:
      // we should still be able to restore this using the new connection.
      const {cwd, host, displayTitle} = config;
      if (
        connection.getPathForInitialWorkingDirectory() !== cwd &&
        connection.getRemoteHostname() === host
      ) {
        // eslint-disable-next-line no-await-in-loop
        const subConnection = await RemoteConnection.createConnectionBySavedConfig(
          host,
          cwd,
          displayTitle,
        );
        if (subConnection != null) {
          reloadedProjects.push(
            subConnection.getUriForInitialWorkingDirectory(),
          );
        }
      } else {
        reloadedProjects.push(connection.getUriForInitialWorkingDirectory());
      }
    }
  }
  if (remoteProjectsService != null) {
    remoteProjectsService._reloadFinished(reloadedProjects);
  }
}

function shutdownServersAndRestartNuclide(): void {
  atom.confirm({
    message: 'This will shutdown your Nuclide servers and restart Atom, ' +
      'discarding all unsaved changes. Continue?',
    buttons: {
      'Shutdown & Restart': async () => {
        try {
          await trackImmediate('nuclide-remote-projects:kill-and-restart');
        } finally {
          // This directly kills the servers without removing the RemoteConnections
          // so that restarting Nuclide preserves the existing workspace state.
          await ServerConnection.forceShutdownAllServers();
          atom.reload();
        }
      },
      Cancel: () => {},
    },
  });
}

export function activate(
  state: ?{remoteProjectsConfig: SerializableRemoteConnectionConfiguration[]},
): void {
  const subscriptions = new CompositeDisposable();

  controller = new RemoteProjectsController();
  remoteProjectsService = new RemoteProjectsServiceImpl();

  subscriptions.add(
    RemoteConnection.onDidAddRemoteConnection(connection => {
      subscriptions.add(addRemoteFolderToProject(connection));

      // On Atom restart, it tries to open uri paths as local `TextEditor` pane items.
      // Here, Nuclide reloads the remote project files that have empty text editors open.
      const config = connection.getConfig();
      const openInstances = getOpenFileEditorForRemoteProject(config);
      for (const openInstance of openInstances) {
        // Keep the original open editor item with a unique name until the remote buffer is loaded,
        // Then, we are ready to replace it with the remote tab in the same pane.
        const {pane, editor, uri, filePath} = openInstance;

        // Skip restoring the editer who has remote content loaded.
        if (isRemoteBufferInitialized(editor)) {
          continue;
        }

        // Atom ensures that each pane only has one item per unique URI.
        // Null out the existing pane item's URI so we can insert the new one
        // without closing the pane.
        editor.getURI = () => null;
        // Cleanup the old pane item on successful opening or when no connection could be
        // established.
        const cleanupBuffer = () => {
          pane.removeItem(editor);
          editor.destroy();
        };
        if (filePath === config.cwd) {
          cleanupBuffer();
        } else {
          // If we clean up the buffer before the `openUriInPane` finishes,
          // the pane will be closed, because it could have no other items.
          // So we must clean up after.
          atom.workspace
            .openURIInPane(uri, pane)
            .then(cleanupBuffer, cleanupBuffer);
        }
      }
    }),
  );

  subscriptions.add(
    atom.commands.add('atom-workspace', 'nuclide-remote-projects:connect', () =>
      openConnectionDialog(),
    ),
  );

  subscriptions.add(
    atom.commands.add(
      'atom-workspace',
      'nuclide-remote-projects:kill-and-restart',
      () => shutdownServersAndRestartNuclide(),
    ),
  );

  // Subscribe opener before restoring the remote projects.
  subscriptions.add(
    atom.workspace.addOpener((uri = '') => {
      if (uri.startsWith('nuclide:')) {
        const serverConnection = ServerConnection.getForUri(uri);
        if (serverConnection == null) {
          // It's possible that the URI opens before the remote connection has finished loading
          // (or the remote connection cannot be restored for some reason).
          //
          // In this case, we can just let Atom open a blank editor. Once the connection
          // is re-established, the `onDidAddRemoteConnection` logic above will restore the
          // editor contents as appropriate.
          return;
        }
        const connection = RemoteConnection.getForUri(uri);
        // On Atom restart, it tries to open the uri path as a file tab because it's not a local
        // directory. We can't let that create a file with the initial working directory path.
        if (
          connection != null &&
          uri === connection.getUriForInitialWorkingDirectory()
        ) {
          const blankEditor = atom.workspace.buildTextEditor({});
          // No matter what we do here, Atom is going to create a blank editor.
          // We don't want the user to see this, so destroy it as soon as possible.
          setImmediate(() => blankEditor.destroy());
          return blankEditor;
        }
        if (pendingFiles[uri]) {
          return pendingFiles[uri];
        }
        const textEditorPromise = (pendingFiles[uri] = createEditorForNuclide(
          uri,
        ));
        const removeFromCache = () => delete pendingFiles[uri];
        textEditorPromise.then(removeFromCache, removeFromCache);
        return textEditorPromise;
      }
    }),
  );

  subscriptions.add(patchAtomWorkspaceReplace());

  // If RemoteDirectoryProvider is called before this, and it failed
  // to provide a RemoteDirectory for a
  // given URI, Atom will create a generic Directory to wrap that. We want
  // to delete these instead, because those directories aren't valid/useful
  // if they are not true RemoteDirectory objects (connected to a real
  // real remote folder).
  deleteDummyRemoteRootDirectories();

  // Attempt to reload previously open projects.
  const remoteProjectsConfig = state && state.remoteProjectsConfig;
  reloadRemoteProjects(remoteProjectsConfig || []);
  packageSubscriptions = subscriptions;
}

export function consumeStatusBar(statusBar: atom$StatusBar): void {
  if (controller) {
    controller.consumeStatusBar(statusBar);
  }
}

// TODO: All of the elements of the array are non-null, but it does not seem possible to convince
// Flow of that.
export function serialize(): {
  remoteProjectsConfig: Array<?SerializableRemoteConnectionConfiguration>,
} {
  const remoteProjectsConfig: Array<?SerializableRemoteConnectionConfiguration> = getRemoteRootDirectories()
    .map(
      (
        directory: atom$Directory,
      ): ?SerializableRemoteConnectionConfiguration => {
        const connection = RemoteConnection.getForUri(directory.getPath());
        return connection
          ? createSerializableRemoteConnectionConfiguration(
              connection.getConfig(),
            )
          : null;
      },
    )
    .filter(
      (config: ?SerializableRemoteConnectionConfiguration) => config != null,
    );
  return {
    remoteProjectsConfig,
  };
}

export function deactivate(): void {
  if (packageSubscriptions) {
    packageSubscriptions.dispose();
    packageSubscriptions = null;
  }

  if (controller != null) {
    controller.destroy();
    controller = null;
  }

  if (remoteProjectsService != null) {
    remoteProjectsService.dispose();
    remoteProjectsService = null;
  }

  // Gracefully shutdown all server connections and leave servers running.
  const shutdown = false;
  ServerConnection.closeAll(shutdown);
}

export function createRemoteDirectoryProvider(): RemoteDirectoryProvider {
  return new RemoteDirectoryProvider();
}

export function createRemoteDirectorySearcher(): RemoteDirectorySearcher {
  return new RemoteDirectorySearcher((dir: RemoteDirectory) => {
    return getGrepServiceByNuclideUri(dir.getPath());
  });
}

export function getHomeFragments(): HomeFragments {
  return {
    feature: {
      title: 'Remote Connection',
      icon: 'cloud-upload',
      description: 'Connect to a remote server to edit files.',
      command: 'nuclide-remote-projects:connect',
    },
    priority: 8,
  };
}

export function provideRemoteProjectsService(): RemoteProjectsService {
  invariant(remoteProjectsService != null);
  return remoteProjectsService;
}

export function consumeNotifications(
  raiseNativeNotification: (
    title: string,
    body: string,
    timeout: number,
    raiseIfAtomHasFocus: boolean,
  ) => ?IDisposable,
): void {
  setNotificationService(raiseNativeNotification);
}
