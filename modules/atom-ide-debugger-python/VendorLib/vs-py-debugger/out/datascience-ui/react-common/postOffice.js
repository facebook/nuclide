// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.
'use strict';
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : new P(function (resolve) { resolve(result.value); }).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
Object.defineProperty(exports, "__esModule", { value: true });
const React = require("react");
class PostOffice extends React.Component {
    constructor(props) {
        super(props);
        this.handleMessages = (ev) => __awaiter(this, void 0, void 0, function* () {
            if (this.props) {
                const msg = ev.data;
                if (msg) {
                    this.props.messageHandlers.forEach((h) => {
                        h.handleMessage(msg.type, msg.payload);
                    });
                }
            }
        });
    }
    static canSendMessages() {
        if (PostOffice.acquireApi()) {
            return true;
        }
        return false;
    }
    static sendMessage(message) {
        if (PostOffice.canSendMessages()) {
            const api = PostOffice.acquireApi();
            if (api) {
                api.postMessage(message);
            }
        }
    }
    static acquireApi() {
        // Only do this once as it crashes if we ask more than once
        if (!PostOffice.vscodeApi &&
            // tslint:disable-next-line:no-typeof-undefined
            typeof acquireVsCodeApi !== 'undefined') {
            PostOffice.vscodeApi = acquireVsCodeApi();
        }
        return PostOffice.vscodeApi;
    }
    componentDidMount() {
        window.addEventListener('message', this.handleMessages);
    }
    componentWillUnmount() {
        window.removeEventListener('message', this.handleMessages);
    }
    render() {
        return null;
    }
}
exports.PostOffice = PostOffice;
//# sourceMappingURL=postOffice.js.map