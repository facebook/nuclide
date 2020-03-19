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

import type {Feature} from '../FeatureLoader';
import type {
  ExperimentalPackageDefinition,
  PackageParams,
  Socket,
} from './types';

import idx from 'idx';
import UniversalDisposable from 'nuclide-commons/UniversalDisposable';
import path from 'path'; // eslint-disable-line nuclide-internal/prefer-nuclide-uri
import {AtomPackageRunner, ProcessPackageRunner} from './PackageRunners';
import MessageRouter from './MessageRouter';

type ExperimentalServiceTable = {
  [serviceName: string]: {
    [version: string]: {|
      client: string,
      rawConsumerConnections: Array<{|socket: Socket, config: Object|}>,
    |},
  },
};

export default function activateExperimentalPackages(
  features: Array<Feature>,
): IDisposable {
  const messageRouter = new MessageRouter();
  const experimentalFeatures = getExperimentalFeatures(features);
  const availableServices = aggregateExperimentalServices(experimentalFeatures);

  const packages = [];
  const disposables = new UniversalDisposable();

  const atomPackages = [];
  // TODO: split into multiple processes?
  const processPackages = [];

  experimentalFeatures.forEach(feature => {
    const experimentalSection: ExperimentalPackageDefinition = (feature.pkg: any)
      .experimental;
    const main = path.join(feature.path, experimentalSection.main);
    const pkgParams: PackageParams = {
      main,
      consumedServices: createObject(),
      providedServices: createObject(),
    };

    const consumedServicesRaw = experimentalSection.consumedServices;
    const providedServicesRaw = experimentalSection.providedServices;

    // Build a map of services consumed by this package.
    if (consumedServicesRaw != null) {
      Object.keys(consumedServicesRaw).forEach(key => {
        const {name, version, config} = consumedServicesRaw[key];
        const availableVersion = idx(availableServices, _ => _[name][version]);
        // TODO: Handle missing required services.
        if (availableVersion != null) {
          const [inSocket, outSocket] = messageRouter.getSocket();
          pkgParams.consumedServices[key] = {
            socket: inSocket,
            client: availableVersion.client,
          };
          availableVersion.rawConsumerConnections.push({
            socket: outSocket,
            config: config || {},
          });
        }
      });
    }

    // Build a map of services provided by this package.
    if (providedServicesRaw != null) {
      Object.keys(providedServicesRaw).forEach(key => {
        const {name, version} = providedServicesRaw[key];
        const availableVersion = idx(availableServices, _ => _[name][version]);
        // TODO: Handle missing required services.
        if (availableVersion != null) {
          pkgParams.providedServices[key] = {
            // NOTE: This only becomes complete after checking all packages.
            rawConnections: availableVersion.rawConsumerConnections,
          };
        }
      });
    }

    if (experimentalSection.runInAtom_UNSAFE) {
      atomPackages.push(pkgParams);
    } else {
      processPackages.push(pkgParams);
    }
  });

  if (atomPackages.length > 0) {
    packages.push(new AtomPackageRunner(atomPackages, messageRouter));
  }

  if (processPackages.length > 0) {
    packages.push(new ProcessPackageRunner(processPackages, messageRouter));
  }

  // Activate all the packages.
  packages.forEach(pkg => {
    disposables.add(
      pkg,
      pkg.onDidError(err => {
        atom.notifications.addError('Feature Process Crashed', {
          description: 'Please restart Atom to continue.',
          detail: String(err),
          buttons: [
            {
              className: 'icon icon-zap',
              text: 'Reload Atom',
              onDidClick() {
                atom.reload();
              },
            },
          ],
        });
      }),
    );
    pkg.activate();
  });

  return disposables;
}

function getExperimentalFeatures(features: Array<Feature>): Array<Feature> {
  return features.filter(
    // $FlowIgnore
    feature => idx(feature.pkg, _ => _.experimental.main) != null,
  );
}

function aggregateExperimentalServices(
  features: Array<Feature>,
): ExperimentalServiceTable {
  // Build a table of provided services.
  const table: ExperimentalServiceTable = createObject();
  features.forEach(feature => {
    const experimentalSection: ExperimentalPackageDefinition = (feature.pkg: any)
      .experimental;
    const {providedServices} = experimentalSection;
    if (providedServices != null) {
      Object.keys(providedServices).forEach(alias => {
        const {client, name, version} = providedServices[alias];
        const row = table[name] || (table[name] = {});
        const clientPath = path.join(feature.path, client);
        row[version] = {client: clientPath, rawConsumerConnections: []};
      });
    }
  });
  return table;
}

// An object that may safely be used as a map.
function createObject(): Object {
  return Object.create(null);
}
