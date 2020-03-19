// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.
'use strict';
Object.defineProperty(exports, "__esModule", { value: true });
const path = require("path");
const React = require("react");
class RelativeImage extends React.Component {
    constructor(props) {
        super(props);
        this.getImageSource = () => {
            // tslint:disable-next-line:no-typeof-undefined
            if (typeof resolvePath === 'undefined') {
                return this.props.path;
            }
            else {
                return resolvePath(this.props.path);
            }
        };
    }
    render() {
        return (React.createElement("img", { src: this.getImageSource(), className: this.props.class, alt: path.basename(this.props.path) }));
    }
}
exports.RelativeImage = RelativeImage;
//# sourceMappingURL=relativeImage.js.map