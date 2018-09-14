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

import {getLogger} from 'log4js';
import fsPromise from 'nuclide-commons/fsPromise';
import {
  getRustInputs,
  getSaveAnalysisTargets,
  normalizeNameForBuckQuery,
  getRustBuildFile,
} from './BuckUtils';

import * as BuckService from '../../nuclide-buck-rpc';

const logger = getLogger('nuclide-rust');

export async function updateRlsBuildForTask(
  task: TaskInfo,
  service: AtomLanguageService<LanguageService>,
) {
  const buildTarget = normalizeNameForBuckQuery(task.buildTarget);

  // Output is relative to Buck root but the built target may be managed by a
  // Buck cell (nested Buck root).
  // Here, Buck returns input paths relative to the possible cell, but the build
  // file always relative to the current Buck root. Because of that, we use the
  // build file path to determine the possible Buck cell root to which the
  // inputs are relative to.
  // FIXME: This is a bug in Buck, only query for files when the output is fixed.
  const [buildFile, files] = await Promise.all([
    getRustBuildFile(task.buckRoot, buildTarget),
    getRustInputs(task.buckRoot, buildTarget),
  ]);
  // Not a Rust build target, ignore
  if (buildFile == null || files.length === 0) {
    return;
  }
  const buckRoot = await BuckService.getRootForPath(buildFile);
  if (buckRoot == null) {
    logger.error(`Couldn't find Buck root for ${buildFile}`);
    return;
  }

  logger.debug(`Detected Buck root: ${buckRoot}`);
  // We need only to pick a representative file to get a related lang service
  const fileUri = buckRoot + '/' + files[0];

  const langService = await service.getLanguageServiceForUri(fileUri);
  if (langService == null) {
    atom.notifications.addError(`[nuclide-rust] couldn't find language service
      for target ${buildTarget}`);
    return;
  }

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

  const buildReport = await BuckService.build(task.buckRoot, analysisTargets);
  if (!buildReport.success) {
    atom.notifications.addError('[nuclide-rust] save-analysis build failed');
    return;
  }

  const artifacts: Array<string> = [];
  Object.values(buildReport.results)
    // TODO: https://buckbuild.com/command/build.html specifies that for
    // FETCHED_FROM_CACHE we might not get an output file - can we force it
    // somehow? Or we always locally produce a save-analysis .json file for
    // #save-analysis flavor?
    .forEach((targetReport: any) =>
      artifacts.push(`${buckRoot}/${targetReport.output}`),
    );

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
