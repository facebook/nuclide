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

// TODO: Make it possible to move or split a pane with a VcsLogPaneItem.

import type FileTreeContextMenu
  from '../../nuclide-file-tree/lib/FileTreeContextMenu';
import type {
  HgRepositoryClient,
} from '../../nuclide-hg-repository-client/lib/HgRepositoryClient.js';

import {CompositeDisposable, Disposable} from 'atom';
import featureConfig from 'nuclide-commons-atom/feature-config';
import VcsLogComponent from './VcsLogComponent';
import VcsLogGadget from './VcsLogGadget';
import {Observable, BehaviorSubject} from 'rxjs';
import invariant from 'assert';
import {getAtomProjectRelativePath} from 'nuclide-commons-atom/projects';
import {bindObservableAsProps} from 'nuclide-commons-ui/bindObservableAsProps';
import {maybeToString} from 'nuclide-commons/string';
import querystring from 'querystring';
import {repositoryForPath} from '../../nuclide-vcs-base';
import {shortNameForAuthor as shortNameForAuthorFn} from './util';
import {track} from '../../nuclide-analytics';
import url from 'url';
import React from 'react';
import {
  viewableFromReactElement,
} from '../../commons-atom/viewableFromReactElement';

const SHOW_LOG_FILE_TREE_CONTEXT_MENU_PRIORITY = 500;
const NUM_LOG_RESULTS = 100;

const CONTEXT_MENU_LABEL = 'Show history';
const VCS_LOG_URI_PREFIX = 'atom://nucide-vcs-log/view';
const VCS_LOG_URI_PATHS_QUERY_PARAM = 'path';

class Activation {
  _subscriptions: CompositeDisposable;

  constructor() {
    this._subscriptions = new CompositeDisposable();
    this._registerOpener();
  }

  _registerOpener() {
    this._subscriptions.add(
      atom.workspace.addOpener((uriToOpen: string) => {
        if (!uriToOpen.startsWith(VCS_LOG_URI_PREFIX)) {
          return;
        }

        const {query} = url.parse(uriToOpen, /* parseQueryString */ true);
        invariant(query);

        // Make sure a non-zero number of paths have been specified.
        const path = query[VCS_LOG_URI_PATHS_QUERY_PARAM];
        const component = createLogPaneForPath(path);
        return component ? viewableFromReactElement(component) : null;
      }),
    );

    // TODO(mbolin): Once the nuclide-file-tree.context-menu is generalized to automatically add
    // menu items to the editor context menu, as appropriate, it should be possible to eliminate
    // (or at least reduce) the logic here.

    this._subscriptions.add(
      atom.commands.add(
        'atom-text-editor',
        'nuclide-vcs-log:show-log-for-active-editor',
        () => {
          const uri = getActiveTextEditorURI();
          if (uri != null) {
            openLogPaneForURI(uri);
            track('nuclide-vcs-log:open-from-text-editor');
          }
        },
      ),
      atom.contextMenu.add({
        'atom-text-editor': [
          {
            label: 'Source Control',
            submenu: [
              {
                label: CONTEXT_MENU_LABEL,
                command: 'nuclide-vcs-log:show-log-for-active-editor',
                shouldDisplay(): boolean {
                  const uri = getActiveTextEditorURI();
                  return getRepositoryWithLogMethodForPath(uri) != null;
                },
              },
            ],
          },
        ],
      }),
    );
  }

  addItemsToFileTreeContextMenu(contextMenu: FileTreeContextMenu): IDisposable {
    const contextDisposable = contextMenu.addItemToSourceControlMenu(
      {
        label: CONTEXT_MENU_LABEL,
        callback() {
          const node = contextMenu.getSingleSelectedNode();
          if (node == null) {
            return;
          }

          const {uri} = node;
          const repository = getRepositoryWithLogMethodForPath(uri);
          if (repository == null) {
            return;
          }

          openLogPaneForURI(uri);
          track('nuclide-vcs-log:open-from-file-tree');
        },
        shouldDisplay(): boolean {
          const node = contextMenu.getSingleSelectedNode();
          if (node == null) {
            return false;
          }

          return getRepositoryWithLogMethodForPath(node.uri) != null;
        },
      },
      SHOW_LOG_FILE_TREE_CONTEXT_MENU_PRIORITY,
    );

    this._subscriptions.add(contextDisposable);

    // We don't need to dispose of the contextDisposable when the provider is disabled -
    // it needs to be handled by the provider itself. We only should remove it from the list
    // of the disposables we maintain.
    return new Disposable(() => this._subscriptions.remove(contextDisposable));
  }

  dispose() {
    this._subscriptions.dispose();
  }
}

function getRepositoryWithLogMethodForPath(path: ?string): ?HgRepositoryClient {
  if (path == null) {
    return null;
  }

  const repository = repositoryForPath(path);
  // For now, we only expect HgRepository to work. We should also find a way to
  // make this work for Git.
  if (repository != null && repository.getType() === 'hg') {
    return ((repository: any): HgRepositoryClient);
  } else {
    return null;
  }
}

function getActiveTextEditorURI(): ?string {
  const editor = atom.workspace.getActiveTextEditor();
  if (editor == null) {
    return null;
  }

  const filePath = editor.getPath();
  if (filePath == null) {
    return null;
  }

  return filePath;
}

function openLogPaneForURI(uri: string) {
  track('nuclide-vcs-log:open');
  const openerURI =
    VCS_LOG_URI_PREFIX +
    '?' +
    querystring.stringify({
      [VCS_LOG_URI_PATHS_QUERY_PARAM]: uri,
    });
  // Not a file URI
  // eslint-disable-next-line nuclide-internal/atom-apis
  atom.workspace.open(openerURI);
}

function createLogPaneForPath(path: string): ?React.Element<any> {
  if (path == null) {
    return null;
  }

  const repository = getRepositoryWithLogMethodForPath(path);
  if (repository == null) {
    return null;
  }

  const {showDifferentialRevision} = (featureConfig.get(
    'nuclide-vcs-log',
  ): any);
  invariant(typeof showDifferentialRevision === 'boolean');

  const title = `${repository.getType()} log ${maybeToString(getAtomProjectRelativePath(path))}`;

  const currentDiff = new BehaviorSubject({
    oldId: null,
    newId: null,
  });
  const onDiffClick = (oldId: ?string, newId: ?string) => {
    currentDiff.next({
      oldId: null,
      newId: null,
    });
    currentDiff.next({
      oldId,
      newId,
    });
  };

  const contentLoader = currentDiff.switchMap(ids => {
    const {oldId, newId} = ids;
    if (oldId == null || newId == null) {
      return Observable.of({oldContent: null, newContent: null});
    }
    return Observable.forkJoin(
      oldId !== ''
        ? repository.fetchFileContentAtRevision(path, oldId)
        : Observable.of(''),
      newId !== ''
        ? repository.fetchFileContentAtRevision(path, newId)
        : Observable.of(''),
    )
      .startWith([null, null])
      .map(([oldContent, newContent]) => ({oldContent, newContent}));
  });

  const props = Observable.combineLatest(
    Observable.fromPromise(repository.log([path], NUM_LOG_RESULTS))
      .map(log => log.entries)
      .startWith(null),
    contentLoader,
  ).map(([logEntries, content]) => {
    return {
      files: [path],
      showDifferentialRevision,
      repository,
      onDiffClick,
      logEntries,
      oldContent: content.oldContent,
      newContent: content.newContent,
    };
  });

  const component = bindObservableAsProps(props, VcsLogComponent);
  return <VcsLogGadget iconName="repo" title={title} component={component} />;
}

let activation: ?Activation;

export function activate(state: ?Object): void {
  if (activation == null) {
    activation = new Activation();
  }
}

export function deactivate() {
  if (activation != null) {
    activation.dispose();
    activation = null;
  }
}

export function addItemsToFileTreeContextMenu(
  contextMenu: FileTreeContextMenu,
): IDisposable {
  invariant(activation);
  return activation.addItemsToFileTreeContextMenu(contextMenu);
}

export const shortNameForAuthor = shortNameForAuthorFn;
