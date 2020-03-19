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
const enzyme_1 = require("enzyme");
const Adapter = require("enzyme-adapter-react-16");
const jsdom_1 = require("jsdom");
function setUpDomEnvironment() {
    // tslint:disable-next-line:no-http-string
    const dom = new jsdom_1.JSDOM('<!doctype html><html><body><div id="root"></div></body></html>', { pretendToBeVisual: true, url: 'http://localhost' });
    const { window } = dom;
    // tslint:disable-next-line:no-string-literal
    global['window'] = window;
    // tslint:disable-next-line:no-string-literal
    global['document'] = window.document;
    // tslint:disable-next-line:no-string-literal
    global['navigator'] = {
        userAgent: 'node.js',
        platform: 'node'
    };
    // tslint:disable-next-line:no-string-literal
    global['self'] = window;
    copyProps(window, global);
    // Special case. Transform needs createRange
    // tslint:disable-next-line:no-string-literal
    global['document'].createRange = () => ({
        createContextualFragment: str => jsdom_1.JSDOM.fragment(str)
    });
    // For Jupyter server to load correctly. It expects the window object to not be defined
    // tslint:disable-next-line:no-eval
    const fetchMod = eval('require')('node-fetch');
    // tslint:disable-next-line:no-string-literal
    global['fetch'] = fetchMod;
    // tslint:disable-next-line:no-string-literal
    global['Request'] = fetchMod.Request;
    // tslint:disable-next-line:no-string-literal
    global['Headers'] = fetchMod.Headers;
    // tslint:disable-next-line:no-string-literal no-eval
    global['WebSocket'] = eval('require')('ws');
    // For the loc test to work, we have to have a global getter for loc strings
    // tslint:disable-next-line:no-string-literal no-eval
    global['getLocStrings'] = () => {
        return { 'DataScience.unknownMimeType': 'Unknown mime type from helper' };
    };
    enzyme_1.configure({ adapter: new Adapter() });
}
exports.setUpDomEnvironment = setUpDomEnvironment;
function copyProps(src, target) {
    const props = Object.getOwnPropertyNames(src)
        .filter(prop => typeof target[prop] === undefined);
    props.forEach((p) => {
        target[p] = src[p];
    });
}
function waitForComponentDidUpdate(component) {
    return new Promise((resolve, reject) => {
        if (component) {
            let originalUpdateFunc = component.componentDidUpdate;
            if (originalUpdateFunc) {
                originalUpdateFunc = originalUpdateFunc.bind(component);
            }
            // tslint:disable-next-line:no-any
            component.componentDidUpdate = (prevProps, prevState, snapshot) => {
                // When the component updates, call the original function and resolve our promise
                if (originalUpdateFunc) {
                    originalUpdateFunc(prevProps, prevState, snapshot);
                }
                // Reset our update function
                component.componentDidUpdate = originalUpdateFunc;
                // Finish the promise
                resolve();
            };
        }
        else {
            reject('Cannot find the component for waitForComponentDidUpdate');
        }
    });
}
function waitForRender(component) {
    return new Promise((resolve, reject) => {
        if (component) {
            let originalRenderFunc = component.render;
            if (originalRenderFunc) {
                originalRenderFunc = originalRenderFunc.bind(component);
            }
            component.render = () => {
                let result = null;
                // When the render occurs, call the original function and resolve our promise
                if (originalRenderFunc) {
                    result = originalRenderFunc();
                }
                // Reset our render function
                component.render = originalRenderFunc;
                resolve();
                return result;
            };
        }
        else {
            reject('Cannot find the component for waitForRender');
        }
    });
}
function waitForUpdate(wrapper, mainClass) {
    return __awaiter(this, void 0, void 0, function* () {
        const mainObj = wrapper.find(mainClass).instance();
        if (mainObj) {
            // Hook the render first.
            const renderPromise = waitForRender(mainObj);
            // First wait for the update
            yield waitForComponentDidUpdate(mainObj);
            // Force a render
            wrapper.update();
            // Wait for the render
            yield renderPromise;
        }
    });
}
exports.waitForUpdate = waitForUpdate;
//# sourceMappingURL=reactHelpers.js.map