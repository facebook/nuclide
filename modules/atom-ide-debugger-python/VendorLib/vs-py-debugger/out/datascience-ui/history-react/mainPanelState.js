// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.
'use strict';
Object.defineProperty(exports, "__esModule", { value: true });
const types_1 = require("../../client/datascience/types");
const cell_1 = require("./cell");
// This function generates test state when running under a browser instead of inside of
function generateTestState(inputBlockToggled) {
    return {
        cellVMs: generateVMs(inputBlockToggled),
        busy: true,
        skipNextScroll: false,
        undoStack: [],
        redoStack: []
    };
}
exports.generateTestState = generateTestState;
function createCellVM(inputCell, inputBlockToggled) {
    let inputLinesCount = 0;
    let source = inputCell.data.cell_type === 'code' ? inputCell.data.source : [];
    // Eliminate the #%% on the front if it has nothing else on the line
    if (source.length > 0 && /^\s*#\s*%%\s*$/.test(source[0].trim())) {
        source = source.slice(1);
    }
    const inputText = inputCell.data.cell_type === 'code' ? cell_1.Cell.concatMultilineString(source) : '';
    if (inputText) {
        inputLinesCount = inputText.split('\n').length;
    }
    return {
        cell: inputCell,
        inputBlockOpen: true,
        inputBlockText: inputText,
        inputBlockCollapseNeeded: inputLinesCount > 1,
        inputBlockToggled: inputBlockToggled
    };
}
exports.createCellVM = createCellVM;
function generateVMs(inputBlockToggled) {
    const cells = generateCells();
    return cells.map((cell) => {
        return createCellVM(cell, inputBlockToggled);
    });
}
function generateCells() {
    const cellData = generateCellData();
    return cellData.map((data, key) => {
        return {
            id: key.toString(),
            file: 'foo.py',
            line: 1,
            state: key === cellData.length - 1 ? types_1.CellState.executing : types_1.CellState.finished,
            data: data
        };
    });
}
function generateCellData() {
    // Hopefully new entries here can just be copied out of a jupyter notebook (ipynb)
    return [
        {
            cell_type: 'code',
            execution_count: 4,
            metadata: {
                slideshow: {
                    slide_type: '-'
                }
            },
            outputs: [
                {
                    data: {
                        'text/plain': [
                            '   num_preg  glucose_conc  diastolic_bp  thickness  insulin   bmi  diab_pred  \\\n',
                            '0         6           148            72         35        0  33.6      0.627   \n',
                            '1         1            85            66         29        0  26.6      0.351   \n',
                            '2         8           183            64          0        0  23.3      0.672   \n',
                            '3         1            89            66         23       94  28.1      0.167   \n',
                            '4         0           137            40         35      168  43.1      2.288   \n',
                            '\n',
                            '   age    skin  diabetes  \n',
                            '0   50  1.3790      True  \n',
                            '1   31  1.1426     False  \n',
                            '2   32  0.0000      True  \n',
                            '3   21  0.9062     False  \n',
                            '4   33  1.3790      True  super long line that should wrap around but it isnt because we didnt put in the correct css super long line that should wrap around but it isnt because we didnt put in the correct css super long line that should wrap around but it isnt because we didnt put in the correct css'
                        ]
                    },
                    execution_count: 4,
                    metadata: {},
                    output_type: 'execute_result'
                }
            ],
            source: [
                '# comment',
                'df',
                'df.head(5)'
            ]
        },
        {
            cell_type: 'markdown',
            metadata: {},
            source: [
                '## Cell 3\n',
                'Here\'s some markdown\n',
                '- A List\n',
                '- Of Items'
            ]
        },
        {
            cell_type: 'code',
            execution_count: 1,
            metadata: {},
            outputs: [
                {
                    ename: 'NameError',
                    evalue: 'name "df" is not defined',
                    output_type: 'error',
                    traceback: [
                        '\u001b[1;31m---------------------------------------------------------------------------\u001b[0m',
                        '\u001b[1;31mNameError\u001b[0m                                 Traceback (most recent call last)',
                        '\u001b[1;32m<ipython-input-1-00cf07b74dcd>\u001b[0m in \u001b[0;36m<module>\u001b[1;34m()\u001b[0m\n\u001b[1;32m----> 1\u001b[1;33m \u001b[0mdf\u001b[0m\u001b[1;33m\u001b[0m\u001b[0m\n\u001b[0m',
                        '\u001b[1;31mNameError\u001b[0m: name "df" is not defined'
                    ]
                }
            ],
            source: [
                'df'
            ]
        },
        {
            cell_type: 'code',
            execution_count: 1,
            metadata: {},
            outputs: [
                {
                    ename: 'NameError',
                    evalue: 'name "df" is not defined',
                    output_type: 'error',
                    traceback: [
                        '\u001b[1;31m---------------------------------------------------------------------------\u001b[0m',
                        '\u001b[1;31mNameError\u001b[0m                                 Traceback (most recent call last)',
                        '\u001b[1;32m<ipython-input-1-00cf07b74dcd>\u001b[0m in \u001b[0;36m<module>\u001b[1;34m()\u001b[0m\n\u001b[1;32m----> 1\u001b[1;33m \u001b[0mdf\u001b[0m\u001b[1;33m\u001b[0m\u001b[0m\n\u001b[0m',
                        '\u001b[1;31mNameError\u001b[0m: name "df" is not defined'
                    ]
                }
            ],
            source: [
                'df'
            ]
        }
    ];
}
//# sourceMappingURL=mainPanelState.js.map