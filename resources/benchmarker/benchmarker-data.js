/**
 * Copyright (c) 2015-present, Facebook, Inc.
 * All rights reserved.
 *
 * This source code is licensed under the license found in the LICENSE file in
 * the root directory of this source tree.
 *
 * @flow
 * @format
 */

function aggregateTable(
  columns: Array<string>,
  records: Array<Object>,
  keyColumn: string,
  aggregator: (values: Array<string>, decimalPlaces: number) => string = avg,
  decimalPlaces: number = 2,
): Array<Object> {
  // Map data set into arrays of values keyed by distinct keyColumn values and columns.
  const groupedValues = {};
  records.forEach(record => {
    const key = record[keyColumn];
    if (!groupedValues[key]) {
      groupedValues[key] = {};
    }
    columns.forEach(column => {
      if (!groupedValues[key][column]) {
        groupedValues[key][column] = [];
      }
      groupedValues[key][column].push(record[column]);
    });
  });

  // Aggregate those arrays.
  const aggregatedRecords = [];
  for (const key in groupedValues) {
    const reducedRecord = {};
    columns.forEach(column => {
      if (column === keyColumn) {
        // Don't aggregate the key column.
        reducedRecord[column] = groupedValues[key][column][0];
      } else {
        reducedRecord[column] = aggregator(
          groupedValues[key][column],
          decimalPlaces,
        );
      }
    });
    aggregatedRecords.push(reducedRecord);
  }

  return aggregatedRecords;
}

function avg(values: Array<string>, decimalPlaces: number = 2): string {
  return aggregate(
    values,
    processedValues => {
      const sum = processedValues.reduce((i, j) => i + j);
      return sum / processedValues.length;
    },
    decimalPlaces,
  );
}

function aggregate(
  values: Array<string>,
  numericAggregator: (values: Array<number>) => number,
  decimalPlaces: number = 2,
): string {
  if (values.length === 0) {
    return '';
  }
  if (areAllNumeric(values)) {
    return numericAggregator(numeric(values)).toFixed(decimalPlaces);
  }
  if (areAllTheSame(values)) {
    return values[0];
  }
  return values.join(',');
}

function numeric(values: Array<string>): Array<number> {
  return values.map(value => parseFloat(value));
}

function areAllNumeric(values: Array<string>): boolean {
  return values.every(value => !isNaN(parseFloat(value)));
}

function areAllTheSame(values: Array<string>): boolean {
  return values.every(value => value === values[0]);
}

// eslint-disable-next-line rulesdir/no-commonjs
module.exports = {
  aggregateTable,
  avg,
};
