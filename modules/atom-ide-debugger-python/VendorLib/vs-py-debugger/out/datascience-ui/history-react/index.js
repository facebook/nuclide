// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.
'use strict';
Object.defineProperty(exports, "__esModule", { value: true });
const React = require("react");
const ReactDOM = require("react-dom");
const postOffice_1 = require("../react-common/postOffice");
const themeDetector_1 = require("../react-common/themeDetector");
require("./index.css");
const MainPanel_1 = require("./MainPanel");
const theme = themeDetector_1.detectTheme();
const skipDefault = postOffice_1.PostOffice.canSendMessages();
ReactDOM.render(React.createElement(MainPanel_1.MainPanel, { theme: theme, skipDefault: skipDefault }), document.getElementById('root'));
//# sourceMappingURL=index.js.map