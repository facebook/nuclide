'use strict';
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
const types_1 = require("../common/types");
const telemetry_1 = require("../telemetry");
const constants_1 = require("../telemetry/constants");
const completionSource_1 = require("./completionSource");
const itemInfoSource_1 = require("./itemInfoSource");
class PythonCompletionItemProvider {
    constructor(jediFactory, serviceContainer) {
        this.completionSource = new completionSource_1.CompletionSource(jediFactory, serviceContainer, new itemInfoSource_1.ItemInfoSource(jediFactory));
        this.configService = serviceContainer.get(types_1.IConfigurationService);
    }
    provideCompletionItems(document, position, token) {
        return __awaiter(this, void 0, void 0, function* () {
            const items = yield this.completionSource.getVsCodeCompletionItems(document, position, token);
            if (this.configService.isTestExecution()) {
                for (let i = 0; i < Math.min(3, items.length); i += 1) {
                    items[i] = yield this.resolveCompletionItem(items[i], token);
                }
            }
            return items;
        });
    }
    resolveCompletionItem(item, token) {
        return __awaiter(this, void 0, void 0, function* () {
            if (!item.documentation) {
                const itemInfos = yield this.completionSource.getDocumentation(item, token);
                if (itemInfos && itemInfos.length > 0) {
                    item.documentation = itemInfos[0].tooltip;
                }
            }
            return item;
        });
    }
}
__decorate([
    telemetry_1.captureTelemetry(constants_1.COMPLETION)
], PythonCompletionItemProvider.prototype, "provideCompletionItems", null);
exports.PythonCompletionItemProvider = PythonCompletionItemProvider;
//# sourceMappingURL=completionProvider.js.map