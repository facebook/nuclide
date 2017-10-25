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

import type {NuclideUri} from 'nuclide-commons/nuclideUri';
import type {StoreConfigData, NodeCheckedStatus} from './FileTreeStore';
import type {StatusCodeNumberValue} from '../../nuclide-hg-rpc/lib/HgService';

import nuclideUri from 'nuclide-commons/nuclideUri';
import FileTreeHelpers from './FileTreeHelpers';
import {StatusCodeNumber} from '../../nuclide-hg-rpc/lib/hg-constants';

/**
 * This is a support class for FileTreeNode.
 * Since the FileTreeNode is immutable, any update to it actually creates a new instance.
 * But some of its properties properties are derived from others. Calculating them anew
 * every time is computationally expensive. This class takes care of the memoization of
 * this process to keep the logic of the FileTreeNode clean from it.
 *
 * The class is initialized with the URIs of a node and its root. These properties do not
 * change over time. Currently at least, all derived properties are calculated from these URIs
 * and various objects contained in the FileTreeNode.conf, so in order to calculate current
 * values only the conf object is to be supplied.
 *
 * Each instance has a set of memoized getter functions. Each is responsible for calculation of a
 * single property. There are dependencies between some of the properties, so it's possible that
 * one memoized getter will call another.
 *
 * Each getter has a separate store instance which it is using for the memoization.
 * In this class' memoization strategy only the last value (and all its params, of course) are
 * stored.
 *
 */
export class MemoizedFieldsDeriver {
  _uri: NuclideUri;
  _rootUri: NuclideUri;

  // These properties do not depend on the conf instance and can be calculated right away.
  _isRoot: boolean;
  _name: string;
  _isContainer: boolean;
  _relativePath: NuclideUri;
  _localPath: NuclideUri;
  _splitPath: Array<string>;

  _getRepo: (conf: StoreConfigData) => ?atom$Repository;
  _getIsIgnored: (conf: StoreConfigData) => boolean;
  _getVcsStatusCode: (conf: StoreConfigData) => StatusCodeNumberValue;
  _getCheckedStatus: (conf: StoreConfigData) => NodeCheckedStatus;
  _getContainedInWorkingSet: (conf: StoreConfigData) => boolean;
  _getContainedInOpenFilesWorkingSet: (conf: StoreConfigData) => boolean;
  _getShouldBeShown: (conf: StoreConfigData) => boolean;
  _getShouldBeSoftened: (conf: StoreConfigData) => boolean;

  constructor(uri: NuclideUri, rootUri: NuclideUri) {
    this._uri = uri;
    this._rootUri = rootUri;

    this._isRoot = uri === rootUri;
    this._name = FileTreeHelpers.keyToName(uri);
    this._isContainer = FileTreeHelpers.isDirOrArchiveKey(uri);
    this._relativePath = nuclideUri.relative(rootUri, uri);
    this._localPath = FileTreeHelpers.keyToPath(
      nuclideUri.isRemote(uri) ? nuclideUri.parse(uri).path : uri,
    );
    this._splitPath = nuclideUri.split(uri);

    this._getRepo = memoize(this._repoGetter.bind(this));
    this._getVcsStatusCode = memoize(this._vcsStatusCodeGetter.bind(this));
    this._getIsIgnored = memoize(this._isIgnoredGetter.bind(this));
    this._getCheckedStatus = memoize(this._checkedStatusGetter.bind(this));
    this._getContainedInWorkingSet = memoize(
      this._containedInWorkingSetGetter.bind(this),
    );
    this._getContainedInOpenFilesWorkingSet = memoize(
      this._containedInOpenFilesWorkingSetGetter.bind(this),
    );
    this._getShouldBeShown = memoize(this._shouldBeShownGetter.bind(this));
    this._getShouldBeSoftened = memoize(
      this._shouldBeSoftenedGetter.bind(this),
    );
  }

  _repoGetter(conf: StoreConfigData, store: Object): ?atom$Repository {
    if (store.reposByRoot !== conf.reposByRoot) {
      store.reposByRoot = conf.reposByRoot;

      store.repo = store.reposByRoot[this._rootUri];
    }

    return store.repo;
  }

  _vcsStatusCodeGetter(
    conf: StoreConfigData,
    store: Object,
  ): StatusCodeNumberValue {
    if (store.vcsStatuses !== conf.vcsStatuses) {
      store.vcsStatuses = conf.vcsStatuses;

      const rootVcsStatuses = store.vcsStatuses.get(this._rootUri) || {};
      store.vcsStatusCode =
        rootVcsStatuses[this._uri] || StatusCodeNumber.CLEAN;
    }

    return store.vcsStatusCode;
  }

  _isIgnoredGetter(conf: StoreConfigData, store: Object): boolean {
    const repo = this._getRepo(conf);
    if (store.repo !== repo) {
      store.repo = repo;

      store.isIgnored =
        store.repo != null &&
        store.repo.isProjectAtRoot() &&
        store.repo.isPathIgnored(this._uri);
    }

    return store.isIgnored;
  }

  _checkedStatusGetter(
    conf: StoreConfigData,
    store: Object,
  ): NodeCheckedStatus {
    if (store.editedWorkingSet !== conf.editedWorkingSet) {
      store.editedWorkingSet = conf.editedWorkingSet;

      if (store.editedWorkingSet.isEmpty()) {
        store.checkedStatus = 'clear';
      } else {
        if (this._isContainer) {
          if (store.editedWorkingSet.containsFileBySplitPath(this._splitPath)) {
            store.checkedStatus = 'checked';
          } else if (
            store.editedWorkingSet.containsDirBySplitPath(this._splitPath)
          ) {
            store.checkedStatus = 'partial';
          } else {
            store.checkedStatus = 'clear';
          }
        } else {
          store.checkedStatus = store.editedWorkingSet.containsFileBySplitPath(
            this._splitPath,
          )
            ? 'checked'
            : 'clear';
        }
      }
    }

    return store.checkedStatus;
  }

  _containedInWorkingSetGetter(conf: StoreConfigData, store: Object): boolean {
    if (store.workingSet !== conf.workingSet) {
      store.workingSet = conf.workingSet;

      store.containedInWorkingSet = this._isContainer
        ? store.workingSet.containsDirBySplitPath(this._splitPath)
        : store.workingSet.containsFileBySplitPath(this._splitPath);
    }

    return store.containedInWorkingSet;
  }

  _containedInOpenFilesWorkingSetGetter(
    conf: StoreConfigData,
    store: Object,
  ): boolean {
    if (store.openFilesWorkingSet !== conf.openFilesWorkingSet) {
      store.openFilesWorkingSet = conf.openFilesWorkingSet;

      if (store.openFilesWorkingSet.isEmpty()) {
        store.containedInOpenFilesWorkingSet = false;
      } else {
        store.containedInOpenFilesWorkingSet = this._isContainer
          ? store.openFilesWorkingSet.containsDirBySplitPath(this._splitPath)
          : store.openFilesWorkingSet.containsFileBySplitPath(this._splitPath);
      }
    }

    return store.containedInOpenFilesWorkingSet;
  }

  _shouldBeShownGetter(conf: StoreConfigData, store: Object): boolean {
    const isIgnored = this._getIsIgnored(conf);
    const containedInWorkingSet = this._getContainedInWorkingSet(conf);
    const containedInOpenFilesWorkingSet = this._getContainedInOpenFilesWorkingSet(
      conf,
    );

    if (
      store.isIgnored !== isIgnored ||
      store.excludeVcsIgnoredPaths !== conf.excludeVcsIgnoredPaths ||
      store.hideIgnoredNames !== conf.hideIgnoredNames ||
      store.ignoredPatterns !== conf.ignoredPatterns ||
      store.isEditingWorkingSet !== conf.isEditingWorkingSet ||
      store.containedInWorkingSet !== containedInWorkingSet ||
      store.containedInOpenFilesWorkingSet !== containedInOpenFilesWorkingSet
    ) {
      store.isIgnored = isIgnored;
      store.excludeVcsIgnoredPaths = conf.excludeVcsIgnoredPaths;
      store.hideIgnoredNames = conf.hideIgnoredNames;
      store.ignoredPatterns = conf.ignoredPatterns;
      store.isEditingWorkingSet = conf.isEditingWorkingSet;
      store.containedInWorkingSet = containedInWorkingSet;
      store.containedInOpenFilesWorkingSet = containedInOpenFilesWorkingSet;

      if (store.isIgnored && store.excludeVcsIgnoredPaths) {
        store.shouldBeShown = false;
      } else if (
        store.hideIgnoredNames &&
        store.ignoredPatterns.some(p => p.match(this._uri))
      ) {
        store.shouldBeShown = false;
      } else if (store.isEditingWorkingSet) {
        store.shouldBeShown = true;
      } else {
        store.shouldBeShown =
          store.containedInWorkingSet || store.containedInOpenFilesWorkingSet;
      }
    }

    return store.shouldBeShown;
  }

  _shouldBeSoftenedGetter(conf: StoreConfigData, store: Object): boolean {
    const containedInWorkingSet = this._getContainedInWorkingSet(conf);
    const containedInOpenFilesWorkingSet = this._getContainedInOpenFilesWorkingSet(
      conf,
    );

    if (
      store.isEditingWorkingSet !== conf.isEditingWorkingSet ||
      store.containedInWorkingSet !== containedInWorkingSet ||
      store.containedInOpenFilesWorkingSet !== containedInOpenFilesWorkingSet
    ) {
      store.isEditingWorkingSet = conf.isEditingWorkingSet;
      store.containedInWorkingSet = containedInWorkingSet;
      store.containedInOpenFilesWorkingSet = containedInOpenFilesWorkingSet;

      if (store.isEditingWorkingSet) {
        store.shouldBeSoftened = false;
      } else {
        store.shouldBeSoftened =
          !store.containedInWorkingSet && store.containedInOpenFilesWorkingSet;
      }
    }

    return store.shouldBeSoftened;
  }

  buildDerivedFields(conf: StoreConfigData): Object {
    return {
      isRoot: this._isRoot,
      name: this._name,
      isContainer: this._isContainer,
      relativePath: this._relativePath,
      localPath: this._localPath,

      repo: this._getRepo(conf),
      vcsStatusCode: this._getVcsStatusCode(conf),
      isIgnored: this._getIsIgnored(conf),
      checkedStatus: this._getCheckedStatus(conf),
      shouldBeShown: this._getShouldBeShown(conf),
      shouldBeSoftened: this._getShouldBeSoftened(conf),
    };
  }
}

function memoize<T>(
  getter: (conf: StoreConfigData, store: Object) => T,
): (conf: StoreConfigData) => T {
  const store = {};

  return conf => getter(conf, store);
}
