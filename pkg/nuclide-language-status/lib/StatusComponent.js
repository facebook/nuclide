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

import type {StatusData} from '../../nuclide-language-service/lib/LanguageService';
import type {LanguageStatusProvider, StatusKind} from './types';

import marked from 'marked';
import classnames from 'classnames';
import {Observable, BehaviorSubject} from 'rxjs';
import UniversalDisposable from 'nuclide-commons/UniversalDisposable';
import {Icon} from 'nuclide-commons-ui/Icon';
import * as React from 'react';
import SettingsTooltip from './SettingsTooltip';
import StatusTooltip from './StatusTooltip';

export type ServerStatus = {
  provider: LanguageStatusProvider,
  data: StatusData,
};

type Props = {
  serverStatuses: Array<ServerStatus>, // all providers relevant to this editor, plus their data
  settings: Map<string, StatusKind>,
  onUpdateSettings: (newSettings: Map<string, StatusKind>) => void,
  editor: atom$TextEditor,
};

type State = {
  hoveredProviderName: ?string,
};

const SETTINGS_NAME: string = 'settings';
const kindPriorities: Array<StatusKind> = ['red', 'yellow', 'green'];

export default class StatusComponent extends React.Component<Props, State> {
  _tooltipRefs: Map<string, HTMLElement> = new Map();
  // Used to debounce hover state changes.
  _hoveredProviderName: BehaviorSubject<?string> = new BehaviorSubject(null);
  _disposables: UniversalDisposable = new UniversalDisposable();
  // A projection from serverStatuses that retains identity unless providers change
  _providersCache: Array<LanguageStatusProvider> = [];

  state: State = {
    hoveredProviderName: null,
  };

  constructor() {
    super();
    // $FlowFixMe: debounce() is not in flow types for rxjs
    const hoveredProviderNameDebounced = this._hoveredProviderName.debounce(
      hoveredProviderName => {
        // No debounce when hovering on to, 250ms debounce when hovering off of
        return Observable.empty().delay(hoveredProviderName != null ? 0 : 250);
      },
    );
    this._disposables.add(
      hoveredProviderNameDebounced.subscribe(hoveredProviderName => {
        this.setState({hoveredProviderName});
      }),
    );
  }

  componentWillUnmount() {
    this._disposables.dispose();
  }

  render(): React.Node {
    const {settings} = this.props;
    const statuses = this.props.serverStatuses
      .filter(status => {
        // For a status to be potentially visible, (1) the user has to have set its
        // preference to be shown (always/on-progress/on-errors), and (2) the status
        // provider must have reported a non-null status.data.kind.
        const settingKind = settings.get(status.provider.name);
        return (
          settingKind != null &&
          settingKind !== 'null' &&
          status.data.kind !== 'null'
        );
      })
      .map(status => {
        // A status tab will be either "visible" (because of a combination
        // of the user's preference plus the current status.data.kind) or just
        // "contingently-visible" (i.e. visible only when you hover)
        // There's no extra value in showing the tab when things are working
        // so visible === false whenever status.data.kind === 'green'.
        const kind = settings.get(status.provider.name);
        const visible =
          status.data.kind !== 'green' &&
          kindPriorities.indexOf(kind) >=
            kindPriorities.indexOf(status.data.kind);
        return [status, visible];
      })
      .sort(([a, aVisible], [b, bVisible]) => {
        // We'll sort the contingently-visible ones all to the left and the visible
        // ones to the right. That way there won't be any gaps amongst visible ones.
        // And within that, we'll sort by priority.
        if (aVisible !== bVisible) {
          return aVisible ? 1 : -1;
        } else if (a.provider.priority !== b.provider.priority) {
          return a.provider.priority - b.provider.priority;
        } else {
          return a.provider.name.localeCompare(b.provider.name);
        }
      });
    return (
      <div className="nuclide-language-status-container">
        {this._renderBar(statuses)}
        <div className="nuclide-language-status-providers-container">
          {this._renderSettings()}
          {statuses.map(([status, visible]) =>
            this._renderProvider(
              status,
              visible,
              this.state.hoveredProviderName != null,
            ),
          )}
        </div>
      </div>
    );
  }

  _renderSettings(): React.Node {
    // Update _providersCache only if the set of providers has changed.
    // This is so the content of the settings tooltip only re-renders if
    // absolutely needed.
    const newCache = this.props.serverStatuses.map(({provider, _}) => provider);
    const newCacheValue = newCache.map(p => p.name).join(',');
    const oldCacheValue = this._providersCache.map(p => p.name).join(',');
    if (newCacheValue !== oldCacheValue) {
      this._providersCache = newCache;
    }

    return this.props.serverStatuses.length === 0 ? null : (
      <div
        className="nuclide-language-status-provider nuclide-language-status-provider-settings"
        data-name={SETTINGS_NAME}
        key={SETTINGS_NAME}
        onMouseOver={this._onMouseOver}
        onMouseOut={this._onMouseOut}
        style={{opacity: this.state.hoveredProviderName != null ? 1 : 0}}
        ref={this._setTooltipRef}>
        <Icon className="nuclide-language-status-icon" icon="gear" />
        {this.state.hoveredProviderName !== SETTINGS_NAME ? null : (
          <SettingsTooltip
            onUpdateSettings={this.props.onUpdateSettings}
            parentRef={this._tooltipRefs.get('settings')}
            providers={this._providersCache}
            settings={this.props.settings}
          />
        )}
      </div>
    );
  }

  _renderBar = (statuses: Array<[ServerStatus, boolean]>): React.Node => {
    const {settings} = this.props;
    const kind: ?StatusKind = statuses
      .filter(([status, _]) => {
        // Don't show the success bar for servers unless the setting is
        // 'Show Always'.
        const setting = settings.get(status.provider.name);
        return !(setting !== 'green' && status.data.kind === 'green');
      })
      .map(([s, _]) => s.data.kind)
      .sort(
        (k1, k2) => kindPriorities.indexOf(k1) - kindPriorities.indexOf(k2),
      )[0];
    return (
      <div
        className={classnames('nuclide-language-status-bar', {
          'nuclide-language-status-bar-green': kind === 'green',
          'nuclide-language-status-bar-yellow': kind === 'yellow',
          'nuclide-language-status-bar-red': kind === 'red',
        })}
      />
    );
  };

  _renderProvider = (
    status: ServerStatus,
    visible: boolean,
    hovered: boolean,
  ): React.Node => {
    const {provider, data} = status;

    const icon = this._renderIcon(provider);
    const progress = this._renderProgress(data);

    return (
      <div
        className={classnames(
          'nuclide-language-status-provider',
          'nuclide-language-status-provider-' + data.kind,
          {
            // CSS class with transitions to apply visual debounce on the
            // provider tab to help reduce flicker, but still feel responsive
            // on hover.
            'nuclide-language-status-provider-debounce': !hovered,
          },
        )}
        onMouseOver={this._onMouseOver}
        onMouseOut={this._onMouseOut}
        data-name={status.provider.name}
        key={status.provider.name}
        style={{opacity: visible || hovered ? 1 : 0}}
        ref={this._setTooltipRef}>
        {icon}
        {progress}
        {this.state.hoveredProviderName !== provider.name ? null : (
          <StatusTooltip
            parentRef={this._tooltipRefs.get(status.provider.name)}
            status={status}
            editor={this.props.editor}
          />
        )}
      </div>
    );
  };

  _renderIcon(provider: LanguageStatusProvider): React.Node {
    const {icon, iconMarkdown, name} = provider;
    if (icon != null) {
      return <Icon className="nuclide-language-status-icon" icon={icon} />;
    }
    const renderer = new marked.Renderer();
    // Plain text in the icon markdown should render inline not in a paragraph,
    // so use a custom renderer for this.
    renderer.paragraph = (s: string) =>
      `<div style="display:inline">${s} </div>`;
    if (iconMarkdown != null) {
      return (
        <div
          className="nuclide-language-status-icon"
          dangerouslySetInnerHTML={{
            __html: marked(iconMarkdown, {renderer}),
          }}
        />
      );
    }
    // Default to showing the capitalized first letter of the server's name
    return <div>{name.substr(0, 1).toUpperCase()}</div>;
  }

  _renderProgress(data: StatusData): ?string {
    if (data.kind !== 'yellow') {
      return null;
    }
    if (data.shortMessage != null) {
      return data.shortMessage;
    }
    if (data.progress != null) {
      const {numerator, denominator} = data.progress;
      return (
        Math.round(
          (numerator / (denominator == null ? 100 : denominator)) * 100,
        ) + '%'
      );
    }
    return null;
  }

  _setTooltipRef = (ref: React.ElementRef<any>): void => {
    if (ref == null) {
      return;
    }
    this._tooltipRefs.set(ref.dataset.name, ref);
  };

  _onMouseOver = (e: SyntheticEvent<any>): void => {
    this._hoveredProviderName.next(e.currentTarget.dataset.name);
  };

  _onMouseOut = (): void => {
    this._hoveredProviderName.next(null);
  };
}
