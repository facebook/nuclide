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

import {CompositeDisposable} from 'atom';
import featureConfig from 'nuclide-commons-atom/feature-config';
import React from 'react';
import SettingsCategory from './SettingsCategory';

import {AtomInput} from 'nuclide-commons-ui/AtomInput';
import {Section} from '../../nuclide-ui/Section';

import {matchesFilter} from './settings-utils';

export const WORKSPACE_VIEW_URI = 'atom://nuclide/settings';

export default class NuclideSettingsPaneItem extends React.Component {
  _disposables: CompositeDisposable;
  state: Object;

  constructor(props: Object) {
    super(props);

    this.state = {
      filter: '',
    };
  }

  _getConfigData(): Object {
    // Only need to add config listeners once.
    let disposables = null;
    if (!this._disposables) {
      this._disposables = disposables = new CompositeDisposable();
    }

    const configData = {};
    const nuclidePackages = atom.packages
      .getLoadedPackages()
      .filter(pkg => pkg.metadata && pkg.metadata.nuclide);

    // Config data is organized as a series of nested objects. First, by category
    // and then by packages in each category. Each package contains a title and an
    // object for each setting in that package. Each setting also contains an
    // onChange callback for components. We also listen for atom.config.onDidChange.
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
        const categoryMatches =
          this.state == null || matchesFilter(this.state.filter, categoryName);
        const packageMatches =
          this.state == null || matchesFilter(this.state.filter, packageTitle);

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
            categoryMatches ||
            packageMatches ||
            matchesFilter(this.state.filter, title) ||
            matchesFilter(this.state.filter, description)
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

          if (disposables) {
            const disposable = featureConfig.onDidChange(
              keyPath,
              this._handleConfigChange,
            );
            this._disposables.add(disposable);
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

  _handleConfigChange = (event: Object) => {
    // Workaround: Defer this._getConfigData() as it registers new config.onDidChange() callbacks
    // The issue is that Atom invokes these new callbacks for the current onDidChange event,
    // instead of only for *future* events.
    setTimeout(() => this.setState(this._getConfigData()));
  };

  _handleComponentChange = (keyPath: string, value: any): void => {
    featureConfig.set(keyPath, value);
  };

  render(): ?React.Element<any> {
    const elements = [];

    const configData = this._getConfigData();
    Object.keys(configData).sort().forEach(categoryName => {
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
                    size="lg"
                    placeholderText="Filter by setting title or description"
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
