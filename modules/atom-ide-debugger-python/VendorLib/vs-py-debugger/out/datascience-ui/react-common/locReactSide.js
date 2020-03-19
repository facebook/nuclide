// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.
'use strict';
Object.defineProperty(exports, "__esModule", { value: true });
// The react code can't use the localize.ts module because it reads from
// disk. This isn't allowed inside a browswer, so we pass the collection
// through the javascript.
let loadedCollection;
function getLocString(key, defValue) {
    if (!loadedCollection) {
        load();
    }
    if (loadedCollection && loadedCollection.hasOwnProperty(key)) {
        return loadedCollection[key];
    }
    return defValue;
}
exports.getLocString = getLocString;
function load() {
    // tslint:disable-next-line:no-typeof-undefined
    if (typeof getLocStrings !== 'undefined') {
        loadedCollection = getLocStrings();
    }
    else {
        loadedCollection = {};
    }
}
//# sourceMappingURL=locReactSide.js.map