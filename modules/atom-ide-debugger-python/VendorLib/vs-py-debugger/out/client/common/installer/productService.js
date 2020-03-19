// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.
'use strict';
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
const inversify_1 = require("inversify");
const types_1 = require("../types");
let ProductService = class ProductService {
    constructor() {
        this.ProductTypes = new Map();
        this.ProductTypes.set(types_1.Product.bandit, types_1.ProductType.Linter);
        this.ProductTypes.set(types_1.Product.flake8, types_1.ProductType.Linter);
        this.ProductTypes.set(types_1.Product.mypy, types_1.ProductType.Linter);
        this.ProductTypes.set(types_1.Product.pep8, types_1.ProductType.Linter);
        this.ProductTypes.set(types_1.Product.prospector, types_1.ProductType.Linter);
        this.ProductTypes.set(types_1.Product.pydocstyle, types_1.ProductType.Linter);
        this.ProductTypes.set(types_1.Product.pylama, types_1.ProductType.Linter);
        this.ProductTypes.set(types_1.Product.pylint, types_1.ProductType.Linter);
        this.ProductTypes.set(types_1.Product.ctags, types_1.ProductType.WorkspaceSymbols);
        this.ProductTypes.set(types_1.Product.nosetest, types_1.ProductType.TestFramework);
        this.ProductTypes.set(types_1.Product.pytest, types_1.ProductType.TestFramework);
        this.ProductTypes.set(types_1.Product.unittest, types_1.ProductType.TestFramework);
        this.ProductTypes.set(types_1.Product.autopep8, types_1.ProductType.Formatter);
        this.ProductTypes.set(types_1.Product.black, types_1.ProductType.Formatter);
        this.ProductTypes.set(types_1.Product.yapf, types_1.ProductType.Formatter);
        this.ProductTypes.set(types_1.Product.rope, types_1.ProductType.RefactoringLibrary);
    }
    getProductType(product) {
        return this.ProductTypes.get(product);
    }
};
ProductService = __decorate([
    inversify_1.injectable()
], ProductService);
exports.ProductService = ProductService;
//# sourceMappingURL=productService.js.map