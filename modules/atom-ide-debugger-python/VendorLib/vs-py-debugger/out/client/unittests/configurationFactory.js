// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.
'use strict';
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __param = (this && this.__param) || function (paramIndex, decorator) {
    return function (target, key) { decorator(target, key, paramIndex); }
};
Object.defineProperty(exports, "__esModule", { value: true });
const inversify_1 = require("inversify");
const types_1 = require("../common/types");
const types_2 = require("../ioc/types");
const nose = require("./nosetest/testConfigurationManager");
const pytest = require("./pytest/testConfigurationManager");
const unittest = require("./unittest/testConfigurationManager");
let TestConfigurationManagerFactory = class TestConfigurationManagerFactory {
    constructor(serviceContainer) {
        this.serviceContainer = serviceContainer;
    }
    create(wkspace, product) {
        switch (product) {
            case types_1.Product.unittest: {
                return new unittest.ConfigurationManager(wkspace, this.serviceContainer);
            }
            case types_1.Product.pytest: {
                return new pytest.ConfigurationManager(wkspace, this.serviceContainer);
            }
            case types_1.Product.nosetest: {
                return new nose.ConfigurationManager(wkspace, this.serviceContainer);
            }
            default: {
                throw new Error('Invalid test configuration');
            }
        }
    }
};
TestConfigurationManagerFactory = __decorate([
    inversify_1.injectable(),
    __param(0, inversify_1.inject(types_2.IServiceContainer))
], TestConfigurationManagerFactory);
exports.TestConfigurationManagerFactory = TestConfigurationManagerFactory;
//# sourceMappingURL=configurationFactory.js.map