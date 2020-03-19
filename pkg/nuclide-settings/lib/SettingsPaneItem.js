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

import UniversalDisposable from 'nuclide-commons/UniversalDisposable';
import featureConfig from 'nuclide-commons-atom/feature-config';
import observePaneItemVisibility from 'nuclide-commons-atom/observePaneItemVisibility';
import * as React from 'react';
import {Observable, Scheduler} from 'rxjs';
import SettingsCategory from './SettingsCategory';

import {AtomInput} from 'nuclide-commons-ui/AtomInput';
import {Section} from 'nuclide-commons-ui/Section';

export const WORKSPACE_VIEW_URI = 'atom://nuclide/settings';

type Props = {
  initialFilter?: string,
};

type State = {
  filter: string,
};

export default class SettingsPaneItem extends React.Component<Props, State> {
  _disposables: UniversalDisposable;
  _filterInput: ?AtomInput;

  constructor(props: Props) {
    super(props);

    this.state = {
      filter: props.initialFilter || '',
    };
  }

  _getConfigData(): Object {
    const configData = {};
    const nuclidePackages = atom.packages
      .getLoadedPackages()
      .filter(pkg => pkg.metadata && pkg.metadata.nuclide);

    // Config data is organized as a series of nested objects. First, by category
    // and then by packages in each category. Each package contains a title and an
    // object for each setting in that package. Each setting also contains an
    // onChange callback for components.
    //
    // ```
    // configData = {
    //   "Debugger": {
    //     "nuclide-debugger-php": {
    //       "title": "HHVM",
    //       "settings": {
    //         "idekeyRegex": {
    //           name: "idekeyRegex",
    //           value: false"",
    //           ...
    //         },
    //          ...
    //       }
    //     },
    //     ...
    //   },
    // }
    // ```
    nuclidePackages.forEach(pkg => {
      const pkgName = pkg.name;
      const {nuclide} = pkg.metadata;
      const config = pkg.metadata.atomConfig || nuclide.config;

      if (config && nuclide.configMetadata) {
        const {pathComponents} = nuclide.configMetadata;
        const categoryName = pathComponents[0];
        const packageTitle = pathComponents[1] || pkgName;

        // Group packages according to their category.
        let packages = configData[categoryName];
        if (packages == null) {
          packages = {};
          configData[categoryName] = packages;
        }

        // Create settingData for each setting.
        const settings = {};
        Object.keys(config).forEach(settingName => {
          const keyPath = pkgName + '.' + settingName;
          const schema = featureConfig.getSchema(keyPath);
          const title = getTitle(schema, settingName);
          const description = getDescription(schema);
          if (
            this.state == null ||
            matchesFilter(this.state.filter, categoryName) ||
            matchesFilter(this.state.filter, packageTitle) ||
            matchesFilter(this.state.filter, title) ||
            matchesFilter(this.state.filter, description) ||
            matchesFilter(this.state.filter, keyPath)
          ) {
            settings[settingName] = {
              name: settingName,
              description,
              keyPath,
              onChange: value => {
                this._handleComponentChange(keyPath, value);
              },
              order: getOrder(schema),
              schema,
              title,
              value: featureConfig.get(keyPath),
            };
          }
        });

        if (Object.keys(settings).length !== 0) {
          packages[pkgName] = {
            title: packageTitle,
            settings,
          };
        }
      }
    });
    return configData;
  }

  _handleComponentChange = (keyPath: string, value: any): void => {
    featureConfig.set(keyPath, value);
  };

  _getSettingsKeyPaths(): Array<string> {
    const keyPaths = [];
    const nuclidePackages = atom.packages
      .getLoadedPackages()
      .filter(pkg => pkg.metadata && pkg.metadata.nuclide);

    nuclidePackages.forEach(pkg => {
      const pkgName = pkg.name;
      const {nuclide} = pkg.metadata;
      const config = pkg.metadata.atomConfig || nuclide.config;

      if (config != null) {
        Object.keys(config).forEach(settingName =>
          keyPaths.push(pkgName + '.' + settingName),
        );
      }
    });

    return keyPaths;
  }

  componentDidMount(): void {
    const settingsKeyPaths = this._getSettingsKeyPaths();
    const changedSettings = settingsKeyPaths.map(keyPath =>
      featureConfig.observeAsStream(keyPath),
    );

    this._disposables = new UniversalDisposable(
      observePaneItemVisibility(this)
        .filter(Boolean)
        .delay(0, Scheduler.animationFrame)
        .subscribe(() => {
          if (this._filterInput != null) {
            this._filterInput.focus();
          }
        }),
      Observable.merge(...changedSettings)
        // throttle to prevent rerendering for each change if changes occur in
        // rapid succession
        .throttleTime(50)
        .subscribe(() => {
          this.setState(this._getConfigData());
        }),
    );
  }

  render(): React.Node {
    const elements = [];

    const configData = this._getConfigData();
    Object.keys(configData)
      .sort()
      .forEach(categoryName => {
        const packages = configData[categoryName];
        if (Object.keys(packages).length > 0) {
          elements.push(
            <SettingsCategory
              key={categoryName}
              name={categoryName}
              packages={packages}
            />,
          );
        }
      });
    const settings = elements.length === 0 ? null : elements;
    return (
      <div className="pane-item padded settings-gadgets-pane">
        <div className="settings-view panels panels-item">
          <div className="panels">
            <div className="panels-item">
              <section className="section">
                <Section headline="Filter" collapsable={true}>
                  <AtomInput
                    ref={component => {
                      this._filterInput = component;
                    }}
                    size="lg"
                    placeholderText="Filter by setting title or description"
                    initialValue={this.props.initialFilter}
                    onDidChange={this._onFilterTextChanged}
                  />
                </Section>
              </section>
              {settings}
            </div>
          </div>
        </div>
      </div>
    );
  }

  componentWillUnmount() {
    if (this._disposables != null) {
      this._disposables.dispose();
    }
  }

  _onFilterTextChanged = (filterText: string): void => {
    const filter = filterText != null ? filterText.trim() : '';
    this.setState({
      filter,
    });
  };

  getTitle(): string {
    return 'Nuclide Settings';
  }

  getIconName(): string {
    return 'tools';
  }

  getDefaultLocation(): string {
    return 'center';
  }

  getURI(): string {
    return WORKSPACE_VIEW_URI;
  }

  // Prevent the tab getting split.
  copy(): boolean {
    return false;
  }
}

function getOrder(schema: atom$ConfigSchema): number {
  // $FlowFixMe(>=0.68.0) Flow suppress (T27187857)
  return typeof schema.order === 'number' ? schema.order : 0;
}

function getTitle(schema: atom$ConfigSchema, settingName: string): string {
  let title = schema.title;
  // flowlint-next-line sketchy-null-string:off
  if (!title) {
    title = settingName
      .replace(/([A-Z])/g, ' $1')
      .replace(/^./, str => str.toUpperCase())
      .split('.')
      .join(' ');
  }
  return title;
}

function getDescription(schema: atom$ConfigSchema): string {
  return schema.description || '';
}

// Remove spaces and hyphens
function strip(str: string): string {
  return str.replace(/\s+/g, '').replace(/-+/g, '');
}

/** Returns true if filter matches search string. Return true if filter is empty. */
function matchesFilter(filter: string, searchString: string): boolean {
  if (filter.length === 0) {
    return true;
  }
  const needle = strip(filter.toLowerCase());
  const hay = strip(searchString.toLowerCase());
  return hay.indexOf(needle) !== -1;
}
