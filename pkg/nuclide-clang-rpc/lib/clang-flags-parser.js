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

type FlagStyle = 'joined' | 'separate' | 'both';
type FlagSpec = {
  name: string,
  style: FlagStyle,
};

function Flag(name: string, style: FlagStyle): FlagSpec {
  return {name, style};
}

// List of clang flags which takes path arguments.
const CLANG_FLAGS_THAT_TAKE_PATHS = [
  Flag('-F', 'both'),
  Flag('-I', 'both'),
  Flag('-include', 'both'),
  Flag('--include', 'both'),
  Flag('-include-pch', 'separate'),
  Flag('-iquote', 'both'),
  Flag('-isysroot', 'both'),
  Flag('-isystem', 'both'),
  Flag('-fmodules-cache-path=', 'joined'),
];

// Flags that takes the following argument as its parameter.
const separate = new Set();

// Flags that takes text after the prefix as its parameter.
// Represented as a map of prefix-length to prefixes.
const joinedPrefixByLength: Map<number, Set<string>> = new Map();

// Populate the data structures.
for (const flag of CLANG_FLAGS_THAT_TAKE_PATHS) {
  if (flag.style === 'both' || flag.style === 'joined') {
    const value = joinedPrefixByLength.get(flag.name.length);
    if (!value) {
      joinedPrefixByLength.set(flag.name.length, new Set([flag.name]));
    } else {
      value.add(flag.name);
    }
  }

  if (flag.style === 'both' || flag.style === 'separate') {
    separate.add(flag.name);
  }
}

// Internal helper which matches input string against known prefixes.
function matchPrefix(flag: string): ?{prefix: string, rest: string} {
  for (const [len, prefixes] of joinedPrefixByLength) {
    const prefix = flag.slice(0, len);
    if (prefixes.has(prefix)) {
      return {prefix, rest: flag.slice(len)};
    }
  }
}

/**
 * Transform every path in the input argument list using a provided function.
 *
 * @returns New array of flags in which paths are transformed.
 */
export function mapPathsInFlags(
  input: Iterable<string>,
  mapper: string => string,
): Array<string> {
  const iterator = ((input: any)[Symbol.iterator](): Iterator<string>);
  const result = [];
  while (true) {
    const entry = iterator.next();
    if (entry.done) {
      break;
    }

    // Handle separate argument case.
    if (separate.has(entry.value)) {
      // Get the next argument and treat it as a path.
      const nextEntry = iterator.next();
      result.push(entry.value);
      if (nextEntry.done) {
        // If at end, just exit.
        break;
      }
      result.push(mapper(nextEntry.value));
      continue;
    }

    // Handle joined case.
    const match = matchPrefix(entry.value);
    if (match && match.rest !== '') {
      result.push(match.prefix + mapper(match.rest));
      continue;
    }

    // Otherwise, pass it through.
    result.push(entry.value);
  }
  return result;
}
