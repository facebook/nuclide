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
let MockRegistry = class MockRegistry {
    constructor(keys, values) {
        this.keys = keys;
        this.values = values;
    }
    getKeys(key, hive, arch) {
        return __awaiter(this, void 0, void 0, function* () {
            const items = this.keys.find(item => {
                if (typeof item.arch === 'number') {
                    return item.key === key && item.hive === hive && item.arch === arch;
                }
                return item.key === key && item.hive === hive;
            });
            return items ? Promise.resolve(items.values) : Promise.resolve([]);
        });
    }
    getValue(key, hive, arch, name) {
        return __awaiter(this, void 0, void 0, function* () {
            const items = this.values.find(item => {
                if (item.key !== key || item.hive !== hive) {
                    return false;
                }
                if (typeof item.arch === 'number' && item.arch !== arch) {
                    return false;
                }
                if (name && item.name !== name) {
                    return false;
                }
                return true;
            });
            return items ? Promise.resolve(items.value) : Promise.resolve(null);
        });
    }
};
MockRegistry = __decorate([
    inversify_1.injectable()
], MockRegistry);
exports.MockRegistry = MockRegistry;
// tslint:disable-next-line:max-classes-per-file
let MockInterpreterVersionProvider = class MockInterpreterVersionProvider {
    constructor(displayName, useDefaultDisplayName = false, pipVersionPromise) {
        this.displayName = displayName;
        this.useDefaultDisplayName = useDefaultDisplayName;
        this.pipVersionPromise = pipVersionPromise;
    }
    getVersion(pythonPath, defaultDisplayName) {
        return __awaiter(this, void 0, void 0, function* () {
            return this.useDefaultDisplayName ? Promise.resolve(defaultDisplayName) : Promise.resolve(this.displayName);
        });
    }
    getPipVersion(pythonPath) {
        return __awaiter(this, void 0, void 0, function* () {
            // tslint:disable-next-line:no-non-null-assertion
            return this.pipVersionPromise;
        });
    }
    // tslint:disable-next-line:no-empty
    dispose() { }
};
MockInterpreterVersionProvider = __decorate([
    inversify_1.injectable()
], MockInterpreterVersionProvider);
exports.MockInterpreterVersionProvider = MockInterpreterVersionProvider;
// tslint:disable-next-line:no-any max-classes-per-file
class MockState {
    // tslint:disable-next-line:no-any
    constructor(data) {
        this.data = data;
    }
    // tslint:disable-next-line:no-any
    get value() {
        return this.data;
    }
    updateValue(data) {
        return __awaiter(this, void 0, void 0, function* () {
            this.data = data;
        });
    }
}
exports.MockState = MockState;
//# sourceMappingURL=mocks.js.map