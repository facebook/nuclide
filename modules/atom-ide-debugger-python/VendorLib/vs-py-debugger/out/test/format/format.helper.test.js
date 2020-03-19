"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : new P(function (resolve) { resolve(result.value); }).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
Object.defineProperty(exports, "__esModule", { value: true });
const assert = require("assert");
const TypeMoq = require("typemoq");
const configSettings_1 = require("../../client/common/configSettings");
const types_1 = require("../../client/common/types");
const EnumEx = require("../../client/common/utils/enum");
const helper_1 = require("../../client/formatters/helper");
const initialize_1 = require("../initialize");
const serviceRegistry_1 = require("../unittests/serviceRegistry");
// tslint:disable-next-line:max-func-body-length
suite('Formatting - Helper', () => {
    let ioc;
    let formatHelper;
    suiteSetup(initialize_1.initialize);
    setup(() => {
        ioc = new serviceRegistry_1.UnitTestIocContainer();
        const config = TypeMoq.Mock.ofType();
        config.setup(x => x.getSettings(TypeMoq.It.isAny())).returns(() => configSettings_1.PythonSettings.getInstance());
        ioc.serviceManager.addSingletonInstance(types_1.IConfigurationService, config.object);
        formatHelper = new helper_1.FormatterHelper(ioc.serviceManager);
    });
    test('Ensure product is set in Execution Info', () => __awaiter(this, void 0, void 0, function* () {
        [types_1.Product.autopep8, types_1.Product.black, types_1.Product.yapf].forEach(formatter => {
            const info = formatHelper.getExecutionInfo(formatter, []);
            assert.equal(info.product, formatter, `Incorrect products for ${formatHelper.translateToId(formatter)}`);
        });
    }));
    test('Ensure executable is set in Execution Info', () => __awaiter(this, void 0, void 0, function* () {
        const settings = configSettings_1.PythonSettings.getInstance();
        [types_1.Product.autopep8, types_1.Product.black, types_1.Product.yapf].forEach(formatter => {
            const info = formatHelper.getExecutionInfo(formatter, []);
            const names = formatHelper.getSettingsPropertyNames(formatter);
            const execPath = settings.formatting[names.pathName];
            assert.equal(info.execPath, execPath, `Incorrect executable paths for product ${formatHelper.translateToId(formatter)}`);
        });
    }));
    test('Ensure arguments are set in Execution Info', () => __awaiter(this, void 0, void 0, function* () {
        const settings = configSettings_1.PythonSettings.getInstance();
        const customArgs = ['1', '2', '3'];
        [types_1.Product.autopep8, types_1.Product.black, types_1.Product.yapf].forEach(formatter => {
            const names = formatHelper.getSettingsPropertyNames(formatter);
            const args = Array.isArray(settings.formatting[names.argsName]) ? settings.formatting[names.argsName] : [];
            const expectedArgs = args.concat(customArgs).join(',');
            assert.equal(expectedArgs.endsWith(customArgs.join(',')), true, `Incorrect custom arguments for product ${formatHelper.translateToId(formatter)}`);
        });
    }));
    test('Ensure correct setting names are returned', () => __awaiter(this, void 0, void 0, function* () {
        [types_1.Product.autopep8, types_1.Product.black, types_1.Product.yapf].forEach(formatter => {
            const translatedId = formatHelper.translateToId(formatter);
            const settings = {
                argsName: `${translatedId}Args`,
                pathName: `${translatedId}Path`
            };
            assert.deepEqual(formatHelper.getSettingsPropertyNames(formatter), settings, `Incorrect settings for product ${formatHelper.translateToId(formatter)}`);
        });
    }));
    test('Ensure translation of ids works', () => __awaiter(this, void 0, void 0, function* () {
        const formatterMapping = new Map();
        formatterMapping.set(types_1.Product.autopep8, 'autopep8');
        formatterMapping.set(types_1.Product.black, 'black');
        formatterMapping.set(types_1.Product.yapf, 'yapf');
        [types_1.Product.autopep8, types_1.Product.black, types_1.Product.yapf].forEach(formatter => {
            const translatedId = formatHelper.translateToId(formatter);
            assert.equal(translatedId, formatterMapping.get(formatter), `Incorrect translation for product ${formatHelper.translateToId(formatter)}`);
        });
    }));
    EnumEx.getValues(types_1.Product).forEach(product => {
        const formatterMapping = new Map();
        formatterMapping.set(types_1.Product.autopep8, 'autopep8');
        formatterMapping.set(types_1.Product.black, 'black');
        formatterMapping.set(types_1.Product.yapf, 'yapf');
        if (formatterMapping.has(product)) {
            return;
        }
        test(`Ensure translation of ids throws exceptions for unknown formatters (${product})`, () => __awaiter(this, void 0, void 0, function* () {
            assert.throws(() => formatHelper.translateToId(product));
        }));
    });
});
//# sourceMappingURL=format.helper.test.js.map