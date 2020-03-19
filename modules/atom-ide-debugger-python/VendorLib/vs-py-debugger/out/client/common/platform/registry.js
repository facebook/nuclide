"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : new P(function (resolve) { resolve(result.value); }).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
Object.defineProperty(exports, "__esModule", { value: true });
const inversify_1 = require("inversify");
const Registry = require("winreg");
const platform_1 = require("../utils/platform");
const types_1 = require("./types");
var RegistryArchitectures;
(function (RegistryArchitectures) {
    RegistryArchitectures["x86"] = "x86";
    RegistryArchitectures["x64"] = "x64";
})(RegistryArchitectures || (RegistryArchitectures = {}));
let RegistryImplementation = class RegistryImplementation {
    getKeys(key, hive, arch) {
        return __awaiter(this, void 0, void 0, function* () {
            return getRegistryKeys({ hive: translateHive(hive), arch: translateArchitecture(arch), key });
        });
    }
    getValue(key, hive, arch, name = '') {
        return __awaiter(this, void 0, void 0, function* () {
            return getRegistryValue({ hive: translateHive(hive), arch: translateArchitecture(arch), key }, name);
        });
    }
};
RegistryImplementation = __decorate([
    inversify_1.injectable()
], RegistryImplementation);
exports.RegistryImplementation = RegistryImplementation;
function getArchitectureDisplayName(arch) {
    switch (arch) {
        case platform_1.Architecture.x64:
            return '64-bit';
        case platform_1.Architecture.x86:
            return '32-bit';
        default:
            return '';
    }
}
exports.getArchitectureDisplayName = getArchitectureDisplayName;
function getRegistryValue(options, name = '') {
    return __awaiter(this, void 0, void 0, function* () {
        return new Promise((resolve, reject) => {
            new Registry(options).get(name, (error, result) => {
                if (error || !result || typeof result.value !== 'string') {
                    return resolve(undefined);
                }
                resolve(result.value);
            });
        });
    });
}
function getRegistryKeys(options) {
    return __awaiter(this, void 0, void 0, function* () {
        // https://github.com/python/peps/blob/master/pep-0514.txt#L85
        return new Promise((resolve, reject) => {
            new Registry(options).keys((error, result) => {
                if (error || !Array.isArray(result)) {
                    return resolve([]);
                }
                resolve(result.filter(item => typeof item.key === 'string').map(item => item.key));
            });
        });
    });
}
function translateArchitecture(arch) {
    switch (arch) {
        case platform_1.Architecture.x86:
            return RegistryArchitectures.x86;
        case platform_1.Architecture.x64:
            return RegistryArchitectures.x64;
        default:
            return;
    }
}
function translateHive(hive) {
    switch (hive) {
        case types_1.RegistryHive.HKCU:
            return Registry.HKCU;
        case types_1.RegistryHive.HKLM:
            return Registry.HKLM;
        default:
            return;
    }
}
//# sourceMappingURL=registry.js.map