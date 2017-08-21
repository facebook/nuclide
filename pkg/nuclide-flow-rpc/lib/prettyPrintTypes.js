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

/**
 * This is a pretty printer that doesn't understand the actual syntax of the
 * language but just enough to figure out what groups and separators are.
 *
 * The idea is that it's going to try and pretty-print all the groups inline,
 * but if the rendered version is more than 40 characters, then write each
 * element on its own line and indent it.
 *
 * For example,
 *
 *   {editor: atom$TextEditor, position: {column: number, row: number}}
 *
 * is pretty printed as
 *
 *   {
 *     editor: atom$TextEditor,
 *     position: {column: number, row: number}
 *   }
 *
 * The group `{column: number, row: number}` is less than 40 characters so is
 * printed inline but the outer group would be more than 40 characters so each
 * element is printed line by line and indented.
 *
 * Note that this is just an heuristic that tends to work well in most cases.
 * It is not going to be perfect all the time!
 *
 * In case an input cannot be parsed based on this grammar, it's going to return
 * the input unchanged.
 */

const openGroup = '[{(<';
const closeGroup = ']})>';
const separator = ',;';

function last(arr) {
  return arr[arr.length - 1];
}

type Element = {
  start: number,
  end: number,
  groups: Array<Group>,
};

type Group = {
  elements: Array<Element>,
  openChar: string,
  closeChar: string,
  exactChar: '|' | '',
  isExact: boolean,
  start: number,
  end: number,
  parentGroup: ?Group,
};

function parseGroups(str) {
  const rootGroup: Group = {
    elements: [{
      start: 0,
      end: -1,
      groups: []
    }],
    isExact: false,
    exactChar: '',
    openChar: '',
    closeChar: '',
    start: 0,
    end: str.length - 1,
    parentGroup: null,
  };

  let currentGroup: Group = rootGroup;
  let i = 0;

  function pushGroup(isExact) {
    const group = {
      start: i,
      end: -1,
      openChar: str[i],
      closeChar: closeGroup[openGroup.indexOf(str[i])],
      exactChar: isExact ? '|' : '',
      isExact: isExact,
      elements: [],
      parentGroup: currentGroup,
    };
    if (isExact) i++;
    group.elements.push({
      start: i + 1,
      end: -1,
      groups: []
    });
    const currentElement = last(currentGroup.elements);
    currentElement.groups.push(group);
    currentGroup = group;
  }

  function popGroup() {
    const currentElement = last(currentGroup.elements);
    currentElement.end = currentGroup.isExact ? i - 1 : i;
    currentGroup.end = i + 1;
    const parentGroup = currentGroup.parentGroup;
    if (!parentGroup) {
      throw new Error("parentGroup shouldn't be null");
    }
    currentGroup = parentGroup;
  }

  function pushElement() {
    const currentElement = last(currentGroup.elements);
    currentElement.end = i + 1;
    currentGroup.elements.push({start: i + 1, end: -1, groups: []});
  }

  for (; i < str.length; ++i) {
    if (openGroup.indexOf(str[i]) !== -1) {
      pushGroup(str[i] === '{' && str[i + 1] === '|');
    }

    if (
      closeGroup.indexOf(str[i]) !== -1 &&
      currentGroup.closeChar === str[i]
    ) {
      popGroup();
    }

    if (currentGroup !== rootGroup && separator.indexOf(str[i]) !== -1) {
      pushElement();
    }
  }
  const lastElement = last(currentGroup.elements);
  lastElement.end = i;

  return rootGroup;
}

function printGroups(str, rootGroup, max) {
  function getIndent(indent) {
    if (indent < 0) {
      return '';
    }
    return '  '.repeat(indent);
  }

  function printMultiLineGroup(group, indent) {
    let output = group.openChar + group.exactChar + '\n';
    group.elements.forEach(element => {
      output += printElement(element, indent + 1, /* singleLine */ false);
    });
    output += getIndent(indent) + group.exactChar + group.closeChar;
    return output;
  }

  function printSingleLineGroupWithoutEnforcingChildren(group, indent) {
    let output = group.openChar + group.exactChar;
    group.elements.forEach(childGroup => {
      output += printElement(childGroup, indent, /* singleLine */ false).trim();
    });
    return output + group.exactChar + group.closeChar;
  }

  function printSingleLineGroup(group, indent) {
    let output = group.openChar + group.exactChar;
    group.elements.forEach(childGroup => {
      output += printElement(childGroup, indent, /* singleLine */ true);
    });
    return output + group.exactChar + group.closeChar;
  }

  function printGroup(group, indent, singleLine) {
    const singleLinePrint = printSingleLineGroup(group, indent);
    if (singleLine || singleLinePrint.length < max) {
      return singleLinePrint;
    }
    if (group.elements.length === 1) {
      return printSingleLineGroupWithoutEnforcingChildren(group, indent);
    }
    return printMultiLineGroup(group, indent);
  }

  function printElement(element, indent, singleLine) {
    let output = '';
    let current = element.start;
    element.groups.forEach(group => {
      output += str.slice(current, group.start);
      current = group.end;
      output += printGroup(group, indent, singleLine);
    });
    output += str.slice(current, element.end);
    if (singleLine) {
      return output;
    }
    return getIndent(indent) + output.trimLeft() + '\n';
  }

  return printMultiLineGroup(rootGroup, -1).slice('\n'.length, -'\n'.length);
}

function isGroupValid(group) {
  if (group.end === -1) {
    return false;
  }
  delete group.parentGroup;
  for (let i = 0; i < group.elements.length; ++i) {
    const element = group.elements[i];
    if (element.end === -1) {
      return false;
    }
    for (let j = 0; j < element.groups.length; ++j) {
      if (!isGroupValid(element.groups[j])) {
        return false;
      }
    }
  }
  return true;
}

export default function prettyPrintTypes(
  str: string,
  max: number = 40,
): string {
  const rootGroup = parseGroups(str);
  if (!isGroupValid(rootGroup)) {
    return str;
  }
  return printGroups(str, rootGroup, max);
}
