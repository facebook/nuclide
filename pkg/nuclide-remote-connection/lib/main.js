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

import type {Directory as LocalDirectoryType} from 'atom';
import type {NuclideUri} from 'nuclide-commons/nuclideUri';
import type {BigDigClient} from 'big-dig/src/client';

import nullthrows from 'nullthrows';
import invariant from 'assert';

import {RemoteConnection} from './RemoteConnection';
import {RemoteDirectory} from './RemoteDirectory';
import {RemoteFile} from './RemoteFile';
import {ServerConnection} from './ServerConnection';
import {ConnectionCache} from './ConnectionCache';

import {
  SshHandshake,
  decorateSshConnectionDelegateWithTracking,
} from './SshHandshake';

import {
  getService,
  getServiceByConnection,
  getServiceByNuclideUri,
  awaitServiceByNuclideUri,
  getlocalService,
} from './service-manager';

export type Directory = LocalDirectoryType | RemoteDirectory;

export {
  RemoteConnection,
  RemoteDirectory,
  RemoteFile,
  ServerConnection,
  ConnectionCache,
  SshHandshake,
  decorateSshConnectionDelegateWithTracking,
  getService,
  getServiceByConnection,
  getServiceByNuclideUri,
  getlocalService,
};

export {
  bufferForUri,
  existingBufferForUri,
  loadBufferForUri,
} from './remote-text-buffer';

export {
  default as RemoteDirectoryPlaceholder,
} from './RemoteDirectoryPlaceholder';

import typeof * as BuckService from '../../nuclide-buck-rpc';
import typeof * as ClangService from '../../nuclide-clang-rpc';
import typeof * as CodeSearchService from '../../nuclide-code-search-rpc/lib/CodeSearchService';
import typeof * as CtagsService from '../../nuclide-ctags-rpc';
import typeof * as DefinitionPreviewService from '../../nuclide-definition-preview-rpc';
import typeof * as FbsimctlService from '../../nuclide-fbsimctl-rpc';
import typeof * as FileSystemService from '../../nuclide-server/lib/services/FileSystemService';
import typeof * as FileWatcherService from '../../nuclide-filewatcher-rpc';
import typeof * as FlowService from '../../nuclide-flow-rpc';
import typeof * as FuzzyFileSearchService from '../../nuclide-fuzzy-file-search-rpc';
import typeof * as GeneratedFileService from '../../nuclide-generated-files-rpc';
import typeof * as GrepService from '../../nuclide-grep-rpc';
import typeof * as HackService from '../../nuclide-hack-rpc';
import typeof * as HgService from '../../nuclide-hg-rpc/lib/HgService';
import typeof * as IdbService from '../../nuclide-idb-rpc';
import typeof * as InfoService from '../../nuclide-server/lib/services/InfoService';
import typeof * as MetroService from '../../nuclide-metro-rpc/lib/MetroService';
import typeof * as OpenFilesService from '../../nuclide-open-files-rpc/lib/OpenFilesService';
import typeof * as HhvmDebuggerService from '../../nuclide-debugger-hhvm-rpc';
import typeof * as PythonService from '../../nuclide-python-rpc';
import typeof * as RemoteCommandService from '../../nuclide-remote-atom-rpc';
import typeof * as SocketService from '../../nuclide-socket-rpc';
import typeof * as SourceControlService from '../../nuclide-server/lib/services/SourceControlService';
import typeof * as VSCodeLanguageService from '../../nuclide-vscode-language-service-rpc';
import typeof * as RsyncService from '../../nuclide-rsync-rpc';

export function getBigDigClientByNuclideUri(uri: NuclideUri): BigDigClient {
  const connection = ServerConnection.getForUri(uri);
  invariant(connection, `no server connection for ${uri}`);
  return connection.getBigDigClient();
}

export function getBuckServiceByNuclideUri(uri: NuclideUri): BuckService {
  return nullthrows(getServiceByNuclideUri('BuckService', uri));
}

export function getBuckServiceByConnection(
  connection: ?ServerConnection,
): BuckService {
  return nullthrows(getServiceByConnection('BuckService', connection));
}

export function getClangServiceByNuclideUri(uri: NuclideUri): ClangService {
  return nullthrows(getServiceByNuclideUri('ClangService', uri));
}

export function getCodeSearchServiceByNuclideUri(
  uri: NuclideUri,
): CodeSearchService {
  return nullthrows(getServiceByNuclideUri('CodeSearchService', uri));
}

export function getCtagsServiceByNuclideUri(uri: NuclideUri): CtagsService {
  return nullthrows(getServiceByNuclideUri('CtagsService', uri));
}

export function getDefinitionPreviewServiceByNuclideUri(
  uri: NuclideUri,
): DefinitionPreviewService {
  return nullthrows(getServiceByNuclideUri('DefinitionPreviewService', uri));
}

export function getFbsimctlServiceByNuclideUri(
  uri: NuclideUri,
): FbsimctlService {
  return nullthrows(getServiceByNuclideUri('FbsimctlService', uri));
}

export function getFileSystemServiceByNuclideUri(
  uri: NuclideUri,
): FileSystemService {
  return nullthrows(getServiceByNuclideUri('FileSystemService', uri));
}

export function getFileSystemServiceByConnection(
  connection: ?ServerConnection,
): FileSystemService {
  return nullthrows(getServiceByConnection('FileSystemService', connection));
}

export function getFileWatcherServiceByNuclideUri(
  uri: NuclideUri,
): FileWatcherService {
  return nullthrows(getServiceByNuclideUri('FileWatcherService', uri));
}

export function getFlowServiceByNuclideUri(uri: NuclideUri): FlowService {
  return nullthrows(getServiceByNuclideUri('FlowService', uri));
}

export function getFuzzyFileSearchServiceByNuclideUri(
  uri: NuclideUri,
): FuzzyFileSearchService {
  return nullthrows(getServiceByNuclideUri('FuzzyFileSearchService', uri));
}

export function awaitGeneratedFileServiceByNuclideUri(
  uri: NuclideUri,
): Promise<GeneratedFileService> {
  return awaitServiceByNuclideUri('GeneratedFileService', uri).then(nullthrows);
}

export function getGrepServiceByNuclideUri(uri: NuclideUri): GrepService {
  return nullthrows(getServiceByNuclideUri('GrepService', uri));
}

export function getHackLanguageForUri(uri: NuclideUri): HackService {
  return nullthrows(getServiceByNuclideUri('HackService', uri));
}

export function getHgServiceByNuclideUri(uri: NuclideUri): HgService {
  return nullthrows(getServiceByNuclideUri('HgService', uri));
}

export function getHhvmDebuggerServiceByNuclideUri(
  uri: NuclideUri,
): HhvmDebuggerService {
  return nullthrows(getServiceByNuclideUri('HhvmDebuggerService', uri));
}

export function getIdbServiceByNuclideUri(uri: NuclideUri): IdbService {
  return nullthrows(getServiceByNuclideUri('IdbService', uri));
}

export function getInfoServiceByNuclideUri(uri: NuclideUri): InfoService {
  return nullthrows(getServiceByNuclideUri('InfoService', uri));
}

export function getInfoServiceByConnection(
  connection: ?ServerConnection,
): InfoService {
  return getServiceByConnection('InfoService', connection);
}

export function getMetroServiceByNuclideUri(uri: NuclideUri): MetroService {
  return nullthrows(getServiceByNuclideUri('MetroService', uri));
}

export function getOpenFilesServiceByNuclideUri(
  uri: NuclideUri,
): OpenFilesService {
  return nullthrows(getServiceByNuclideUri('OpenFilesService', uri));
}

export function getPythonServiceByNuclideUri(uri: NuclideUri): PythonService {
  return nullthrows(getServiceByNuclideUri('PythonService', uri));
}

export function getPythonServiceByConnection(
  connection: ?ServerConnection,
): PythonService {
  return getServiceByConnection('PythonService', connection);
}

export function getRemoteCommandServiceByNuclideUri(
  uri: NuclideUri,
): RemoteCommandService {
  return nullthrows(getServiceByNuclideUri('RemoteCommandService', uri));
}

export function getSocketServiceByNuclideUri(uri: NuclideUri): SocketService {
  return nullthrows(getServiceByNuclideUri('SocketService', uri));
}

export function getSourceControlServiceByNuclideUri(
  uri: NuclideUri,
): SourceControlService {
  return nullthrows(getServiceByNuclideUri('SourceControlService', uri));
}

export function getVSCodeLanguageServiceByConnection(
  connection: ?ServerConnection,
): VSCodeLanguageService {
  return nullthrows(
    getServiceByConnection('VSCodeLanguageService', connection),
  );
}

export function getVSCodeLanguageServiceByNuclideUri(
  uri: NuclideUri,
): VSCodeLanguageService {
  return nullthrows(getServiceByNuclideUri('VSCodeLanguageService', uri));
}

export function getRsyncServiceByNuclideUri(uri: NuclideUri): RsyncService {
  return nullthrows(getServiceByNuclideUri('RsyncService', uri));
}
