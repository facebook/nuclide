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

import * as React from 'react';
import {Webview} from '../../../nuclide-ui/Webview';

export const WORKSPACE_VIEW_URI = 'atom://nuclide/react-inspector';

type Props = {||};

export default class Inspector extends React.Component<Props> {
  getTitle(): string {
    return 'React Inspector';
  }

  getDefaultLocation(): string {
    return 'center';
  }

  getURI(): string {
    return WORKSPACE_VIEW_URI;
  }

  render(): React.Node {
    return (
      <Webview
        style={{width: '100%', height: '100%'}}
        nodeintegration={true}
        className="native-key-bindings"
        onDidFinishLoad={this._handleDidFinishLoad}
        src="atom://nuclide/pkg/nuclide-react-inspector/lib/ui/inspector.html"
      />
    );
  }

  _handleDidFinishLoad = (event: Event) => {
    const themes = atom.config.get('core.themes');

    let theme = '';

    // Atom has 2 theme settings: UI and Syntax.
    // DevTools matches the Syntax theme, which is the 2nd in the array.
    if (Array.isArray(themes) && themes.length > 1) {
      theme = themes[1];
    }

    const element = ((event.target: any): WebviewElement);
    const requirePaths = require.cache[__filename].paths;
    const inspectorDevTools = require.resolve('react-devtools-core/standalone');
    element.executeJavaScript(
      `initializeElementInspector(
        ${JSON.stringify(inspectorDevTools)},
        ${JSON.stringify(requirePaths)},
        ${JSON.stringify(theme)}
      );`,
    );
  };
}
