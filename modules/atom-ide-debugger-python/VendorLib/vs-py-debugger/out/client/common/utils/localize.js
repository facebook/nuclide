// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.
'use strict';
Object.defineProperty(exports, "__esModule", { value: true });
const fs = require("fs");
const path = require("path");
const constants_1 = require("../constants");
// External callers of localize use these tables to retrieve localized values.
var LanguageServiceSurveyBanner;
(function (LanguageServiceSurveyBanner) {
    LanguageServiceSurveyBanner.bannerMessage = localize('LanguageServiceSurveyBanner.bannerMessage', 'Can you please take 2 minutes to tell us how the Python Language Server is working for you?');
    LanguageServiceSurveyBanner.bannerLabelYes = localize('LanguageServiceSurveyBanner.bannerLabelYes', 'Yes, take survey now');
    LanguageServiceSurveyBanner.bannerLabelNo = localize('LanguageServiceSurveyBanner.bannerLabelNo', 'No, thanks');
})(LanguageServiceSurveyBanner = exports.LanguageServiceSurveyBanner || (exports.LanguageServiceSurveyBanner = {}));
var Interpreters;
(function (Interpreters) {
    Interpreters.loading = localize('Interpreters.LoadingInterpreters', 'Loading Python Interpreters');
    Interpreters.refreshing = localize('Interpreters.RefreshingInterpreters', 'Refreshing Python Interpreters');
})(Interpreters = exports.Interpreters || (exports.Interpreters = {}));
var DataScienceSurveyBanner;
(function (DataScienceSurveyBanner) {
    DataScienceSurveyBanner.bannerMessage = localize('DataScienceSurveyBanner.bannerMessage', 'Can you please take 2 minutes to tell us how the Python Data Science features are working for you?');
    DataScienceSurveyBanner.bannerLabelYes = localize('DataScienceSurveyBanner.bannerLabelYes', 'Yes, take survey now');
    DataScienceSurveyBanner.bannerLabelNo = localize('DataScienceSurveyBanner.bannerLabelNo', 'No, thanks');
})(DataScienceSurveyBanner = exports.DataScienceSurveyBanner || (exports.DataScienceSurveyBanner = {}));
var DataScience;
(function (DataScience) {
    DataScience.historyTitle = localize('DataScience.historyTitle', 'Python Interactive');
    DataScience.badWebPanelFormatString = localize('DataScience.badWebPanelFormatString', '<html><body><h1>{0} is not a valid file name</h1></body></html>');
    DataScience.sessionDisposed = localize('DataScience.sessionDisposed', 'Cannot execute code, session has been disposed.');
    DataScience.unknownMimeType = localize('DataScience.unknownMimeType', 'Unknown mime type for data');
    DataScience.exportDialogTitle = localize('DataScience.exportDialogTitle', 'Export to Jupyter Notebook');
    DataScience.exportDialogFilter = localize('DataScience.exportDialogFilter', 'Jupyter Notebooks');
    DataScience.exportDialogComplete = localize('DataScience.exportDialogComplete', 'Notebook written to {0}');
    DataScience.exportDialogFailed = localize('DataScience.exportDialogFailed', 'Failed to export notebook. {0}');
    DataScience.exportOpenQuestion = localize('DataScience.exportOpenQuestion', 'Open in browser');
    DataScience.runCellLensCommandTitle = localize('python.command.python.datascience.runcell.title', 'Run cell');
    DataScience.importDialogTitle = localize('DataScience.importDialogTitle', 'Import Jupyter Notebook');
    DataScience.importDialogFilter = localize('DataScience.importDialogFilter', 'Jupyter Notebooks');
    DataScience.notebookCheckForImportTitle = localize('DataScience.notebookCheckForImportTitle', 'Do you want to import the Jupyter Notebook into Python code?');
    DataScience.notebookCheckForImportYes = localize('DataScience.notebookCheckForImportYes', 'Import');
    DataScience.notebookCheckForImportNo = localize('DataScience.notebookCheckForImportNo', 'Later');
    DataScience.notebookCheckForImportDontAskAgain = localize('DataScience.notebookCheckForImportDontAskAgain', 'Don\'t Ask Again');
    DataScience.jupyterNotSupported = localize('DataScience.jupyterNotSupported', 'Jupyter is not installed');
    DataScience.jupyterNbConvertNotSupported = localize('DataScience.jupyterNbConvertNotSupported', 'Jupyter nbconvert is not installed');
    DataScience.pythonInteractiveHelpLink = localize('DataScience.pythonInteractiveHelpLink', 'See [https://aka.ms/pyaiinstall] for help on installing jupyter.');
    DataScience.importingFormat = localize('DataScience.importingFormat', 'Importing {0}');
    DataScience.startingJupyter = localize('DataScience.startingJupyter', 'Starting Jupyter Server');
    DataScience.runAllCellsLensCommandTitle = localize('python.command.python.datascience.runallcells.title', 'Run all cells');
    DataScience.restartKernelMessage = localize('DataScience.restartKernelMessage', 'Do you want to restart the Jupter kernel? All variables will be lost.');
    DataScience.restartKernelMessageYes = localize('DataScience.restartKernelMessageYes', 'Restart');
    DataScience.restartKernelMessageNo = localize('DataScience.restartKernelMessageNo', 'Cancel');
    DataScience.restartingKernelStatus = localize('DataScience.restartingKernelStatus', 'Restarting Jupyter Kernel');
    DataScience.executingCode = localize('DataScience.executingCode', 'Executing Cell');
    DataScience.collapseAll = localize('DataScience.collapseAll', 'Collapse all cell inputs');
    DataScience.expandAll = localize('DataScience.expandAll', 'Expand all cell inputs');
    DataScience.exportKey = localize('DataScience.export', 'Export as Jupyter Notebook');
    DataScience.restartServer = localize('DataScience.restartServer', 'Restart iPython Kernel');
    DataScience.undo = localize('DataScience.undo', 'Undo');
    DataScience.redo = localize('DataScience.redo', 'Redo');
    DataScience.clearAll = localize('DataScience.clearAll', 'Remove All Cells');
})(DataScience = exports.DataScience || (exports.DataScience = {}));
// Skip using vscode-nls and instead just compute our strings based on key values. Key values
// can be loaded out of the nls.<locale>.json files
let loadedCollection;
let defaultCollection;
const askedForCollection = {};
let loadedLocale;
function localize(key, defValue) {
    // Return a pointer to function so that we refetch it on each call.
    return () => {
        return getString(key, defValue);
    };
}
exports.localize = localize;
function getCollection() {
    // Load the current collection
    if (!loadedCollection || parseLocale() !== loadedLocale) {
        load();
    }
    // Combine the default and loaded collections
    return Object.assign({}, defaultCollection, loadedCollection);
}
exports.getCollection = getCollection;
function getAskedForCollection() {
    return askedForCollection;
}
exports.getAskedForCollection = getAskedForCollection;
function parseLocale() {
    // Attempt to load from the vscode locale. If not there, use english
    const vscodeConfigString = process.env.VSCODE_NLS_CONFIG;
    return vscodeConfigString ? JSON.parse(vscodeConfigString).locale : 'en-us';
}
function getString(key, defValue) {
    // Load the current collection
    if (!loadedCollection || parseLocale() !== loadedLocale) {
        load();
    }
    // First lookup in the dictionary that matches the current locale
    if (loadedCollection && loadedCollection.hasOwnProperty(key)) {
        askedForCollection[key] = loadedCollection[key];
        return loadedCollection[key];
    }
    // Fallback to the default dictionary
    if (defaultCollection && defaultCollection.hasOwnProperty(key)) {
        askedForCollection[key] = defaultCollection[key];
        return defaultCollection[key];
    }
    // Not found, return the default
    askedForCollection[key] = defValue;
    return defValue;
}
function load() {
    // Figure out our current locale.
    loadedLocale = parseLocale();
    // Find the nls file that matches (if there is one)
    const nlsFile = path.join(constants_1.EXTENSION_ROOT_DIR, `package.nls.${loadedLocale}.json`);
    if (fs.existsSync(nlsFile)) {
        const contents = fs.readFileSync(nlsFile, 'utf8');
        loadedCollection = JSON.parse(contents);
    }
    else {
        // If there isn't one, at least remember that we looked so we don't try to load a second time
        loadedCollection = {};
    }
    // Get the default collection if necessary. Strings may be in the default or the locale json
    if (!defaultCollection) {
        const defaultNlsFile = path.join(constants_1.EXTENSION_ROOT_DIR, 'package.nls.json');
        if (fs.existsSync(defaultNlsFile)) {
            const contents = fs.readFileSync(defaultNlsFile, 'utf8');
            defaultCollection = JSON.parse(contents);
        }
        else {
            defaultCollection = {};
        }
    }
}
// Default to loading the current locale
load();
//# sourceMappingURL=localize.js.map