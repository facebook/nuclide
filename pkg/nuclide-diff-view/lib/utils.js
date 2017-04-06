/**
 * Copyright (c) 2015-present, Facebook, Inc.
 * All rights reserved.
 *
 * This source code is licensed under the license found in the LICENSE file in
 * the root directory of this source tree.
 *
 * @flow
 */

import type {DiffEntityOptions} from './DiffViewModel';
import type {FileChangeStatusValue} from '../../commons-atom/vcs';
import type {HgRepositoryClient} from '../../nuclide-hg-repository-client';
import type {NuclideUri} from '../../commons-node/nuclideUri';
import type {
  DiffModeType,
  DiffOptionType,
  HgDiffState,
} from './types';
import type {
  AmendModeValue,
  RevisionInfo,
} from '../../nuclide-hg-rpc/lib/HgService';
import type {Message} from '../../nuclide-console/lib/types';
import type {PhabricatorRevisionInfo} from '../../nuclide-arcanist-rpc/lib/utils';

import {
  DiffMode,
  DiffOption,
} from './constants';
import {
  getDirtyFileChanges,
  FileChangeStatus,
  FileChangeStatusToPrefix,
  HgStatusToFileChangeStatus,
} from '../../commons-atom/vcs';
import {getArcanistServiceByNuclideUri} from '../../nuclide-remote-connection';
import {getPhabricatorRevisionFromCommitMessage} from '../../nuclide-arcanist-rpc/lib/utils';
import {hgConstants} from '../../nuclide-hg-rpc';
import {bufferUntil} from '../../commons-node/observable';
import {getLogger} from '../../nuclide-logging';
import {Observable, Subject} from 'rxjs';
import {pipeProcessMessagesToConsole} from '../../commons-atom/streamProcessToConsoleMessages';
import stripAnsi from 'strip-ansi';
import {shell} from 'electron';
import url from 'url';

const MAX_DIALOG_FILE_STATUS_COUNT = 20;

export function processArcanistOutput(
  stream_: Observable<{stderr?: string, stdout?: string}>,
): Observable<Message> {
  let stream = stream_;
  stream = stream
    // Split stream into single lines.
    .flatMap((message: {stderr?: string, stdout?: string}) => {
      const lines = [];
      for (const fd of ['stderr', 'stdout']) {
        let out = message[fd];
        if (out != null) {
          out = out.replace(/\n$/, '');
          for (const line of out.split('\n')) {
            if (line.trim().length > 0) {
              lines.push({[fd]: line});
            }
          }
        }
      }
      return lines;
    })
    // Unpack JSON
    .flatMap((message: {stderr?: string, stdout?: string}) => {
      const stdout = message.stdout;
      const messages = [];
      if (stdout != null) {
        let decodedJSON = null;
        try {
          decodedJSON = JSON.parse(stdout);
        } catch (err) {
          messages.push({type: 'phutil:out', message: stdout + '\n'});
          getLogger().error('Invalid JSON encountered: ' + stdout);
        }
        if (decodedJSON != null) {
          messages.push(decodedJSON);
        }
      }
      if (message.stderr != null) {
        messages.push({type: 'phutil:err', message: message.stderr + '\n'});
      }
      return messages;
    })
    // Process message type.
    .flatMap((decodedJSON: {type: string, message: string}) => {
      const messages = [];
      switch (decodedJSON.type) {
        case 'phutil:out':
        case 'phutil:out:raw':
        case 'phutil:err':
          messages.push({level: 'log', text: stripAnsi(decodedJSON.message)});
          break;
        case 'error':
          messages.push({level: 'error', text: stripAnsi(decodedJSON.message)});
          break;
        default:
          getLogger().info(
            'Unhandled message type:',
            decodedJSON.type,
            'Message payload:',
            decodedJSON.message,
          );
          messages.push({level: 'log', text: stripAnsi(decodedJSON.message)});
          break;
      }
      return messages;
    })
    // Split messages on new line characters.
    .flatMap((message: {level: string, text: string}) => {
      const splitMessages = [];
      // Split on newlines without removing new line characters.  This will remove empty
      // strings but that's OK.
      for (const part of message.text.split(/^/m)) {
        splitMessages.push({level: message.level, text: part});
      }
      return splitMessages;
    });
  const levelStreams: Array<Observable<Array<{level: string, text: string}>>> = [];
  for (const level of ['log', 'error']) {
    const levelStream = stream
      .filter(
        (message: {level: string, text: string}) => message.level === level,
      )
      .share();
    levelStreams.push(bufferUntil(levelStream, message => message.text.endsWith('\n')));
  }

  return Observable.merge(...levelStreams)
    .map(messages => ({
      level: messages[0].level,
      text: messages.map(message => message.text).join(''),
    })).catch(error => {
      return Observable.throw(new Error('Check the console ouput for issues.'));
    });
}

export async function promptToCleanDirtyChanges(
  repository: HgRepositoryClient,
  commitMessage: ?string,
  shouldRebaseOnAmend: boolean,
  publishUpdates: Subject<Message>,
): Promise<?{allowUntracked: boolean, amended: boolean}> {
  const dirtyFileChanges = getDirtyFileChanges(repository);

  let shouldAmend = false;
  let amended = false;
  let allowUntracked = false;
  if (dirtyFileChanges.size === 0) {
    return {
      amended,
      allowUntracked,
    };
  }
  const untrackedChanges: Map<NuclideUri, FileChangeStatusValue> = new Map(
    Array.from(dirtyFileChanges.entries())
      .filter(fileChange => fileChange[1] === FileChangeStatus.UNTRACKED),
  );
  if (untrackedChanges.size > 0) {
    const untrackedChoice = atom.confirm({
      message: 'You have untracked files in your working copy:',
      detailedMessage: getFileStatusListMessage(untrackedChanges),
      buttons: ['Cancel', 'Add', 'Allow Untracked'],
    });
    getLogger().info('Untracked changes choice:', untrackedChoice);
    if (untrackedChoice === 0) /* Cancel */ {
      return null;
    } else if (untrackedChoice === 1) /* Add */ {
      await repository.addAll(Array.from(untrackedChanges.keys()));
      shouldAmend = true;
    } else if (untrackedChoice === 2) /* Allow Untracked */ {
      allowUntracked = true;
    }
  }
  const revertableChanges: Map<NuclideUri, FileChangeStatusValue> = new Map(
    Array.from(dirtyFileChanges.entries())
      .filter(fileChange => fileChange[1] !== FileChangeStatus.UNTRACKED),
  );
  if (revertableChanges.size > 0) {
    const cleanChoice = atom.confirm({
      message: 'You have uncommitted changes in your working copy:',
      detailedMessage: getFileStatusListMessage(revertableChanges),
      buttons: ['Cancel', 'Revert', 'Amend'],
    });
    getLogger().info('Dirty changes clean choice:', cleanChoice);
    if (cleanChoice === 0) /* Cancel */ {
      return null;
    } else if (cleanChoice === 1) /* Revert */ {
      const canRevertFilePaths: Array<NuclideUri> =
        Array.from(dirtyFileChanges.entries())
        .filter(fileChange => fileChange[1] !== FileChangeStatus.UNTRACKED)
        .map(fileChange => fileChange[0]);
      await repository.revert(canRevertFilePaths);
    } else if (cleanChoice === 2) /* Amend */ {
      shouldAmend = true;
    }
  }
  if (shouldAmend) {
    await amendWithErrorOnFailure(
      repository, commitMessage, getAmendMode(shouldRebaseOnAmend), publishUpdates,
    ).toPromise();
    amended = true;
  }
  return {
    amended,
    allowUntracked,
  };
}

function getFileStatusListMessage(fileChanges: Map<NuclideUri, FileChangeStatusValue>): string {
  let message = '';
  if (fileChanges.size < MAX_DIALOG_FILE_STATUS_COUNT) {
    for (const [filePath, statusCode] of fileChanges) {
      message += '\n'
        + FileChangeStatusToPrefix[statusCode]
        + atom.project.relativize(filePath);
    }
  } else {
    message = `\n more than ${MAX_DIALOG_FILE_STATUS_COUNT} files (check using \`hg status\`)`;
  }
  return message;
}

export function getHeadRevision(revisions: Array<RevisionInfo>): ?RevisionInfo {
  return revisions.find(revision => revision.isHead);
}

export function getHeadToForkBaseRevisions(revisions: Array<RevisionInfo>): Array<RevisionInfo> {
  // `headToForkBaseRevisions` should have the public commit at the fork base as the first.
  // and the rest of the current `HEAD` stack in order with the `HEAD` being last.
  const headRevision = getHeadRevision(revisions);
  if (headRevision == null) {
    return [];
  }
  const {CommitPhase} = hgConstants;
  const hashToRevisionInfo = new Map(revisions.map(revision => [revision.hash, revision]));
  const headToForkBaseRevisions = [];
  let parentRevision = headRevision;
  while (parentRevision != null && parentRevision.phase !== CommitPhase.PUBLIC) {
    headToForkBaseRevisions.unshift(parentRevision);
    parentRevision = hashToRevisionInfo.get(parentRevision.parents[0]);
  }
  if (parentRevision != null) {
    headToForkBaseRevisions.unshift(parentRevision);
  }
  return headToForkBaseRevisions;
}

export function getSelectedFileChanges(
  repository: HgRepositoryClient,
  diffOption: DiffOptionType,
  revisions: Array<RevisionInfo>,
  compareCommitId: ?number,
): Observable<Map<NuclideUri, FileChangeStatusValue>> {
  const dirtyFileChanges = getDirtyFileChanges(repository);

  if (diffOption === DiffOption.DIRTY ||
    (diffOption === DiffOption.COMPARE_COMMIT && compareCommitId == null)
  ) {
    return Observable.of(dirtyFileChanges);
  }
  const headToForkBaseRevisions = getHeadToForkBaseRevisions(revisions);
  if (headToForkBaseRevisions.length <= 1) {
    return Observable.of(dirtyFileChanges);
  }

  const beforeCommitId = diffOption === DiffOption.LAST_COMMIT
    ? headToForkBaseRevisions[headToForkBaseRevisions.length - 2].id
    : compareCommitId;

  if (beforeCommitId == null) {
    return Observable.throw(new Error('compareCommitId cannot be null!'));
  }
  if (headToForkBaseRevisions.find(rev => rev.id === beforeCommitId) == null) {
    return Observable.of(dirtyFileChanges);
  }
  return getSelectedFileChangesToCommit(
    repository,
    beforeCommitId,
  );
}

function getSelectedFileChangesToCommit(
  repository: HgRepositoryClient,
  beforeCommitId: number,
): Observable<Map<NuclideUri, FileChangeStatusValue>> {
  return repository.fetchFilesChangedSinceRevision(`${beforeCommitId}`)
    .map(fileStatusCodes => {
      const fileChanges = new Map();
      for (const [filePath, statusCode] of fileStatusCodes) {
        fileChanges.set(filePath, HgStatusToFileChangeStatus[statusCode]);
      }
      return fileChanges;
    })
    .catch(error => {
      // Cannot get status during transient states (rebase / commit),
      // because the `compareId` in hand could be hidden.
      return Observable.never();
    });
}

export function getHgDiff(
  repository: HgRepositoryClient,
  filePath: NuclideUri,
  headToForkBaseRevisions: Array<RevisionInfo>,
  diffOption: DiffOptionType,
  compareId: ?number,
): Observable<HgDiffState> {
  // When `compareCommitId` is null, the `HEAD` commit contents is compared
  // to the filesystem, otherwise it compares that commit to filesystem.
  const headCommit = getHeadRevision(headToForkBaseRevisions);
  if (headCommit == null) {
    return Observable.throw(new Error('Cannot fetch hg diff for revisions without head'));
  }
  const headCommitId = headCommit.id;
  let compareCommitId;
  switch (diffOption) {
    case DiffOption.DIRTY:
      compareCommitId = headCommitId;
      break;
    case DiffOption.LAST_COMMIT:
      compareCommitId = headToForkBaseRevisions.length > 1
        ? headToForkBaseRevisions[headToForkBaseRevisions.length - 2].id
        : headCommitId;
      break;
    case DiffOption.COMPARE_COMMIT:
      compareCommitId = compareId || headCommitId;
      break;
    default:
      return Observable.throw(new Error(`Invalid Diff Option: ${diffOption}`));
  }

  const revisionInfo = headToForkBaseRevisions.find(
    revision => revision.id === compareCommitId,
  );
  if (revisionInfo == null) {
    return Observable.throw(
      new Error(`Diff Viw Fetcher: revision with id ${compareCommitId} not found`),
    );
  }

  return repository.fetchFileContentAtRevision(filePath, `${compareCommitId}`)
    // If the file didn't exist on the previous revision,
    // Return the no such file at revision message.
    .catch(error => Observable.of(''))
    .map(committedContents => ({
      committedContents,
      revisionInfo,
    }));
}

export function formatFileDiffRevisionTitle(revisionInfo: RevisionInfo): string {
  const {hash, bookmarks} = revisionInfo;
  return `${hash}` + (bookmarks.length === 0 ? '' : ` - (${bookmarks.join(', ')})`);
}

export function getAmendMode(shouldRebaseOnAmend: boolean): AmendModeValue {
  if (shouldRebaseOnAmend) {
    return hgConstants.AmendMode.REBASE;
  } else {
    return hgConstants.AmendMode.CLEAN;
  }
}

export function getRevisionUpdateMessage(phabricatorRevision: PhabricatorRevisionInfo): string {
  return `

# Updating ${phabricatorRevision.name}
#
# Enter a brief description of the changes included in this update.
# The first line is used as subject, next lines as comment.`;
}

export function viewModeToDiffOption(viewMode: DiffModeType): DiffOptionType {
  switch (viewMode) {
    case DiffMode.COMMIT_MODE:
      return DiffOption.DIRTY;
    case DiffMode.PUBLISH_MODE:
      return DiffOption.LAST_COMMIT;
    case DiffMode.BROWSE_MODE:
      return DiffOption.COMPARE_COMMIT;
    default:
      getLogger().error(`Unrecognized diff view mode: ${viewMode}`);
      return DiffOption.DIRTY;
  }
}

function amendWithErrorOnFailure(
  repository: HgRepositoryClient,
  commitMessage: ?string,
  amendMode: AmendModeValue,
  publishUpdates: Subject<Message>,
): Observable<void> {
  return Observable.defer(() => {
    // Defer the update till amend flow start time.
    publishUpdates.next({text: 'Amending commit with your changes', level: 'info'});
    return Observable.empty();
  }).concat(repository.amend(commitMessage, hgConstants.AmendMode.CLEAN).flatMap(message => {
    // Side Effect: streaming progress to console.
    pipeProcessMessagesToConsole('Amend', publishUpdates, message);

    if (message.kind === 'exit' && message.exitCode !== 0) {
      return Observable.throw(new Error('Failed to amend commit - aborting publish!'));
    }
    return Observable.empty();
  }))
  .ignoreElements();
}

// TODO(most): Cleanup to avoid using `.do()` and have side effects:
// (notifications & publish updates).
export function createPhabricatorRevision(
  repository: HgRepositoryClient,
  publishUpdates: Subject<Message>,
  headCommitMessage: string,
  publishMessage: string,
  amended: boolean,
  isPrepareMode: boolean,
  lintExcuse: ?string,
): Observable<void> {
  const filePath = repository.getProjectDirectory();
  let amendStream = Observable.empty();
  if (!amended && publishMessage !== headCommitMessage) {
    getLogger().info('Amending commit with the updated message');
    // We intentionally amend in clean mode here, because creating the revision
    // amends the commit message (with the revision url), breaking the stack on top of it.
    // Consider prompting for `hg amend --fixup` after to rebase the stack when needed.
    amendStream = amendWithErrorOnFailure(
      repository, publishMessage, hgConstants.AmendMode.CLEAN, publishUpdates);
  }

  return Observable.concat(
    // Amend head, if needed.
    amendStream,
    // Create a new revision.
    Observable.defer(() => {
      const stream = getArcanistServiceByNuclideUri(filePath)
        .createPhabricatorRevision(filePath, isPrepareMode, lintExcuse)
        .refCount();

      return processArcanistOutput(stream)
        .startWith({level: 'info', text: 'Creating new revision...\n'})
        .switchMap(processErrorMessageAndThrow)
        .do(message => publishUpdates.next(message));
    }),

    Observable.defer(() =>
      Observable.fromPromise(repository.getHeadCommitMessage())
        .do(commitMessage => {
          const phabricatorRevision = getPhabricatorRevisionFromCommitMessage(commitMessage || '');
          if (phabricatorRevision != null) {
            notifyRevisionStatus(phabricatorRevision, 'created');
          }
        })),
  ).ignoreElements();
}

// TODO(most): Cleanup to avoid using `.do()` and have side effects:
// (notifications & publish updates).
export function updatePhabricatorRevision(
  repository: HgRepositoryClient,
  publishUpdates: Subject<Message>,
  headCommitMessage: string,
  publishMessage: string,
  allowUntracked: boolean,
  lintExcuse: ?string,
  verbatimModeEnabled: boolean,
): Observable<void> {
  const filePath = repository.getProjectDirectory();

  const phabricatorRevision = getPhabricatorRevisionFromCommitMessage(headCommitMessage);
  if (phabricatorRevision == null) {
    return Observable.throw(new Error('A phabricator revision must exist to update!'));
  }

  const updateTemplate = getRevisionUpdateMessage(phabricatorRevision).trim();
  const userUpdateMessage = publishMessage.replace(updateTemplate, '').trim();
  if (userUpdateMessage.length === 0) {
    return Observable.throw(new Error('Cannot update revision with empty message'));
  }

  const stream = getArcanistServiceByNuclideUri(filePath)
    .updatePhabricatorRevision(
      filePath,
      userUpdateMessage,
      allowUntracked,
      lintExcuse,
      verbatimModeEnabled,
    )
    .refCount();

  return processArcanistOutput(stream)
    .startWith({level: 'info', text: `Updating revision \`${phabricatorRevision.name}\`...\n`})
    .switchMap(processErrorMessageAndThrow)
    .do({
      next: message => publishUpdates.next(message),
      complete: () => notifyRevisionStatus(phabricatorRevision, 'updated'),
    }).ignoreElements();
}

function notifyRevisionStatus(
  phabRevision: ?PhabricatorRevisionInfo,
  statusMessage: string,
): void {
  let message = `Revision ${statusMessage}`;
  if (phabRevision == null) {
    atom.notifications.addSuccess(message, {nativeFriendly: true});
    return;
  }
  const {name, url: revisionUrl} = phabRevision;
  message = `Revision '${name}' ${statusMessage}`;
  atom.notifications.addSuccess(message, {
    buttons: [{
      className: 'icon icon-globe',
      onDidClick() { shell.openExternal(revisionUrl); },
      text: 'Open in Phabricator',
    }],
    nativeFriendly: true,
    dismissable: true,
  });
}

export function formatDiffViewUrl(diffEntityOptions_?: ?DiffEntityOptions): string {
  let diffEntityOptions = diffEntityOptions_;
  if (diffEntityOptions == null) {
    diffEntityOptions = {file: ''};
  }
  return url.format({
    protocol: 'atom',
    host: 'nuclide',
    pathname: 'diff-view',
    slashes: true,
    query: diffEntityOptions,
  });
}

function processErrorMessageAndThrow(message: Message): Observable<Message> {
  if (message.level === 'error') {
    return Observable.throw(new Error(message.text));
  }

  return Observable.of(message);
}
