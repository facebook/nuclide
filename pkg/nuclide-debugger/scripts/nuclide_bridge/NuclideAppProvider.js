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

import UnresolvedBreakpointsSidebarPane
  from './UnresolvedBreakpointsSidebarPane';
import ThreadsWindowPane from './ThreadsWindowPane';
import WebInspector from '../../lib/WebInspector';

/**
 * The App is declared in `module.json` and the highest priority one is loaded
 * by `Main`.
 *
 * The one method, `presentUI` is called by `Main` to attach the UI into the
 * DOM. Here we can inject any modifications into the UI.
 */
class NuclideApp extends WebInspector.App {
  _threadsWindow: Object;

  presentUI() {
    const rootView = new WebInspector.RootView();
    WebInspector.inspectorView.show(rootView.element);
    WebInspector.inspectorView
      .panel('sources')
      .then(panel => {
        // Force Sources view to hide the editor.
        const sourcesPanel: any = panel;
        sourcesPanel._splitView.addEventListener(
          WebInspector.SplitView.Events.ShowModeChanged,
          this._forceOnlySidebar,
          this,
        );
        sourcesPanel.sidebarPanes.domBreakpoints.setVisible(false);
        sourcesPanel.sidebarPanes.xhrBreakpoints.setVisible(false);
        sourcesPanel.sidebarPanes.eventListenerBreakpoints.setVisible(false);
        sourcesPanel.sidebarPanes.unresolvedBreakpoints = new UnresolvedBreakpointsSidebarPane();
        this._threadsWindow = new ThreadsWindowPane();
        sourcesPanel.sidebarPanes.threads = this._threadsWindow;
        // Force redraw
        sourcesPanel.sidebarPaneView.detach();
        sourcesPanel.sidebarPaneView = null;
        sourcesPanel._dockSideChanged();

        WebInspector.inspectorView.showInitialPanel();
        sourcesPanel._splitView.hideMain();
        rootView.attachToDocument(document);
      })
      // eslint-disable-next-line no-console
      .catch(e => console.error(e));

    // Clear breakpoints whenever they are saved to localStorage.
    WebInspector.settings.breakpoints.addChangeListener(
      this._onBreakpointSettingsChanged,
      this,
    );
  }

  _forceOnlySidebar(event: any) {
    if (event.data !== WebInspector.SplitView.ShowMode.OnlySidebar) {
      event.target.hideMain();
    }
  }

  _onBreakpointSettingsChanged(event: WebInspector.Event) {
    if (event.data.length > 0) {
      WebInspector.settings.breakpoints.set([]);
    }
  }
}

export default class NuclideAppProvider extends WebInspector.AppProvider {
  createApp(): WebInspector.App {
    return new NuclideApp();
  }
}
