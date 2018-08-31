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

import type {TaskInfo} from '../../nuclide-buck/lib/types';
import type {
  AtomLanguageService,
  LanguageService,
} from '../../nuclide-language-service';

import assert from 'assert';
import {getLogger} from 'log4js';
import fsPromise from 'nuclide-commons/fsPromise';
import {
  getRustInputs,
  getSaveAnalysisTargets,
  normalizeNameForBuckQuery,
} from './BuckUtils';

import * as BuckService from '../../nuclide-buck-rpc';

const logger = getLogger('nuclide-rust');

export async function updateRlsBuildForTask(
  task: TaskInfo,
  service: AtomLanguageService<LanguageService>,
) {
  const buildTarget = normalizeNameForBuckQuery(task.buildTarget);

  // TODO: Filter by known Rust build targets
  const files = await getRustInputs(task.buckRoot, buildTarget);
  // Probably not a Rust build target, ignore
  if (files.length === 0) {
    return;
  }
  // We need only to pick a representative file to get a related lang service
  const fileUri = task.buckRoot + '/' + files[0];
  logger.debug(`fileUri: ${fileUri}`);

  const langService = await service.getLanguageServiceForUri(fileUri);
  assert(langService != null);

  // Since `buck` execution is not trivial - the command may be overriden, needs
  // to inherit the environment, passes internal FB USER to env etc. the RLS
  // can't just invoke that.
  // Instead, we build now, copy paths to resulting .json analysis artifacts to
  // a temp file and just use `cat $TMPFILE` as a dummy build command.
  const analysisTargets = await getSaveAnalysisTargets(
    task.buckRoot,
    buildTarget,
  );
  logger.debug(`analysisTargets: ${analysisTargets.join('\n')}`);
  const artifacts: Array<string> = [];

  const buildReport = await BuckService.build(task.buckRoot, analysisTargets);
  if (!buildReport.success) {
    atom.notifications.addError('[nuclide-rust] save-analysis build failed');
    return;
  }

  Object.values(buildReport.results)
    // TODO: https://buckbuild.com/command/build.html specifies that for
    // FETCHED_FROM_CACHE we might not get an output file - can we force it
    // somehow? Or we always locally produce a save-analysis .json file for
    // #save-analysis flavor?
    .forEach((targetReport: any) => artifacts.push(targetReport.output));

  const tempfile = await fsPromise.tempfile();
  await fsPromise.writeFile(tempfile, artifacts.join('\n'));

  // TODO: Windows?
  const buildCommand = `cat ${tempfile}`;

  logger.debug(`Built SA artifacts: ${artifacts.join('\n')}`);
  logger.debug(`buildCommand: ${buildCommand}`);

  await langService.sendLspNotification('workspace/didChangeConfiguration', {
    settings: {
      rust: {
        unstable_features: true, // Required for build_command
        build_on_save: true,
        build_command: buildCommand,
      },
    },
  });
}
