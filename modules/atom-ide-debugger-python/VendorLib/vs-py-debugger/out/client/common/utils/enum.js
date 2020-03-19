// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.
'use strict';
Object.defineProperty(exports, "__esModule", { value: true });
// tslint:disable:no-any
function getNamesAndValues(e) {
    return getNames(e).map(n => ({ name: n, value: e[n] }));
}
exports.getNamesAndValues = getNamesAndValues;
function getNames(e) {
    return getObjValues(e).filter(v => typeof v === 'string');
}
exports.getNames = getNames;
function getValues(e) {
    return getObjValues(e).filter(v => typeof v === 'number');
}
exports.getValues = getValues;
function getObjValues(e) {
    return Object.keys(e).map(k => e[k]);
}
//# sourceMappingURL=enum.js.map