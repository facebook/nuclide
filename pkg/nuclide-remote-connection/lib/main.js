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

import type {Directory as LocalDirectoryType} from 'atom';
import type {NuclideUri} from 'nuclide-commons/nuclideUri';

import nullthrows from 'nullthrows';

import {RemoteConnection} from './RemoteConnection';
import {RemoteDirectory} from './RemoteDirectory';
import {RemoteFile} from './RemoteFile';
import {ServerConnection} from './ServerConnection';
import {ConnectionCache} from './ConnectionCache';
import NuclideTextBuffer from './NuclideTextBuffer';

import {
  SshHandshake,
  decorateSshConnectionDelegateWithTracking,
} from './SshHandshake';

import {
  getService,
  getServiceByConnection,
  getServiceByNuclideUri,
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
  NuclideTextBuffer,
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
  saveBuffer,
} from './remote-text-buffer';

import typeof * as AdbService from '../../nuclide-adb-sdb-rpc/lib/AdbService';
import typeof * as ArcanistService from '../../nuclide-arcanist-rpc';
import typeof * as BuckService from '../../nuclide-buck-rpc';
import typeof * as ClangService from '../../nuclide-clang-rpc';
import typeof * as CtagsService from '../../nuclide-ctags-rpc';
import typeof * as DefinitionPreviewService
  from '../../nuclide-definition-preview-rpc';
import typeof * as FileSystemService
  from '../../nuclide-server/lib/services/FileSystemService';
import typeof * as FileWatcherService from '../../nuclide-filewatcher-rpc';
import typeof * as FlowService from '../../nuclide-flow-rpc';
import typeof * as FuzzyFileSearchService
  from '../../nuclide-fuzzy-file-search-rpc';
import typeof * as GrepService from '../../nuclide-grep-rpc';
import typeof * as HackService from '../../nuclide-hack-rpc';
import typeof * as HgService from '../../nuclide-hg-rpc/lib/HgService';
import typeof * as InfoService
  from '../../nuclide-server/lib/services/InfoService';
import typeof * as MerlinService
  from '../../nuclide-ocaml-rpc/lib/MerlinService';
import typeof * as NativeDebuggerService
  from '../../nuclide-debugger-native-rpc';
import typeof * as NodeDebuggerService from '../../nuclide-debugger-node-rpc';
import typeof * as OpenFilesService
  from '../../nuclide-open-files-rpc/lib/OpenFilesService';
import typeof * as PhpDebuggerService from '../../nuclide-debugger-php-rpc';
import typeof * as PythonService from '../../nuclide-python-rpc';
import typeof * as ReasonService
  from '../../nuclide-ocaml-rpc/lib/ReasonService';
import typeof * as RemoteCommandService from '../../nuclide-remote-atom-rpc';
import typeof * as SdbService from '../../nuclide-adb-sdb-rpc/lib/SdbService';
import typeof * as SourceControlService
  from '../../nuclide-server/lib/services/SourceControlService';

export function getAdbServiceByNuclideUri(uri: NuclideUri): AdbService {
  return nullthrows(getServiceByNuclideUri('AdbService', uri));
}

export function getArcanistServiceByNuclideUri(
  uri: NuclideUri,
): ArcanistService {
  return nullthrows(getServiceByNuclideUri('ArcanistService', uri));
}

export function getBuckServiceByNuclideUri(uri: NuclideUri): BuckService {
  return nullthrows(getServiceByNuclideUri('BuckService', uri));
}

export function getClangServiceByNuclideUri(uri: NuclideUri): ClangService {
  return nullthrows(getServiceByNuclideUri('ClangService', uri));
}

export function getCtagsServiceByNuclideUri(uri: NuclideUri): CtagsService {
  return nullthrows(getServiceByNuclideUri('CtagsService', uri));
}

export function getDefinitionPreviewServiceByNuclideUri(
  uri: NuclideUri,
): DefinitionPreviewService {
  return nullthrows(getServiceByNuclideUri('DefinitionPreviewService', uri));
}

export function getFileSystemServiceByNuclideUri(
  uri: NuclideUri,
): FileSystemService {
  return nullthrows(getServiceByNuclideUri('FileSystemService', uri));
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

export function getGrepServiceByNuclideUri(uri: NuclideUri): GrepService {
  return nullthrows(getServiceByNuclideUri('GrepService', uri));
}

export function getHackLanguageForUri(uri: NuclideUri): HackService {
  return nullthrows(getServiceByNuclideUri('HackService', uri));
}

export function getHgServiceByNuclideUri(uri: NuclideUri): HgService {
  return nullthrows(getServiceByNuclideUri('HgService', uri));
}

export function getInfoServiceByNuclideUri(uri: NuclideUri): InfoService {
  return nullthrows(getServiceByNuclideUri('InfoService', uri));
}

export function getMerlinServiceByNuclideUri(uri: NuclideUri): MerlinService {
  return nullthrows(getServiceByNuclideUri('MerlinService', uri));
}

export function getNativeDebuggerServiceByNuclideUri(
  uri: NuclideUri,
): NativeDebuggerService {
  return nullthrows(getServiceByNuclideUri('NativeDebuggerService', uri));
}

export function getNodeDebuggerServiceByNuclideUri(
  uri: NuclideUri,
): NodeDebuggerService {
  return nullthrows(getServiceByNuclideUri('NodeDebuggerService', uri));
}

export function getOpenFilesServiceByNuclideUri(
  uri: NuclideUri,
): OpenFilesService {
  return nullthrows(getServiceByNuclideUri('OpenFilesService', uri));
}

export function getPhpDebuggerServiceByNuclideUri(
  uri: NuclideUri,
): PhpDebuggerService {
  return nullthrows(getServiceByNuclideUri('PhpDebuggerService', uri));
}

export function getPythonServiceByNuclideUri(uri: NuclideUri): PythonService {
  return nullthrows(getServiceByNuclideUri('PythonService', uri));
}

export function getReasonServiceByNuclideUri(uri: NuclideUri): ReasonService {
  return nullthrows(getServiceByNuclideUri('ReasonService', uri));
}

export function getRemoteCommandServiceByNuclideUri(
  uri: NuclideUri,
): RemoteCommandService {
  return nullthrows(getServiceByNuclideUri('RemoteCommandService', uri));
}

export function getSdbServiceByNuclideUri(uri: NuclideUri): SdbService {
  return nullthrows(getServiceByNuclideUri('SdbService', uri));
}

export function getSourceControlServiceByNuclideUri(
  uri: NuclideUri,
): SourceControlService {
  return nullthrows(getServiceByNuclideUri('SourceControlService', uri));
}
