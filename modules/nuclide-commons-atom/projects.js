/**
 * Copyright (c) 2017-present, Facebook, Inc.
 * All rights reserved.
 *
 * This source code is licensed under the BSD-style license found in the
 * LICENSE file in the root directory of this source tree. An additional grant
 * of patent rights can be found in the PATENTS file in the same directory.
 *
 * @flow
 * @format
 */

import type {NuclideUri} from 'nuclide-commons/nuclideUri';

import {File, Directory} from 'atom';
import {observableFromSubscribeFunction} from 'nuclide-commons/event';
import nuclideUri from 'nuclide-commons/nuclideUri';
import {diffSets} from 'nuclide-commons/observable';
import {Observable} from 'rxjs';

export function getValidProjectPaths(): Array<string> {
  return atom.project
    .getDirectories()
    .filter(directory => {
      // If a remote directory path is a local `Directory` instance, the project path
      // isn't yet ready for consumption.
      if (
        nuclideUri.isRemote(directory.getPath()) &&
        directory instanceof Directory
      ) {
        return false;
      }
      return true;
    })
    .map(directory => directory.getPath());
}

export function getAtomProjectRelativePath(path: NuclideUri): ?string {
  const [projectPath, relativePath] = atom.project.relativizePath(path);
  if (!projectPath) {
    return null;
  }
  return relativePath;
}

export function getAtomProjectRootPath(path: NuclideUri): ?string {
  const [projectPath] = atom.project.relativizePath(path);
  return projectPath;
}

/**
 * Like `atom.project.relativizePath`, except it returns the `Directory` rather than the path.
 * It also works for non-children, i.e. this can return `../../x`.
 *
 * This is intended to be used as a way to get a File object for any path
 * without worrying about remote vs. local paths.
 */
export function relativizePathWithDirectory(
  path: NuclideUri,
): [?Directory, NuclideUri] {
  for (const directory of atom.project.getDirectories()) {
    try {
      const relativePath = nuclideUri.relative(directory.getPath(), path);
      return [directory, relativePath];
    } catch (e) {
      // We have a remote-local mismatch or hostname mismatch.
    }
  }
  return [null, path];
}

export function getDirectoryForPath(path: NuclideUri): ?Directory {
  const [directory, relativePath] = relativizePathWithDirectory(path);
  if (directory == null) {
    return null;
  }
  return directory.getSubdirectory(relativePath);
}

export function getFileForPath(path: NuclideUri): ?File {
  const [directory, relativePath] = relativizePathWithDirectory(path);
  if (directory == null) {
    return null;
  }
  return directory.getFile(relativePath);
}

export function observeProjectPaths(
  callback: (projectPath: string, added: boolean) => any,
): IDisposable {
  getValidProjectPaths().forEach(existingPath => callback(existingPath, true));
  return onDidChangeProjectPath(callback);
}

export function observeProjectPathsAll(
  callback: (projectPaths: Array<string>) => any,
): IDisposable {
  let projectPaths = getValidProjectPaths();
  let changing = false;
  callback(projectPaths);
  return atom.project.onDidChangePaths(() => {
    if (changing) {
      throw new Error('Cannot update projects in the middle of an update');
    }
    changing = true;
    projectPaths = getValidProjectPaths();
    callback(projectPaths);
    changing = false;
  });
}

export function onDidChangeProjectPath(
  callback: (projectPath: string, added: boolean) => void,
): IDisposable {
  let projectPaths = getValidProjectPaths();
  let changing = false;
  return observeProjectPathsAll(newProjectPaths => {
    if (changing) {
      throw new Error('Cannot update projects in the middle of an update');
    }
    changing = true;
    // Check to see if the change was the addition of a project.
    for (const newProjectPath of newProjectPaths) {
      if (!projectPaths.includes(newProjectPath)) {
        callback(newProjectPath, true);
      }
    }
    // Check to see if the change was the deletion of a project.
    for (const projectPath of projectPaths) {
      if (!newProjectPaths.includes(projectPath)) {
        callback(projectPath, false);
      }
    }
    changing = false;
    projectPaths = newProjectPaths;
  });
}

export function onDidAddProjectPath(
  callback: (projectPath: string) => void,
): IDisposable {
  return onDidChangeProjectPath((projectPath, added) => {
    if (added) {
      callback(projectPath);
    }
  });
}

export function onDidRemoveProjectPath(
  callback: (projectPath: string) => void,
): IDisposable {
  return onDidChangeProjectPath((projectPath, added) => {
    if (!added) {
      callback(projectPath);
    }
  });
}

function observeHostnames() {
  return (atom.packages.initialPackagesActivated
    ? Observable.of(null)
    : observableFromSubscribeFunction(
        atom.packages.onDidActivateInitialPackages.bind(atom.packages),
      )
  ).switchMap(() =>
    observableFromSubscribeFunction(
      atom.project.onDidChangePaths.bind(atom.project),
    )
      .startWith(null)
      .map(
        () =>
          new Set(
            atom.project
              .getPaths()
              .filter(nuclideUri.isRemote)
              .map(nuclideUri.getHostname),
          ),
      )
      .let(diffSets()),
  );
}

export function observeRemovedHostnames(): Observable<string> {
  return observeHostnames().flatMap(diff => Observable.from(diff.removed));
}

export function observeAddedHostnames(): Observable<string> {
  return observeHostnames().flatMap(diff => Observable.from(diff.added));
}
