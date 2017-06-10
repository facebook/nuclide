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

export type PhabricatorRevisionInfo = {
  url: string,
  id: number,
  name: string,
};

const DIFFERENTIAL_REVISION_REGEX = /^Differential Revision:\s*(\S+)/im;
const DIFFERENTIAL_ID_REGEX = /[dD]([1-9][0-9]{5,})/im;
const COMMIT_AUTHOR_REGEX = /.*<(.*)@.*>/im;

export function getPhabricatorRevisionFromCommitMessage(
  commitMessage: string,
): ?PhabricatorRevisionInfo {
  const match = DIFFERENTIAL_REVISION_REGEX.exec(commitMessage);
  if (match === null) {
    return null;
  }

  return getPhabricatorRevisionFromUrl(match[1]);
}

export function getPhabricatorRevisionFromUrl(
  diffUrl: string,
): ?PhabricatorRevisionInfo {
  const match = DIFFERENTIAL_ID_REGEX.exec(diffUrl);
  if (match === null) {
    return null;
  }

  return {
    url: diffUrl,
    id: parseInt(match[1], 10),
    name: `D${match[1]}`,
  };
}

export function getCommitAuthorFromAuthorEmail(author: string): ?string {
  const match = COMMIT_AUTHOR_REGEX.exec(author);
  if (match === null) {
    return null;
  } else {
    return match[1];
  }
}
