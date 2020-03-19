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

import type {AndroidJavaProcess} from 'nuclide-adb/lib/types';
import type {NuclideUri} from 'nuclide-commons/nuclideUri';
import type {
  AutoGenProperty,
  AutoGenLaunchOrAttachConfig,
  AutoGenPropertyType,
  AutoGenPropertyPrimitiveType,
} from './types';
import * as React from 'react';

import idx from 'idx';
import nullthrows from 'nullthrows';
import {Checkbox} from 'nuclide-commons-ui/Checkbox';
import {Dropdown} from 'nuclide-commons-ui/Dropdown';
import {AtomInput} from 'nuclide-commons-ui/AtomInput';
import nuclideUri from 'nuclide-commons/nuclideUri';
import {capitalize, shellParseWithGlobs} from 'nuclide-commons/string';
import UniversalDisposable from 'nuclide-commons/UniversalDisposable';
import {getDebuggerService} from 'nuclide-commons-atom/debugger';
import {
  serializeDebuggerConfig,
  deserializeDebuggerConfig,
} from './DebuggerConfigSerializer';
import {DeviceAndPackage} from './DeviceAndPackage';
import {DeviceAndProcess} from './DeviceAndProcess';
import SelectableFilterableProcessTable from './SelectableFilterableProcessTable';
import {SourceSelector} from './SourceSelector';

type StringPair = [string, string];

type Props = {|
  +targetUri: NuclideUri,
  +configIsValidChanged: (valid: boolean) => void,
  +config: AutoGenLaunchOrAttachConfig,
  +debuggerTypeName: string,
  +pathResolver: (project: NuclideUri, filePath: string) => Promise<string>,
|};

type DeviceAndPackageType = {|
  +deviceSerial: string,
  +selectedPackage: string,
|};

type DeviceAndProcessType = {|
  +deviceSerial: string,
  +selectedProcess: AndroidJavaProcess,
|};

type State = {
  enumValues: Map<string, string>,
  booleanValues: Map<string, boolean>,
  atomInputValues: Map<string, string>,
  processTableValues: Map<string, number>,
  deviceAndPackageValues: Map<string, DeviceAndPackageType>,
  deviceAndProcessValues: Map<string, DeviceAndProcessType>,
  selectSourcesValues: Map<string, ?NuclideUri>,
};

// extension must be a string starting with a '.' like '.js' or '.py'
function getActiveScriptPath(extension: string): string {
  const center = atom.workspace.getCenter
    ? atom.workspace.getCenter()
    : atom.workspace;
  const activeEditor: ?atom$TextEditor = center.getActiveTextEditor();
  if (
    activeEditor == null ||
    !activeEditor.getPath() ||
    !nullthrows(activeEditor.getPath()).endsWith(extension)
  ) {
    return '';
  }
  return nuclideUri.getPath(nullthrows(activeEditor.getPath()));
}

export default class AutoGenLaunchAttachUiComponent extends React.Component<
  Props,
  State,
> {
  _disposables: UniversalDisposable;

  constructor(props: Props) {
    super(props);
    this._disposables = new UniversalDisposable();
    this.state = {
      atomInputValues: new Map(),
      booleanValues: new Map(),
      enumValues: new Map(),
      processTableValues: new Map(),
      deviceAndPackageValues: new Map(),
      deviceAndProcessValues: new Map(),
      selectSourcesValues: new Map(),
    };
  }

  _atomInputType(
    type: AutoGenPropertyType,
    itemType: ?AutoGenPropertyPrimitiveType,
  ): boolean {
    return (
      type === 'string' ||
      type === 'path' ||
      (type === 'array' && itemType === 'string') ||
      type === 'object' ||
      type === 'number' ||
      type === 'json'
    );
  }

  _getConfigurationProperties(): AutoGenProperty[] {
    const {config} = this.props;
    return config.properties;
  }

  _populateDefaultValues(
    config: AutoGenLaunchOrAttachConfig,
    atomInputValues: Map<string, string>,
    booleanValues: Map<string, boolean>,
    enumValues: Map<string, string>,
  ): void {
    const ignorePreviousParams =
      config.ignorePreviousParams !== undefined
        ? config.ignorePreviousParams
        : false;
    config.properties.filter(property => property.visible).map(property => {
      const {name, type} = property;
      const itemType = idx(property, _ => _.itemType);
      if (this._atomInputType(type, itemType)) {
        const existingValue = atomInputValues.get(name);
        if (
          (ignorePreviousParams || existingValue == null) &&
          typeof property.defaultValue !== 'undefined'
        ) {
          // String(propertyDescription.default) deals with both strings and numbers and arrays
          // JSON.stringify for JSON
          // empty string otherwise
          const defaultValue =
            type === 'string' || type === 'number' || type === 'array'
              ? String(property.defaultValue)
              : type === 'json'
                ? JSON.stringify(property.defaultValue)
                : '';
          atomInputValues.set(name, defaultValue);
        }
      } else if (type === 'boolean') {
        const existingValue = booleanValues.get(name);
        if (
          (ignorePreviousParams || existingValue == null) &&
          typeof property.defaultValue !== 'undefined' &&
          property.defaultValue != null &&
          typeof property.defaultValue === 'boolean'
        ) {
          booleanValues.set(name, property.defaultValue);
        } else {
          booleanValues.set(name, false);
        }
      } else if (type === 'enum' && property.enums != null) {
        const existingValue = enumValues.get(name);
        if (
          (ignorePreviousParams || existingValue == null) &&
          typeof property.defaultValue !== 'undefined' &&
          property.defaultValue != null &&
          typeof property.defaultValue === 'string'
        ) {
          enumValues.set(name, property.defaultValue);
        }
      }
    });
  }

  _getSerializationArgs(props: Props) {
    const {targetUri, config, debuggerTypeName} = props;
    const args = [
      nuclideUri.isRemote(targetUri)
        ? nuclideUri.getHostname(targetUri)
        : 'local',
      config.launch ? 'launch' : 'attach',
      debuggerTypeName,
    ];
    return args;
  }

  _deserializeDebuggerConfig(props: Props): void {
    deserializeDebuggerConfig(
      ...this._getSerializationArgs(props),
      (transientSettings, savedSettings) => {
        const {config} = props;
        const {
          cwdPropertyName,
          scriptPropertyName,
          launch,
          scriptExtension,
        } = config;
        const atomInputValues = new Map(savedSettings.atomInputValues || []);

        const scriptPath =
          (scriptPropertyName != null &&
            atomInputValues.get(scriptPropertyName)) ||
          (scriptExtension != null && getActiveScriptPath(scriptExtension)) ||
          '';
        if (cwdPropertyName != null) {
          const cwd =
            atomInputValues.get(cwdPropertyName) ||
            (scriptPath !== '' ? nuclideUri.dirname(scriptPath) : '');
          if (cwd !== '') {
            atomInputValues.set(cwdPropertyName, cwd);
          }
        }
        if (launch) {
          if (scriptPath !== '' && scriptPropertyName != null) {
            atomInputValues.set(scriptPropertyName, scriptPath);
          }
        }
        const booleanValues = new Map(savedSettings.booleanValues || []);
        const enumValues = new Map(savedSettings.enumValues || []);
        this._populateDefaultValues(
          config,
          atomInputValues,
          booleanValues,
          enumValues,
        );
        // do not serialize and deserialize these values:
        const processTableValues = new Map();
        const deviceAndPackageValues = new Map();
        const deviceAndProcessValues = new Map();

        this.setState({
          atomInputValues,
          booleanValues,
          enumValues,
          processTableValues,
          deviceAndPackageValues,
          deviceAndProcessValues,
        });
      },
    );
  }

  setState(newState: Object): void {
    super.setState(newState, () =>
      this.props.configIsValidChanged(this._debugButtonShouldEnable()),
    );
  }

  UNSAFE_componentWillReceiveProps(nextProps: Props) {
    if (nextProps.debuggerTypeName !== this.props.debuggerTypeName) {
      this._deserializeDebuggerConfig(nextProps);
    }
  }

  UNSAFE_componentWillMount(): void {
    this._deserializeDebuggerConfig(this.props);
  }

  componentDidMount(): void {
    this._disposables.add(
      atom.commands.add('atom-workspace', {
        'core:confirm': async () => {
          if (this._debugButtonShouldEnable()) {
            await this._handleDebugButtonClick();
          }
        },
      }),
    );
  }

  componentWillUnmount(): void {
    this._disposables.dispose();
  }

  _valueExists(property: AutoGenProperty): boolean {
    const {name, type} = property;
    if (
      type === 'string' ||
      type === 'path' ||
      (type === 'array' && property.itemType === 'string')
    ) {
      const value = this.state.atomInputValues.get(name);
      return value != null && value !== '';
    } else if (type === 'number') {
      const value = this.state.atomInputValues.get(name);
      return value != null && !isNaN(value);
    } else if (type === 'boolean') {
      const value = this.state.booleanValues.get(name);
      return value != null;
    } else if (type === 'enum') {
      const value = this.state.enumValues.get(name);
      return value != null;
    } else if (type === 'process') {
      const value = this.state.processTableValues.get(name);
      return value != null;
    } else if (type === 'deviceAndPackage') {
      const deviceAndPackageValue = this.state.deviceAndPackageValues.get(name);
      return deviceAndPackageValue != null;
    } else if (type === 'deviceAndProcess') {
      const deviceAndProcessValue = this.state.deviceAndProcessValues.get(name);
      return deviceAndProcessValue != null;
    } else if (type === 'selectSources') {
      const selectSourcesValue = this.state.selectSourcesValues.get(name);
      return selectSourcesValue != null;
    }
    return false;
  }

  _debugButtonShouldEnable(): boolean {
    return this._getConfigurationProperties()
      .filter(p => p.required)
      .every(p => this._valueExists(p));
  }

  _getComponentForProperty(property: AutoGenProperty): React.Node {
    const {name, type, description, required} = property;
    const formattedName =
      capitalize(name.replace(/([A-Z])/g, ' $1')) +
      (required ? ' (Required)' : '');
    const nameLabel = type === 'boolean' ? formattedName : formattedName + ':';
    const itemType = idx(property, _ => _.itemType);
    if (this._atomInputType(type, itemType)) {
      const value = this.state.atomInputValues.get(name) || '';
      return (
        <div>
          {nameLabel}
          <AtomInput
            key={this.props.debuggerTypeName + ':' + name}
            placeholderText={description}
            value={value}
            onDidChange={newValue => {
              this.state.atomInputValues.set(name, newValue);
              this.props.configIsValidChanged(this._debugButtonShouldEnable());
            }}
          />
        </div>
      );
    } else if (type === 'boolean') {
      const checked = this.state.booleanValues.get(name) || false;
      return (
        <div className="inline-block">
          <Checkbox
            checked={checked}
            label={nameLabel}
            title={description}
            onChange={newValue => {
              this.state.booleanValues.set(name, newValue);
              this.props.configIsValidChanged(this._debugButtonShouldEnable());
            }}
          />
        </div>
      );
    } else if (type === 'enum' && property.enums != null) {
      const enums = property.enums;
      const selectedValue = this.state.enumValues.get(name) || null;
      return (
        <div>
          {nameLabel}
          <div>
            <label>{description}</label>
          </div>
          <Dropdown
            options={enums.map(enumValue => ({
              value: enumValue,
              label: capitalize(enumValue.replace(/([A-Z])/g, ' $1')),
            }))}
            onChange={enumValue => {
              this.state.enumValues.set(name, enumValue);
              this.props.configIsValidChanged(this._debugButtonShouldEnable());
            }}
            value={selectedValue}
          />
        </div>
      );
    } else if (type === 'process') {
      return (
        <div>
          {nameLabel}
          <SelectableFilterableProcessTable
            targetUri={this.props.targetUri}
            onSelect={selectedProcess => {
              if (selectedProcess != null) {
                this.state.processTableValues.set(name, selectedProcess.pid);
              } else {
                this.state.processTableValues.delete(name);
              }
              this.props.configIsValidChanged(this._debugButtonShouldEnable());
            }}
          />
        </div>
      );
    } else if (type === 'deviceAndPackage') {
      return (
        <DeviceAndPackage
          targetUri={this.props.targetUri}
          deserialize={() => {
            let packageValuesArray: Array<StringPair> = [];
            deserializeDebuggerConfig(
              ...this._getSerializationArgs(this.props),
              (transientSettings, savedSettings) => {
                packageValuesArray =
                  (savedSettings.packageValues: Array<StringPair>) || [];
              },
            );
            const packageValues = new Map(packageValuesArray);
            return packageValues.get(name) || null;
          }}
          onSelect={(deviceSerial, javaPackage) => {
            if (deviceSerial != null) {
              this.state.deviceAndPackageValues.set(name, {
                deviceSerial,
                selectedPackage: javaPackage,
              });
            } else {
              this.state.deviceAndPackageValues.delete(name);
            }
            this.props.configIsValidChanged(this._debugButtonShouldEnable());
          }}
        />
      );
    } else if (type === 'deviceAndProcess') {
      return (
        <DeviceAndProcess
          targetUri={this.props.targetUri}
          deserialize={() => {
            let processValuesArray: Array<StringPair> = [];
            deserializeDebuggerConfig(
              ...this._getSerializationArgs(this.props),
              (transientSettings, savedSettings) => {
                processValuesArray =
                  (savedSettings.processValues: Array<StringPair>) || [];
              },
            );
            const processValues = new Map(processValuesArray);
            return processValues.get(name) || null;
          }}
          onSelect={(deviceSerial, javaProcess) => {
            if (deviceSerial != null && javaProcess != null) {
              this.state.deviceAndProcessValues.set(name, {
                deviceSerial,
                selectedProcess: javaProcess,
              });
            } else {
              this.state.deviceAndProcessValues.delete(name);
            }
            this.props.configIsValidChanged(this._debugButtonShouldEnable());
          }}
        />
      );
    } else if (type === 'selectSources') {
      return (
        <div>
          {nameLabel}
          <SourceSelector
            deserialize={() => {
              let selectSourcesValuesArray: Array<StringPair> = [];
              deserializeDebuggerConfig(
                ...this._getSerializationArgs(this.props),
                (transientSettings, savedSettings) => {
                  selectSourcesValuesArray =
                    (savedSettings.selectSourcesValues: Array<StringPair>) ||
                    [];
                },
              );
              const selectSourcesValues = new Map(selectSourcesValuesArray);
              return selectSourcesValues.get(name) || null;
            }}
            onSelect={selectedSource => {
              this.state.selectSourcesValues.set(name, selectedSource);
              this.props.configIsValidChanged(this._debugButtonShouldEnable());
            }}
          />
        </div>
      );
    }
    return (
      <div>
        <label>NO TRANSLATION YET FOR: {capitalize(name)}</label>
        <hr />
      </div>
    );
  }

  render(): React.Node {
    const {debuggerTypeName, config} = this.props;
    return (
      <div className="block">
        {config.header}
        {this._getConfigurationProperties()
          .filter(property => property.visible)
          .map(property => (
            <div key={debuggerTypeName + ':' + property.name}>
              {this._getComponentForProperty(property)}
            </div>
          ))}
      </div>
    );
  }

  _handleDebugButtonClick = async (): Promise<void> => {
    const {targetUri, config} = this.props;
    const {
      atomInputValues,
      booleanValues,
      enumValues,
      processTableValues,
      deviceAndPackageValues,
      deviceAndProcessValues,
      selectSourcesValues,
    } = this.state;
    const {launch, vsAdapterType, getProcessName} = config;

    const stringValues = new Map();
    const stringArrayValues = new Map();
    const objectValues = new Map();
    const numberValues = new Map();
    const jsonValues = new Map();
    await Promise.all(
      Array.from(
        this._getConfigurationProperties()
          .filter(
            property => property.visible && atomInputValues.has(property.name),
          )
          .map(async property => {
            const {name, type} = property;
            const itemType = idx(property, _ => _.itemType);
            const value = atomInputValues.get(name) || '';
            if (type === 'path') {
              try {
                const trimmedValue = value.trim();
                const resolvedPath =
                  this.props.pathResolver == null
                    ? trimmedValue
                    : await this.props.pathResolver(targetUri, trimmedValue);
                stringValues.set(name, resolvedPath);
              } catch (_) {
                stringValues.set(name, value);
              }
            } else if (type === 'string') {
              stringValues.set(name, value);
            } else if (type === 'array' && itemType === 'string') {
              stringArrayValues.set(name, shellParseWithGlobs(value));
            } else if (type === 'object') {
              const objectValue = {};
              shellParseWithGlobs(value).forEach(variable => {
                const [lhs, rhs] = variable.split('=');
                objectValue[lhs] = rhs;
              });
              objectValues.set(name, objectValue);
            } else if (type === 'number') {
              numberValues.set(name, Number(value));
            } else if (type === 'json') {
              jsonValues.set(name, JSON.parse(value));
            }

            return value;
          }),
      ),
    );

    const packageValues = new Map();
    this._getConfigurationProperties()
      .filter(
        property =>
          property.visible && deviceAndPackageValues.has(property.name),
      )
      .forEach(property => {
        const deviceAndPackage = deviceAndPackageValues.get(property.name);
        if (deviceAndPackage != null) {
          packageValues.set(property.name, deviceAndPackage.selectedPackage);
        }
      });

    const processValues = new Map();
    this._getConfigurationProperties()
      .filter(
        property =>
          property.visible && deviceAndProcessValues.has(property.name),
      )
      .forEach(property => {
        const deviceAndProcess = deviceAndProcessValues.get(property.name);
        const processName = idx(deviceAndProcess, _ => _.selectedProcess.name);
        if (deviceAndProcess != null && processName != null) {
          processValues.set(property.name, processName);
        }
      });

    const values = {};
    [
      booleanValues,
      enumValues,
      stringValues,
      stringArrayValues,
      objectValues,
      numberValues,
      processTableValues,
      jsonValues,
      deviceAndPackageValues,
      deviceAndProcessValues,
      selectSourcesValues,
    ].forEach(map => {
      map.forEach((value, key) => {
        values[key] = value;
      });
    });

    this._getConfigurationProperties()
      .filter(
        property => !property.visible && !atomInputValues.has(property.name),
      )
      .forEach(property => {
        const {name} = property;
        values[name] = idx(property, _ => _.defaultValue);
      });

    const debuggerService = await getDebuggerService();

    debuggerService.startVspDebugging({
      targetUri,
      debugMode: launch ? 'launch' : 'attach',
      adapterType: vsAdapterType,
      config: values,
      customControlButtons: [],
      processName: getProcessName(values),
      isRestartable: true,
    });

    serializeDebuggerConfig(...this._getSerializationArgs(this.props), {
      atomInputValues: Array.from(atomInputValues),
      booleanValues: Array.from(booleanValues),
      enumValues: Array.from(enumValues),
      packageValues: Array.from(packageValues),
      processValues: Array.from(processValues),
      selectSourcesValues: Array.from(selectSourcesValues),
    });
  };
}
