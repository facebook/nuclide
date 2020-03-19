"use strict";
// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for details.
Object.defineProperty(exports, "__esModule", { value: true });
// END MODIFIED BY PELMERS
/**
 * Updates the Status bar with the status of React Native Packager.
 */
var PackagerStatus;
(function (PackagerStatus) {
    PackagerStatus[PackagerStatus["PACKAGER_STARTED"] = 0] = "PACKAGER_STARTED";
    PackagerStatus[PackagerStatus["EXPONENT_PACKAGER_STARTED"] = 1] = "EXPONENT_PACKAGER_STARTED";
    PackagerStatus[PackagerStatus["PACKAGER_STOPPED"] = 2] = "PACKAGER_STOPPED";
})(PackagerStatus = exports.PackagerStatus || (exports.PackagerStatus = {}));
class PackagerStatusIndicator {
    constructor() {
        // BEGIN MODIFIED BY PELMERS
        this.packagerStatusItem = { show: function () { }, dispose: function () { } };
        // END MODIFIED BY PELMERS
    }
    dispose() {
        this.packagerStatusItem.dispose();
    }
    updatePackagerStatus(status) {
        switch (status) {
            case PackagerStatus.PACKAGER_STARTED:
                this.packagerStatusItem.text = `$(package) ${PackagerStatusIndicator.PACKAGER_STARTED_STATUS_STR}`;
                break;
            case PackagerStatus.EXPONENT_PACKAGER_STARTED:
                this.packagerStatusItem.text = `$(package) ${PackagerStatusIndicator.EXPONENT_PACKAGER_STARTED_STATUS_STR}`;
                break;
            case PackagerStatus.PACKAGER_STOPPED:
                this.packagerStatusItem.text = `$(package) ${PackagerStatusIndicator.PACKAGER_STOPPED_STATUS_STR}`;
                break;
            default:
                break;
        }
        this.packagerStatusItem.show();
    }
}
PackagerStatusIndicator.PACKAGER_STARTED_STATUS_STR = "React Native Packager: Started";
PackagerStatusIndicator.EXPONENT_PACKAGER_STARTED_STATUS_STR = "Exponent Packager: Started";
PackagerStatusIndicator.PACKAGER_STOPPED_STATUS_STR = "React Native Packager: Stopped";
exports.PackagerStatusIndicator = PackagerStatusIndicator;

//# sourceMappingURL=packagerStatusIndicator.js.map
