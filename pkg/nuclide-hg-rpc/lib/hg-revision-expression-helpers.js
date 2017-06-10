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

import type {RevisionInfo, RevisionSuccessorInfo} from './HgService';
import type {ConnectableObservable} from 'rxjs';

import {hgAsyncExecute, hgRunCommand} from './hg-utils';
import {HEAD_REVISION_EXPRESSION, SuccessorType} from './hg-constants';
import {getLogger} from 'log4js';
import invariant from 'assert';
import {Observable} from 'rxjs';

/**
 * This file contains utilities for getting an expression to specify a certain
 * revision in Hg (i.e. something that can be passed to the '--rev' option of
 * an Hg command).
 * Note: "Head" in this set of helper functions refers to the "current working
 * directory parent" in Hg terms.
 */

// Exported for testing.
export const INFO_REV_END_MARK = '<<NUCLIDE_REV_END_MARK>>';
export const NULL_CHAR = '\0';
const ESCAPED_NULL_CHAR = '\\0';

// We use `{p1node|short} {p2node|short}` instead of `{parents}`
// because `{parents}` only prints when a node has more than one parent,
// not when a node has one natural parent.
// Reference: `hg help templates`
const NO_NODE_HASH = '000000000000';
const HEAD_MARKER = '@';

const REVISION_INFO_TEMPLATE = `{rev}
{desc|firstline}
{author}
{date|isodate}
{node|short}
{branch}
{phase}
{bookmarks % '{bookmark}${ESCAPED_NULL_CHAR}'}
{remotenames % '{remotename}${ESCAPED_NULL_CHAR}'}
{tags % '{tag}${ESCAPED_NULL_CHAR}'}
{p1node|short}${ESCAPED_NULL_CHAR}{p2node|short}${ESCAPED_NULL_CHAR}
{ifcontains(rev, revset('.'), '${HEAD_MARKER}')}
{singlepublicsuccessor}
{amendsuccessors}
{rebasesuccessors}
{splitsuccessors}
{foldsuccessors}
{histeditsuccessors}
{desc}
${INFO_REV_END_MARK}
`;

const SUCCESSOR_TEMPLATE_ORDER = [
  SuccessorType.PUBLIC,
  SuccessorType.AMEND,
  SuccessorType.REBASE,
  SuccessorType.SPLIT,
  SuccessorType.FOLD,
  SuccessorType.HISTEDIT,
];

/**
 * @param revisionExpression An expression that can be passed to hg as an argument
 * to the '--rev' option.
 * @param numberOfRevsBefore The number of revisions before the current revision
 * that you want a revision expression for. Passing 0 here will simply return 'revisionExpression'.
 * @return An expression for the 'numberOfRevsBefore'th revision before the given revision.
 */
function expressionForRevisionsBefore(
  revisionExpression: string,
  numberOfRevsBefore: number,
): string {
  if (numberOfRevsBefore === 0) {
    return revisionExpression;
  } else {
    return revisionExpression + '~' + numberOfRevsBefore.toString();
  }
}

export function expressionForRevisionsBeforeHead(
  numberOfRevsBefore_: number,
): string {
  let numberOfRevsBefore = numberOfRevsBefore_;
  if (numberOfRevsBefore < 0) {
    numberOfRevsBefore = 0;
  }
  return expressionForRevisionsBefore(
    HEAD_REVISION_EXPRESSION,
    numberOfRevsBefore,
  );
}

// Section: Revision Sets

export function expressionForCommonAncestor(revision: string): string {
  const commonAncestorExpression = `ancestor(${revision}, ${HEAD_REVISION_EXPRESSION})`;
  // shell-escape does not wrap ancestorExpression in quotes without this toString conversion.
  return commonAncestorExpression.toString();
}

/**
 * @param revision The revision expression of a revision of interest.
 * @param workingDirectory The working directory of the Hg repository.
 * @return An expression for the common ancestor of the revision of interest and
 * the current Hg head.
 */
export async function fetchCommonAncestorOfHeadAndRevision(
  revision: string,
  workingDirectory: string,
): Promise<string> {
  const ancestorExpression = expressionForCommonAncestor(revision);
  // shell-escape does not wrap '{rev}' in quotes unless it is double-quoted.
  const args = [
    'log',
    '--template',
    '{rev}',
    '--rev',
    ancestorExpression,
    '--limit',
    '1',
  ];
  const options = {
    cwd: workingDirectory,
  };

  try {
    const {stdout: ancestorRevisionNumber} = await hgAsyncExecute(
      args,
      options,
    );
    return ancestorRevisionNumber;
  } catch (e) {
    getLogger('nuclide-hg-rpc').warn(
      'Failed to get hg common ancestor: ',
      e.stderr,
      e.command,
    );
    throw new Error(
      'Could not fetch common ancestor of head and revision: ' + revision,
    );
  }
}

export function fetchRevisionsInfo(
  revisionExpression: string,
  workingDirectory: string,
  options?: {
    shouldLimit?: boolean,
    hidden?: boolean,
  },
): Observable<Array<RevisionInfo>> {
  const revisionLogArgs = [
    'log',
    '--template',
    REVISION_INFO_TEMPLATE,
    '--rev',
    revisionExpression,
  ];
  if (options == null || options.shouldLimit == null || options.shouldLimit) {
    revisionLogArgs.push('--limit', '20');
  }

  // --hidden prevents mercurial from loading the obsstore, which can be expensive.
  if (options && options.hidden === true) {
    revisionLogArgs.push('--hidden');
  }

  const hgOptions = {
    cwd: workingDirectory,
  };
  return hgRunCommand(revisionLogArgs, hgOptions)
    .map(stdout => parseRevisionInfoOutput(stdout))
    .catch(e => {
      getLogger('nuclide-hg-rpc').warn(
        'Failed to get revision info for revisions' +
          ` ${revisionExpression}: ${e.stderr || e}, ${e.command}`,
      );
      throw new Error(
        `Could not fetch revision info for revisions: ${revisionExpression}`,
      );
    });
}

/**
 * @param revisionFrom The revision expression of the "start" (older) revision.
 * @param revisionTo The revision expression of the "end" (newer) revision.
 * @param workingDirectory The working directory of the Hg repository.
 * @return An array of revision info between revisionFrom and
 *   revisionTo, plus revisionFrom and revisionTo;
 * "Between" means that revisionFrom is an ancestor of, and
 *   revisionTo is a descendant of.
 * For each RevisionInfo, the `bookmarks` field will contain the list
 * of bookmark names applied to that revision.
 */
export function fetchRevisionInfoBetweenRevisions(
  revisionFrom: string,
  revisionTo: string,
  workingDirectory: string,
): Promise<Array<RevisionInfo>> {
  const revisionExpression = `${revisionFrom}::${revisionTo}`;
  return fetchRevisionsInfo(revisionExpression, workingDirectory).toPromise();
}

export async function fetchRevisionInfo(
  revisionExpression: string,
  workingDirectory: string,
): Promise<RevisionInfo> {
  const [revisionInfo] = await fetchRevisionsInfo(
    revisionExpression,
    workingDirectory,
  ).toPromise();
  return revisionInfo;
}

export function fetchSmartlogRevisions(
  workingDirectory: string,
): ConnectableObservable<Array<RevisionInfo>> {
  // This will get the `smartlog()` expression revisions
  // and the head revision commits to the nearest public commit parent.
  const revisionExpression = 'smartlog(all) + parents(smartlog(all))';
  return fetchRevisionsInfo(revisionExpression, workingDirectory, {
    shouldLimit: false,
  }).publish();
}

/**
 * Helper function to `fetchRevisionInfoBetweenRevisions`.
 */
export function parseRevisionInfoOutput(
  revisionsInfoOutput: string,
): Array<RevisionInfo> {
  const revisions = revisionsInfoOutput.split(INFO_REV_END_MARK);
  const revisionInfo = [];
  for (const chunk of revisions) {
    const revisionLines = chunk.trim().split('\n');
    if (revisionLines.length < 18) {
      continue;
    }
    const successorInfo = parseSuccessorData(revisionLines.slice(12, 18));
    revisionInfo.push({
      id: parseInt(revisionLines[0], 10),
      title: revisionLines[1],
      author: revisionLines[2],
      date: new Date(revisionLines[3]),
      hash: revisionLines[4],
      branch: revisionLines[5],
      // Phase is either `public`, `draft` or `secret`.
      // https://www.mercurial-scm.org/wiki/Phases
      phase: (revisionLines[6]: any),
      bookmarks: splitLine(revisionLines[7]),
      remoteBookmarks: splitLine(revisionLines[8]),
      tags: splitLine(revisionLines[9]),
      parents: splitLine(revisionLines[10]).filter(
        hash => hash !== NO_NODE_HASH,
      ),
      isHead: revisionLines[11] === HEAD_MARKER,
      successorInfo,
      description: revisionLines.slice(18).join('\n'),
    });
  }
  return revisionInfo;
}

function parseSuccessorData(
  successorLines: Array<string>,
): ?RevisionSuccessorInfo {
  invariant(successorLines.length === SUCCESSOR_TEMPLATE_ORDER.length);
  for (let i = 0; i < SUCCESSOR_TEMPLATE_ORDER.length; i++) {
    if (successorLines[i].length > 0) {
      return {
        hash: successorLines[i],
        type: SUCCESSOR_TEMPLATE_ORDER[i],
      };
    }
  }
  return null;
}

function splitLine(line: string): Array<string> {
  return line.split(NULL_CHAR).filter(e => e.length > 0);
}
