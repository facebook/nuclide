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

import featureConfig from 'nuclide-commons-atom/feature-config';
import {observableFromSubscribeFunction} from 'nuclide-commons/event';
import UniversalDisposable from 'nuclide-commons/UniversalDisposable';
import {Observable} from 'rxjs';

const LINTER_PACKAGE = 'linter';

function observePackageIsEnabled(): Observable<boolean> {
  return Observable.merge(
    Observable.of(atom.packages.isPackageActive(LINTER_PACKAGE)),
    observableFromSubscribeFunction(
      atom.packages.onDidActivatePackage.bind(atom.packages),
    )
      .filter(pkg => pkg.name === LINTER_PACKAGE)
      .mapTo(true),
    observableFromSubscribeFunction(
      atom.packages.onDidDeactivatePackage.bind(atom.packages),
    )
      .filter(pkg => pkg.name === LINTER_PACKAGE)
      .mapTo(false),
  );
}

function disableLinter(): void {
  atom.packages.disablePackage(LINTER_PACKAGE);
}

function disableDiagnostics(): void {
  featureConfig.set('use.atom-ide-diagnostics-ui', false);
}

export default function showAtomLinterWarning(): IDisposable {
  const packageName = featureConfig.getPackageName();
  return new UniversalDisposable(
    observePackageIsEnabled()
      .distinctUntilChanged()
      .switchMap(enabled => {
        if (!enabled) {
          return Observable.empty();
        }
        const notification = atom.notifications.addInfo('Choose a linter UI', {
          description:
            'You have both `linter` and `atom-ide-diagnostics` enabled, which will both ' +
            'display lint results for Linter-based packages.\n\n' +
            'To avoid duplicate results, please disable one of the packages.' +
            (packageName === 'nuclide'
              ? '\n\nNote that Flow and Hack errors are not compatible with `linter`.'
              : ''),
          dismissable: true,
          buttons: [
            {
              text: 'Disable Linter',
              onDidClick() {
                disableLinter();
              },
            },
            {
              text: 'Disable Diagnostics',
              onDidClick() {
                disableDiagnostics();
                atom.notifications.addInfo('Re-enabling Diagnostics', {
                  description:
                    'To re-enable diagnostics, please enable "Diagnostics" under the "Enabled Features" ' +
                    `section in \`${packageName}\` settings.`,
                });
              },
            },
          ],
        });
        return Observable.create(() => ({
          unsubscribe() {
            notification.dismiss();
          },
        }));
      })
      .subscribe(),
  );
}
