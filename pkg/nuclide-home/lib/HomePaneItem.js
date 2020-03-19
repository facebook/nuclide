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

import type {HomeFragments} from './types';
import type {Observable, BehaviorSubject} from 'rxjs';

import * as Immutable from 'immutable';
import * as React from 'react';
import HomeFeatureComponent from './HomeFeatureComponent';
import createUtmUrl from './createUtmUrl';
import featureConfig from 'nuclide-commons-atom/feature-config';
import NuclideLogo from 'nuclide-commons-ui/NuclideLogo';
import UniversalDisposable from 'nuclide-commons/UniversalDisposable';
import {Checkbox} from 'nuclide-commons-ui/Checkbox';
import {track} from 'nuclide-analytics';

export const WORKSPACE_VIEW_URI = 'atom://nuclide/home';

const NUCLIDE_DOCS_URL = createUtmUrl('http://nuclide.io', 'welcome');
const DEFAULT_WELCOME = (
  <div>
    <p>
      Thanks for trying Nuclide, Facebook's
      <br />
      unified developer environment.
    </p>
    <ul className="text-left">
      <li>
        <a href={NUCLIDE_DOCS_URL}>Get Started!</a> In-depth docs on our
        features.
      </li>
      <li>
        <a href="https://github.com/facebook/nuclide">GitHub</a> Pull requests,
        issues, and feedback.
      </li>
    </ul>
    <p>
      We hope you enjoy using Nuclide
      <br />
      at least as much as we enjoy building it.
    </p>
  </div>
);

type Props = {
  allHomeFragmentsStream: BehaviorSubject<Immutable.Set<HomeFragments>>,
};

export default class HomePaneItem extends React.Component<
  Props,
  {
    allHomeFragments: Immutable.Set<HomeFragments>,
    showOnStartup: boolean,
  },
> {
  _disposables: ?UniversalDisposable;

  constructor(props: Props) {
    super(props);
    this.state = {
      showOnStartup: Boolean(featureConfig.get('nuclide-home.showHome')),
      allHomeFragments: Immutable.Set(),
    };
  }

  componentDidMount() {
    // Note: We're assuming that the allHomeFragmentsStream prop never changes.
    this._disposables = new UniversalDisposable(
      this.props.allHomeFragmentsStream.subscribe(allHomeFragments =>
        this.setState({allHomeFragments}),
      ),
      (featureConfig.observeAsStream('nuclide-home.showHome'): Observable<
        any,
      >).subscribe(showOnStartup => {
        this.setState({showOnStartup});
      }),
    );
  }

  render() {
    const welcomes = [];
    const features = [];
    const sortedHomeFragments = Array.from(this.state.allHomeFragments).sort(
      (fragmentA, fragmentB) =>
        (fragmentB.priority || 0) - (fragmentA.priority || 0),
    );
    sortedHomeFragments.forEach(fragment => {
      const {welcome, feature} = fragment;
      if (welcome) {
        welcomes.push(<div key={welcomes.length}>{welcome}</div>);
      }
      if (feature) {
        features.push(
          <HomeFeatureComponent key={features.length} {...feature} />,
        );
      }
    });

    const containers = [
      <div key="welcome" className="nuclide-home-container">
        <section className="text-center">
          <NuclideLogo className="nuclide-home-logo" />
          <h1 className="nuclide-home-title">Welcome to Nuclide</h1>
        </section>
        <section className="text-center" onClick={trackAnchorClicks}>
          {welcomes.length > 0 ? welcomes : DEFAULT_WELCOME}
        </section>
        <section className="text-center">
          <Checkbox
            checked={this.state.showOnStartup}
            onChange={this._handleShowOnStartupChange}
            label="Show this screen on startup."
          />
        </section>
      </div>,
    ];

    if (features.length > 0) {
      containers.push(
        <div key="features" className="nuclide-home-container">
          {features}
        </div>,
      );
    }

    return (
      // Re-use styles from the Atom welcome pane where possible.
      <div className="nuclide-home pane-item padded nuclide-home-containers">
        {containers}
      </div>
    );
  }

  _handleShowOnStartupChange = (checked: boolean): void => {
    featureConfig.set('nuclide-home.showHome', checked);
  };

  getTitle(): string {
    return 'Home';
  }

  getIconName(): string {
    return 'home';
  }

  // Return false to prevent the tab getting split (since we only update a singleton health pane).
  copy() {
    return false;
  }

  getURI(): string {
    return WORKSPACE_VIEW_URI;
  }

  getDefaultLocation(): string {
    return 'center';
  }

  componentWillUnmount() {
    if (this._disposables != null) {
      this._disposables.dispose();
    }
  }
}

function trackAnchorClicks(e: SyntheticMouseEvent<>) {
  const {target} = e;
  // $FlowFixMe(>=0.68.0) Flow suppress (T27187857)
  if (target.tagName !== 'A' || target.href == null) {
    return;
  }

  // $FlowFixMe
  const {href, innerText} = target;
  track('home-link-clicked', {href, text: innerText});
}
