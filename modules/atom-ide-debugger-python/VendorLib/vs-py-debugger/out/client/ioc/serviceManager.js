"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.
const inversify_1 = require("inversify");
let ServiceManager = class ServiceManager {
    constructor(container) {
        this.container = container;
    }
    // tslint:disable-next-line:no-any
    add(serviceIdentifier, constructor, name) {
        if (name) {
            this.container.bind(serviceIdentifier).to(constructor).whenTargetNamed(name);
        }
        else {
            this.container.bind(serviceIdentifier).to(constructor);
        }
    }
    // tslint:disable-next-line:no-any
    addFactory(factoryIdentifier, factoryMethod) {
        this.container.bind(factoryIdentifier).toFactory(factoryMethod);
    }
    // tslint:disable-next-line:no-any
    addSingleton(serviceIdentifier, constructor, name) {
        if (name) {
            this.container.bind(serviceIdentifier).to(constructor).inSingletonScope().whenTargetNamed(name);
        }
        else {
            this.container.bind(serviceIdentifier).to(constructor).inSingletonScope();
        }
    }
    // tslint:disable-next-line:no-any
    addSingletonInstance(serviceIdentifier, instance, name) {
        if (name) {
            this.container.bind(serviceIdentifier).toConstantValue(instance).whenTargetNamed(name);
        }
        else {
            this.container.bind(serviceIdentifier).toConstantValue(instance);
        }
    }
    get(serviceIdentifier, name) {
        return name ? this.container.getNamed(serviceIdentifier, name) : this.container.get(serviceIdentifier);
    }
    getAll(serviceIdentifier, name) {
        return name ? this.container.getAllNamed(serviceIdentifier, name) : this.container.getAll(serviceIdentifier);
    }
    rebind(serviceIdentifier, constructor, name) {
        if (name) {
            this.container.rebind(serviceIdentifier).to(constructor).whenTargetNamed(name);
        }
        else {
            this.container.rebind(serviceIdentifier).to(constructor);
        }
    }
};
ServiceManager = __decorate([
    inversify_1.injectable()
], ServiceManager);
exports.ServiceManager = ServiceManager;
//# sourceMappingURL=serviceManager.js.map