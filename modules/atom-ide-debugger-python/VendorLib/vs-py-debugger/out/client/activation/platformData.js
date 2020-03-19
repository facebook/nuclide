"use strict";
// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : new P(function (resolve) { resolve(result.value); }).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
Object.defineProperty(exports, "__esModule", { value: true });
const languageServerHashes_1 = require("./languageServer/languageServerHashes");
var PlatformName;
(function (PlatformName) {
    PlatformName["Windows32Bit"] = "win-x86";
    PlatformName["Windows64Bit"] = "win-x64";
    PlatformName["Mac64Bit"] = "osx-x64";
    PlatformName["Linux64Bit"] = "linux-x64";
})(PlatformName = exports.PlatformName || (exports.PlatformName = {}));
var PlatformLSExecutables;
(function (PlatformLSExecutables) {
    PlatformLSExecutables["Windows"] = "Microsoft.Python.LanguageServer.exe";
    PlatformLSExecutables["MacOS"] = "Microsoft.Python.LanguageServer";
    PlatformLSExecutables["Linux"] = "Microsoft.Python.LanguageServer";
})(PlatformLSExecutables = exports.PlatformLSExecutables || (exports.PlatformLSExecutables = {}));
class PlatformData {
    constructor(platform, fs) {
        this.platform = platform;
    }
    getPlatformName() {
        if (this.platform.isWindows) {
            return this.platform.is64bit ? PlatformName.Windows64Bit : PlatformName.Windows32Bit;
        }
        if (this.platform.isMac) {
            return PlatformName.Mac64Bit;
        }
        if (this.platform.isLinux) {
            if (!this.platform.is64bit) {
                throw new Error('Microsoft Python Language Server does not support 32-bit Linux.');
            }
            return PlatformName.Linux64Bit;
        }
        throw new Error('Unknown OS platform.');
    }
    getEngineDllName() {
        return 'Microsoft.Python.LanguageServer.dll';
    }
    getEngineExecutableName() {
        if (this.platform.isWindows) {
            return PlatformLSExecutables.Windows;
        }
        else if (this.platform.isLinux) {
            return PlatformLSExecutables.Linux;
        }
        else if (this.platform.isMac) {
            return PlatformLSExecutables.MacOS;
        }
        else {
            return 'unknown-platform';
        }
    }
    getExpectedHash() {
        return __awaiter(this, void 0, void 0, function* () {
            if (this.platform.isWindows) {
                return this.platform.is64bit ? languageServerHashes_1.language_server_win_x64_sha512 : languageServerHashes_1.language_server_win_x86_sha512;
            }
            if (this.platform.isMac) {
                return languageServerHashes_1.language_server_osx_x64_sha512;
            }
            if (this.platform.isLinux && this.platform.is64bit) {
                return languageServerHashes_1.language_server_linux_x64_sha512;
            }
            throw new Error('Unknown platform.');
        });
    }
}
exports.PlatformData = PlatformData;
//# sourceMappingURL=platformData.js.map