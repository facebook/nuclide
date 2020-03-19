'use strict';
Object.defineProperty(exports, "__esModule", { value: true });
const child_process = require("child_process");
const events_1 = require("events");
const path = require("path");
const vscode_1 = require("vscode");
const telemetry_1 = require("../telemetry");
const constants_1 = require("../telemetry/constants");
const constants_2 = require("./constants");
const systemVariables_1 = require("./variables/systemVariables");
// tslint:disable-next-line:no-require-imports no-var-requires
const untildify = require('untildify');
exports.IS_WINDOWS = /^win/.test(process.platform);
// tslint:disable-next-line:completed-docs
class PythonSettings extends events_1.EventEmitter {
    constructor(workspaceFolder) {
        super();
        this.downloadLanguageServer = true;
        this.jediEnabled = true;
        this.jediPath = '';
        this.jediMemoryLimit = 1024;
        this.envFile = '';
        this.venvPath = '';
        this.venvFolders = [];
        this.condaPath = '';
        this.devOptions = [];
        this.disableInstallationChecks = false;
        this.globalModuleInstallation = false;
        this.autoUpdateLanguageServer = true;
        this.disposables = [];
        // tslint:disable-next-line:variable-name
        this._pythonPath = '';
        this.workspaceRoot = workspaceFolder ? workspaceFolder : vscode_1.Uri.file(__dirname);
        this.initialize();
    }
    // tslint:disable-next-line:function-name
    static getInstance(resource) {
        const workspaceFolderUri = PythonSettings.getSettingsUriAndTarget(resource).uri;
        const workspaceFolderKey = workspaceFolderUri ? workspaceFolderUri.fsPath : '';
        if (!PythonSettings.pythonSettings.has(workspaceFolderKey)) {
            const settings = new PythonSettings(workspaceFolderUri);
            PythonSettings.pythonSettings.set(workspaceFolderKey, settings);
            const formatOnType = vscode_1.workspace.getConfiguration('editor', resource ? resource : null).get('formatOnType', false);
            telemetry_1.sendTelemetryEvent(constants_1.COMPLETION_ADD_BRACKETS, undefined, { enabled: settings.autoComplete.addBrackets });
            telemetry_1.sendTelemetryEvent(constants_1.FORMAT_ON_TYPE, undefined, { enabled: formatOnType });
        }
        // tslint:disable-next-line:no-non-null-assertion
        return PythonSettings.pythonSettings.get(workspaceFolderKey);
    }
    // tslint:disable-next-line:type-literal-delimiter
    static getSettingsUriAndTarget(resource) {
        const workspaceFolder = resource ? vscode_1.workspace.getWorkspaceFolder(resource) : undefined;
        let workspaceFolderUri = workspaceFolder ? workspaceFolder.uri : undefined;
        if (!workspaceFolderUri && Array.isArray(vscode_1.workspace.workspaceFolders) && vscode_1.workspace.workspaceFolders.length > 0) {
            workspaceFolderUri = vscode_1.workspace.workspaceFolders[0].uri;
        }
        const target = workspaceFolderUri ? vscode_1.ConfigurationTarget.WorkspaceFolder : vscode_1.ConfigurationTarget.Global;
        return { uri: workspaceFolderUri, target };
    }
    // tslint:disable-next-line:function-name
    static dispose() {
        if (!constants_2.isTestExecution()) {
            throw new Error('Dispose can only be called from unit tests');
        }
        // tslint:disable-next-line:no-void-expression
        PythonSettings.pythonSettings.forEach(item => item.dispose());
        PythonSettings.pythonSettings.clear();
    }
    dispose() {
        // tslint:disable-next-line:no-unsafe-any
        this.disposables.forEach(disposable => disposable.dispose());
        this.disposables = [];
    }
    // tslint:disable-next-line:cyclomatic-complexity max-func-body-length
    update(pythonSettings) {
        const workspaceRoot = this.workspaceRoot.fsPath;
        const systemVariables = new systemVariables_1.SystemVariables(this.workspaceRoot ? this.workspaceRoot.fsPath : undefined);
        // tslint:disable-next-line:no-backbone-get-set-outside-model no-non-null-assertion
        this.pythonPath = systemVariables.resolveAny(pythonSettings.get('pythonPath'));
        this.pythonPath = getAbsolutePath(this.pythonPath, workspaceRoot);
        // tslint:disable-next-line:no-backbone-get-set-outside-model no-non-null-assertion
        this.venvPath = systemVariables.resolveAny(pythonSettings.get('venvPath'));
        this.venvFolders = systemVariables.resolveAny(pythonSettings.get('venvFolders'));
        const condaPath = systemVariables.resolveAny(pythonSettings.get('condaPath'));
        this.condaPath = condaPath && condaPath.length > 0 ? getAbsolutePath(condaPath, workspaceRoot) : condaPath;
        this.downloadLanguageServer = systemVariables.resolveAny(pythonSettings.get('downloadLanguageServer', true));
        this.jediEnabled = systemVariables.resolveAny(pythonSettings.get('jediEnabled', true));
        this.autoUpdateLanguageServer = systemVariables.resolveAny(pythonSettings.get('autoUpdateLanguageServer', true));
        if (this.jediEnabled) {
            // tslint:disable-next-line:no-backbone-get-set-outside-model no-non-null-assertion
            this.jediPath = systemVariables.resolveAny(pythonSettings.get('jediPath'));
            if (typeof this.jediPath === 'string' && this.jediPath.length > 0) {
                this.jediPath = getAbsolutePath(systemVariables.resolveAny(this.jediPath), workspaceRoot);
            }
            else {
                this.jediPath = '';
            }
            this.jediMemoryLimit = pythonSettings.get('jediMemoryLimit');
        }
        // tslint:disable-next-line:no-backbone-get-set-outside-model no-non-null-assertion
        this.envFile = systemVariables.resolveAny(pythonSettings.get('envFile'));
        // tslint:disable-next-line:no-any
        // tslint:disable-next-line:no-backbone-get-set-outside-model no-non-null-assertion no-any
        this.devOptions = systemVariables.resolveAny(pythonSettings.get('devOptions'));
        this.devOptions = Array.isArray(this.devOptions) ? this.devOptions : [];
        // tslint:disable-next-line:no-backbone-get-set-outside-model no-non-null-assertion
        const lintingSettings = systemVariables.resolveAny(pythonSettings.get('linting'));
        if (this.linting) {
            Object.assign(this.linting, lintingSettings);
        }
        else {
            this.linting = lintingSettings;
        }
        // tslint:disable-next-line:no-backbone-get-set-outside-model no-non-null-assertion
        const analysisSettings = systemVariables.resolveAny(pythonSettings.get('analysis'));
        if (this.analysis) {
            Object.assign(this.analysis, analysisSettings);
        }
        else {
            this.analysis = analysisSettings;
        }
        this.disableInstallationChecks = pythonSettings.get('disableInstallationCheck') === true;
        this.globalModuleInstallation = pythonSettings.get('globalModuleInstallation') === true;
        // tslint:disable-next-line:no-backbone-get-set-outside-model no-non-null-assertion
        const sortImportSettings = systemVariables.resolveAny(pythonSettings.get('sortImports'));
        if (this.sortImports) {
            Object.assign(this.sortImports, sortImportSettings);
        }
        else {
            this.sortImports = sortImportSettings;
        }
        // Support for travis.
        this.sortImports = this.sortImports ? this.sortImports : { path: '', args: [] };
        // Support for travis.
        this.linting = this.linting ? this.linting : {
            enabled: false,
            ignorePatterns: [],
            flake8Args: [], flake8Enabled: false, flake8Path: 'flake',
            lintOnSave: false, maxNumberOfProblems: 100,
            mypyArgs: [], mypyEnabled: false, mypyPath: 'mypy',
            banditArgs: [], banditEnabled: false, banditPath: 'bandit',
            pep8Args: [], pep8Enabled: false, pep8Path: 'pep8',
            pylamaArgs: [], pylamaEnabled: false, pylamaPath: 'pylama',
            prospectorArgs: [], prospectorEnabled: false, prospectorPath: 'prospector',
            pydocstyleArgs: [], pydocstyleEnabled: false, pydocstylePath: 'pydocstyle',
            pylintArgs: [], pylintEnabled: false, pylintPath: 'pylint',
            pylintCategorySeverity: {
                convention: vscode_1.DiagnosticSeverity.Hint,
                error: vscode_1.DiagnosticSeverity.Error,
                fatal: vscode_1.DiagnosticSeverity.Error,
                refactor: vscode_1.DiagnosticSeverity.Hint,
                warning: vscode_1.DiagnosticSeverity.Warning
            },
            pep8CategorySeverity: {
                E: vscode_1.DiagnosticSeverity.Error,
                W: vscode_1.DiagnosticSeverity.Warning
            },
            flake8CategorySeverity: {
                E: vscode_1.DiagnosticSeverity.Error,
                W: vscode_1.DiagnosticSeverity.Warning,
                // Per http://flake8.pycqa.org/en/latest/glossary.html#term-error-code
                // 'F' does not mean 'fatal as in PyLint but rather 'pyflakes' such as
                // unused imports, variables, etc.
                F: vscode_1.DiagnosticSeverity.Warning
            },
            mypyCategorySeverity: {
                error: vscode_1.DiagnosticSeverity.Error,
                note: vscode_1.DiagnosticSeverity.Hint
            },
            pylintUseMinimalCheckers: false
        };
        this.linting.pylintPath = getAbsolutePath(systemVariables.resolveAny(this.linting.pylintPath), workspaceRoot);
        this.linting.flake8Path = getAbsolutePath(systemVariables.resolveAny(this.linting.flake8Path), workspaceRoot);
        this.linting.pep8Path = getAbsolutePath(systemVariables.resolveAny(this.linting.pep8Path), workspaceRoot);
        this.linting.pylamaPath = getAbsolutePath(systemVariables.resolveAny(this.linting.pylamaPath), workspaceRoot);
        this.linting.prospectorPath = getAbsolutePath(systemVariables.resolveAny(this.linting.prospectorPath), workspaceRoot);
        this.linting.pydocstylePath = getAbsolutePath(systemVariables.resolveAny(this.linting.pydocstylePath), workspaceRoot);
        this.linting.mypyPath = getAbsolutePath(systemVariables.resolveAny(this.linting.mypyPath), workspaceRoot);
        this.linting.banditPath = getAbsolutePath(systemVariables.resolveAny(this.linting.banditPath), workspaceRoot);
        // tslint:disable-next-line:no-backbone-get-set-outside-model no-non-null-assertion
        const formattingSettings = systemVariables.resolveAny(pythonSettings.get('formatting'));
        if (this.formatting) {
            Object.assign(this.formatting, formattingSettings);
        }
        else {
            this.formatting = formattingSettings;
        }
        // Support for travis.
        this.formatting = this.formatting ? this.formatting : {
            autopep8Args: [], autopep8Path: 'autopep8',
            provider: 'autopep8',
            blackArgs: [], blackPath: 'black',
            yapfArgs: [], yapfPath: 'yapf'
        };
        this.formatting.autopep8Path = getAbsolutePath(systemVariables.resolveAny(this.formatting.autopep8Path), workspaceRoot);
        this.formatting.yapfPath = getAbsolutePath(systemVariables.resolveAny(this.formatting.yapfPath), workspaceRoot);
        this.formatting.blackPath = getAbsolutePath(systemVariables.resolveAny(this.formatting.blackPath), workspaceRoot);
        // tslint:disable-next-line:no-backbone-get-set-outside-model no-non-null-assertion
        const autoCompleteSettings = systemVariables.resolveAny(pythonSettings.get('autoComplete'));
        if (this.autoComplete) {
            Object.assign(this.autoComplete, autoCompleteSettings);
        }
        else {
            this.autoComplete = autoCompleteSettings;
        }
        // Support for travis.
        this.autoComplete = this.autoComplete ? this.autoComplete : {
            extraPaths: [],
            addBrackets: false,
            showAdvancedMembers: false,
            typeshedPaths: []
        };
        // tslint:disable-next-line:no-backbone-get-set-outside-model no-non-null-assertion
        const workspaceSymbolsSettings = systemVariables.resolveAny(pythonSettings.get('workspaceSymbols'));
        if (this.workspaceSymbols) {
            Object.assign(this.workspaceSymbols, workspaceSymbolsSettings);
        }
        else {
            this.workspaceSymbols = workspaceSymbolsSettings;
        }
        // Support for travis.
        this.workspaceSymbols = this.workspaceSymbols ? this.workspaceSymbols : {
            ctagsPath: 'ctags',
            enabled: true,
            exclusionPatterns: [],
            rebuildOnFileSave: true,
            rebuildOnStart: true,
            tagFilePath: path.join(workspaceRoot, 'tags')
        };
        this.workspaceSymbols.tagFilePath = getAbsolutePath(systemVariables.resolveAny(this.workspaceSymbols.tagFilePath), workspaceRoot);
        // tslint:disable-next-line:no-backbone-get-set-outside-model no-non-null-assertion
        const unitTestSettings = systemVariables.resolveAny(pythonSettings.get('unitTest'));
        if (this.unitTest) {
            Object.assign(this.unitTest, unitTestSettings);
        }
        else {
            this.unitTest = unitTestSettings;
            if (constants_2.isTestExecution() && !this.unitTest) {
                // tslint:disable-next-line:prefer-type-cast
                // tslint:disable-next-line:no-object-literal-type-assertion
                this.unitTest = {
                    nosetestArgs: [], pyTestArgs: [], unittestArgs: [],
                    promptToConfigure: true, debugPort: 3000,
                    nosetestsEnabled: false, pyTestEnabled: false, unittestEnabled: false,
                    nosetestPath: 'nosetests', pyTestPath: 'pytest', autoTestDiscoverOnSaveEnabled: true
                };
            }
        }
        // Support for travis.
        this.unitTest = this.unitTest ? this.unitTest : {
            promptToConfigure: true,
            debugPort: 3000,
            nosetestArgs: [], nosetestPath: 'nosetest', nosetestsEnabled: false,
            pyTestArgs: [], pyTestEnabled: false, pyTestPath: 'pytest',
            unittestArgs: [], unittestEnabled: false, autoTestDiscoverOnSaveEnabled: true
        };
        this.unitTest.pyTestPath = getAbsolutePath(systemVariables.resolveAny(this.unitTest.pyTestPath), workspaceRoot);
        this.unitTest.nosetestPath = getAbsolutePath(systemVariables.resolveAny(this.unitTest.nosetestPath), workspaceRoot);
        if (this.unitTest.cwd) {
            this.unitTest.cwd = getAbsolutePath(systemVariables.resolveAny(this.unitTest.cwd), workspaceRoot);
        }
        // Resolve any variables found in the test arguments.
        this.unitTest.nosetestArgs = this.unitTest.nosetestArgs.map(arg => systemVariables.resolveAny(arg));
        this.unitTest.pyTestArgs = this.unitTest.pyTestArgs.map(arg => systemVariables.resolveAny(arg));
        this.unitTest.unittestArgs = this.unitTest.unittestArgs.map(arg => systemVariables.resolveAny(arg));
        // tslint:disable-next-line:no-backbone-get-set-outside-model no-non-null-assertion
        const terminalSettings = systemVariables.resolveAny(pythonSettings.get('terminal'));
        if (this.terminal) {
            Object.assign(this.terminal, terminalSettings);
        }
        else {
            this.terminal = terminalSettings;
            if (constants_2.isTestExecution() && !this.terminal) {
                // tslint:disable-next-line:prefer-type-cast
                // tslint:disable-next-line:no-object-literal-type-assertion
                this.terminal = {};
            }
        }
        // Support for travis.
        this.terminal = this.terminal ? this.terminal : {
            executeInFileDir: true,
            launchArgs: [],
            activateEnvironment: true
        };
        const dataScienceSettings = systemVariables.resolveAny(pythonSettings.get('dataScience'));
        if (this.datascience) {
            Object.assign(this.datascience, dataScienceSettings);
        }
        else {
            this.datascience = dataScienceSettings;
        }
    }
    get pythonPath() {
        return this._pythonPath;
    }
    set pythonPath(value) {
        if (this._pythonPath === value) {
            return;
        }
        // Add support for specifying just the directory where the python executable will be located.
        // E.g. virtual directory name.
        try {
            this._pythonPath = getPythonExecutable(value);
        }
        catch (ex) {
            this._pythonPath = value;
        }
    }
    initialize() {
        this.disposables.push(vscode_1.workspace.onDidChangeConfiguration(() => {
            const currentConfig = vscode_1.workspace.getConfiguration('python', this.workspaceRoot);
            this.update(currentConfig);
            // If workspace config changes, then we could have a cascading effect of on change events.
            // Let's defer the change notification.
            setTimeout(() => this.emit('change'), 1);
        }));
        const initialConfig = vscode_1.workspace.getConfiguration('python', this.workspaceRoot);
        this.update(initialConfig);
    }
}
PythonSettings.pythonSettings = new Map();
exports.PythonSettings = PythonSettings;
function getAbsolutePath(pathToCheck, rootDir) {
    // tslint:disable-next-line:prefer-type-cast no-unsafe-any
    pathToCheck = untildify(pathToCheck);
    if (constants_2.isTestExecution() && !pathToCheck) {
        return rootDir;
    }
    if (pathToCheck.indexOf(path.sep) === -1) {
        return pathToCheck;
    }
    return path.isAbsolute(pathToCheck) ? pathToCheck : path.resolve(rootDir, pathToCheck);
}
function getPythonExecutable(pythonPath) {
    // tslint:disable-next-line:prefer-type-cast no-unsafe-any
    pythonPath = untildify(pythonPath);
    // If only 'python'.
    if (pythonPath === 'python' ||
        pythonPath.indexOf(path.sep) === -1 ||
        path.basename(pythonPath) === path.dirname(pythonPath)) {
        return pythonPath;
    }
    if (isValidPythonPath(pythonPath)) {
        return pythonPath;
    }
    // Keep python right on top, for backwards compatibility.
    // tslint:disable-next-line:variable-name
    const KnownPythonExecutables = ['python', 'python4', 'python3.6', 'python3.5', 'python3', 'python2.7', 'python2'];
    for (let executableName of KnownPythonExecutables) {
        // Suffix with 'python' for linux and 'osx', and 'python.exe' for 'windows'.
        if (exports.IS_WINDOWS) {
            executableName = `${executableName}.exe`;
            if (isValidPythonPath(path.join(pythonPath, executableName))) {
                return path.join(pythonPath, executableName);
            }
            if (isValidPythonPath(path.join(pythonPath, 'scripts', executableName))) {
                return path.join(pythonPath, 'scripts', executableName);
            }
        }
        else {
            if (isValidPythonPath(path.join(pythonPath, executableName))) {
                return path.join(pythonPath, executableName);
            }
            if (isValidPythonPath(path.join(pythonPath, 'bin', executableName))) {
                return path.join(pythonPath, 'bin', executableName);
            }
        }
    }
    return pythonPath;
}
function isValidPythonPath(pythonPath) {
    try {
        const output = child_process.execFileSync(pythonPath, ['-c', 'print(1234)'], { encoding: 'utf8' });
        return output.startsWith('1234');
    }
    catch (ex) {
        return false;
    }
}
//# sourceMappingURL=configSettings.js.map