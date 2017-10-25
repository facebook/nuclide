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
import ReactDOM from 'react-dom';
import classnames from 'classnames';
import {getLogger} from 'log4js';
import UniversalDisposable from 'nuclide-commons/UniversalDisposable';
import {Icon} from 'nuclide-commons-ui/Icon';

function WarningIconWithShadow(): React.Element<any> {
  return (
    <div>
      <svg
        className="nuclide-ui-path-with-file-icon-warning-icon-background"
        width="20"
        height="18"
        viewBox="0 0 20 20"
        xmlns="http://www.w3.org/2000/svg">
        <polygon points="10,2 0,18 20,18" />
      </svg>
      <Icon className="text-warning" icon="alert" />
    </div>
  );
}

function ErrorIconWithShadow(): React.Element<any> {
  return (
    <div>
      <svg
        className="nuclide-ui-path-with-file-icon-error-icon-background"
        width="16"
        height="16"
        viewBox="0 0 16 16"
        xmlns="http://www.w3.org/2000/svg">
        <circle cx="10" cy="10" r="8" />
      </svg>
      <Icon className="text-error" icon="stop" />
    </div>
  );
}

// The decoration icons require a backdrop to be fully visible,
// so we only allow the following, blessed decorations:
export const DecorationIcons = Object.freeze({
  Warning: WarningIconWithShadow,
  Error: ErrorIconWithShadow,
});

type FileIconsAddItemToElementFn = (
  element: HTMLElement,
  path: string,
) => IDisposable;

type Props = {
  className?: string,
  children?: React.Node,
  // Optional <Icon /> element. If set, will render a small version of
  // the decorationIcon on top of the file icon.
  decorationIcon?: WarningIconWithShadow | ErrorIconWithShadow,
  isFolder?: boolean,
  path: string,
};

export default class PathWithFileIcon extends React.Component<Props> {
  _disposables: UniversalDisposable;
  _fileIconsDisposable: ?IDisposable;
  _addItemToElement: ?FileIconsAddItemToElementFn;
  _mounted: boolean;

  constructor(props: Props) {
    super(props);
    this._mounted = false;
    this._disposables = new UniversalDisposable(
      consumeServiceAsync(
        'file-icons.element-icons',
        '1.0.0',
        this._consumeFileIconService.bind(this),
      ),
      () => {
        if (this._fileIconsDisposable != null) {
          this._fileIconsDisposable.dispose();
        }
      },
    );
  }

  componentDidMount(): void {
    this._mounted = true;
  }

  componentDidUpdate(prevProps: Props) {
    if (prevProps.path !== this.props.path) {
      this._forceIconUpdate();
    }
  }

  // This only gets called if the file-icons package is installed.
  _consumeFileIconService(
    addItemToElement: FileIconsAddItemToElementFn,
  ): IDisposable {
    this._addItemToElement = (element: HTMLElement, path: string) => {
      try {
        return addItemToElement(element, path);
      } catch (e) {
        getLogger('nuclide-ui-path-with-file-icon').error(
          'Error adding item to element',
          e,
        );
        return new UniversalDisposable();
      }
    };
    this._forceIconUpdate();
    return new UniversalDisposable(() => {
      this._addItemToElement = null;
      this._forceIconUpdate();
    });
  }

  _handleRef = (element: ?HTMLElement): void => {
    if (this.props.isFolder) {
      return;
    }
    this._ensureIconRemoved();
    if (this._addItemToElement == null) {
      // file-icons service not available; ignore.
      return;
    }
    if (element == null) {
      // Element is unmounting.
      return;
    }
    this._fileIconsDisposable = new UniversalDisposable(
      this._addItemToElement(element, this.props.path),
      // On dispose, file-icons doesn't actually remove the classNames it assigned to the node,
      // so we need to reset the classList manually.
      () => {
        element.className = this._getDefaultClassName();
      },
    );
  };

  _getDefaultClassName(): string {
    const {className, isFolder} = this.props;
    return classnames(
      'icon',
      'name',
      'nuclide-ui-path-with-file-icon',
      {
        'icon-file-text': isFolder !== true,
        'icon-file-directory': isFolder === true,
      },
      className,
    );
  }

  _forceIconUpdate(): void {
    if (!this._mounted) {
      return;
    }
    const element = ReactDOM.findDOMNode(this);
    // $FlowIssue `element` is an HTMLElement
    this._handleRef(element);
  }

  _ensureIconRemoved(): void {
    if (this._fileIconsDisposable == null) {
      return;
    }
    this._fileIconsDisposable.dispose();
    this._fileIconsDisposable = null;
  }

  componentWillUnmount(): void {
    this._disposables.dispose();
    this._mounted = false;
  }

  render(): React.Node {
    const {
      className,
      children,
      decorationIcon: DecorationIcon,
      isFolder,
      path,
      // forward properties such as `data-path`, etc
      ...rest
    } = this.props;
    const displayPath = children == null ? path : children;
    const decoration =
      DecorationIcon == null ? null : (
        <div className="nuclide-ui-path-with-file-icon-decoration-icon">
          {/* $FlowIssue "expected React component instead of prototype" */}
          <DecorationIcon />
        </div>
      );
    return (
      <div
        className={this._getDefaultClassName()}
        ref={this._handleRef}
        {...rest}>
        {displayPath}
        {decoration}
      </div>
    );
  }
}

/**
 * Currently, Atom's service hub [provides services while iterating over consumers][0]. If, as a
 * result of providing a service, new consumers are added, its array will be mutated, screwing up
 * the next step of the iteration.
 *
 * This is the case with the above component as providing the service may cause it to be mounted (or
 * unmounted), which in turn will cause it to consume (or "unconsume" by disposing) the service.
 *
 * This function is a workaround that delays both the consuming of the service and the disposal,
 * without affecting the API. This way, the ServiceHub's array won't be synchronously mutated while
 * iterating over it. We should be able to remove this workaround (in favor of calling
 * `serviceHub.consume()` directly) once atom/service-hub#11 makes it into our oldest-supported
 * version of Atom.
 *
 * [0]: https://github.com/atom/service-hub/blob/v0.7.3/src/service-hub.coffee#L32-L34
 */
function consumeServiceAsync(service, version, callback): IDisposable {
  let serviceDisposable;
  // Don't call `consume()` synchronously.
  const id = setImmediate(() => {
    serviceDisposable = atom.packages.serviceHub.consume(
      service,
      version,
      callback,
    );
  });
  return new UniversalDisposable(
    () => {
      clearImmediate(id);
    },
    () => {
      if (serviceDisposable != null) {
        // "unconsume" the service asynchronously too.
        setImmediate(() => {
          serviceDisposable.dispose();
        });
      }
    },
  );
}
