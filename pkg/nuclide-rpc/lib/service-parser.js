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

import invariant from 'assert';

import type {
  Definition,
  FunctionDefinition,
  AliasDefinition,
  Definitions,
  Parameter,
  FunctionType,
  InterfaceDefinition,
  Type,
  Location,
  SourceLocation,
  Babel$Node,
} from './types';

import * as babylon from 'babylon';
import {namedBuiltinTypes} from './builtin-types';
import {locationToString} from './location';
import {validateDefinitions} from './DefinitionValidator';
import resolveFrom from 'resolve-from';
import nuclideUri from 'nuclide-commons/nuclideUri';
import fs from 'fs';

function isPrivateMemberName(name: string): boolean {
  return name.startsWith('_');
}

/**
 * Parse a definition file, returning an intermediate representation that has all of the
 * information required to generate the remote proxy, as well as marshal and unmarshal the
 * data over a network.
 * @param source - The string source of the definition file.
 */
export function parseServiceDefinition(
  fileName: string,
  source: string,
  predefinedTypes: Array<string>,
): Definitions {
  return new ServiceParser(predefinedTypes).parseService(fileName, source);
}

class ServiceParser {
  _defs: Definitions;
  _filesTodo: Array<string>;
  _filesSeen: Set<string>;

  constructor(predefinedTypes: Array<string>) {
    this._defs = {};
    this._filesTodo = [];
    this._filesSeen = new Set();

    // Add all builtin types
    const defineBuiltinType = name => {
      invariant(!this._defs.hasOwnProperty(name), 'Duplicate builtin type');
      this._defs[name] = {
        kind: 'alias',
        name,
        location: {type: 'builtin'},
      };
    };
    namedBuiltinTypes.forEach(defineBuiltinType);
    predefinedTypes.forEach(defineBuiltinType);
  }

  parseService(fileName: string, source: string): Definitions {
    this._filesSeen.add(fileName);

    this._parseFile(fileName, 'service', source);

    while (this._filesTodo.length > 0) {
      const file = this._filesTodo.pop();
      const contents = fs.readFileSync(file, 'utf8');
      this._parseFile(file, 'import', contents);
    }

    validateDefinitions(this._defs);

    return this._defs;
  }

  _parseFile(fileName: string, fileType: FileType, source: string): void {
    const parser = new FileParser(fileName, fileType, this._defs);
    const imports = parser.parse(source);
    for (const imp of imports) {
      const resolvedFrom = resolveFrom(nuclideUri.dirname(fileName), imp);

      if (!this._filesSeen.has(resolvedFrom)) {
        this._filesSeen.add(resolvedFrom);
        this._filesTodo.push(resolvedFrom);
      }
    }
  }
}

type Import = {
  imported: string,
  file: string,
  added: boolean,
  location: Location,
};

type FileType = 'import' | 'service';

class FileParser {
  _fileType: FileType;
  _fileName: string;
  _defs: Definitions;
  // Maps type names to the imported name and file that they are imported from.
  _imports: {[name: string]: Import};
  // Set of files required by imports
  _importsUsed: Set<string>;

  constructor(fileName: string, fileType: FileType, defs: Definitions) {
    this._fileType = fileType;
    this._fileName = fileName;
    this._defs = defs;
    this._imports = {};
    this._importsUsed = new Set();
  }

  _locationOfNode(node: any): SourceLocation {
    return {
      type: 'source',
      fileName: this._fileName,
      line: node.loc.start.line,
    };
  }

  _nodeLocationString(node: Babel$Node): string {
    return `${this._fileName}(${node.loc.start.line})`;
  }

  _errorLocations(locations: Array<Location>, message: string): Error {
    let fullMessage = `${locationToString(locations[0])}:${message}`;
    fullMessage = fullMessage.concat(
      ...locations
        .slice(1)
        .map(location => `\n${locationToString(location)}: Related location`),
    );
    return new Error(fullMessage);
  }

  _error(node: Babel$Node, message: string): Error {
    return new Error(`${this._nodeLocationString(node)}:${message}`);
  }

  _assert(node, condition, message): void {
    if (!condition) {
      throw this._error(node, message);
    }
  }

  // Returns set of imported files required.
  // The file names returned are relative to the file being parsed.
  parse(source: string): Set<string> {
    this._imports = {};

    const ast = babylon.parse(source, {
      sourceType: 'module',
      plugins: ['*', 'jsx', 'flow'],
    });
    const program = ast.program;
    invariant(
      program && program.type === 'Program',
      'The result of parsing is a Program node.',
    );

    // Iterate through each node in the program body.
    for (const node of program.body) {
      // We're specifically looking for exports.
      switch (node.type) {
        case 'ExportNamedDeclaration':
          this._parseExport(node);
          break;

        case 'ImportDeclaration':
          this._parseImport(node);
          break;

        default:
          // Ignore all non-export top level program elements including:
          // imports, statements, variable declarations, function declarations
          break;
      }
    }

    return this._importsUsed;
  }

  _parseExport(node: Object): void {
    invariant(node.type === 'ExportNamedDeclaration');
    const declaration = node.declaration;
    switch (declaration.type) {
      // An exported function that can be directly called by a client.
      case 'FunctionDeclaration':
        if (!isPrivateMemberName(declaration.id.name)) {
          this._add(this._parseFunctionDeclaration(declaration));
        }
        break;
      // An exported type alias.
      case 'TypeAlias':
        if (!isPrivateMemberName(declaration.id.name)) {
          this._add(this._parseTypeAlias(declaration));
        }
        break;
      // Parse classes as remotable interfaces.
      case 'ClassDeclaration':
        this._add(this._parseClassDeclaration(declaration));
        break;
      case 'InterfaceDeclaration':
        this._add(this._parseInterfaceDeclaration(declaration));
        break;
      case 'VariableDeclaration':
        // Ignore exported variables.
        break;
      // Unknown export declaration.
      default:
        throw this._error(
          declaration,
          `Unknown declaration type ${declaration.type} in definition body.`,
        );
    }
  }

  _parseImport(node: Object): void {
    const from = node.source.value;

    invariant(typeof from === 'string');

    for (const specifier of node.specifiers) {
      if (specifier.type === 'ImportSpecifier') {
        const imported = specifier.imported.name;
        const local = specifier.local.name;
        this._imports[local] = {
          imported,
          file: from,
          added: false,
          location: this._locationOfNode(specifier),
        };
      }
    }
  }

  _add(definition: Definition): void {
    if (this._defs.hasOwnProperty(definition.name)) {
      const existingDef = this._defs[definition.name];
      invariant(existingDef != null);
      throw this._errorLocations(
        [definition.location, existingDef.location],
        `Duplicate definition for ${definition.name}`,
      );
    } else {
      this._defs[definition.name] = definition;
    }
  }

  /**
   * Helper function that parses an exported function declaration, and returns the function name,
   * along with a FunctionType object that encodes the argument and return types of the function.
   */
  _parseFunctionDeclaration(declaration: any): FunctionDefinition {
    if (this._fileType === 'import') {
      throw this._error(declaration, 'Exported function in imported RPC file');
    }

    this._assert(
      declaration,
      declaration.id && declaration.id.type === 'Identifier',
      'Remote function declarations must have an identifier.',
    );
    this._assert(
      declaration,
      declaration.returnType != null &&
        declaration.returnType.type === 'TypeAnnotation',
      'Remote functions must be annotated with a return type.',
    );

    const returnType = this._parseTypeAnnotation(
      declaration.returnType.typeAnnotation,
    );

    return {
      kind: 'function',
      name: declaration.id.name,
      location: this._locationOfNode(declaration),
      type: {
        location: this._locationOfNode(declaration),
        kind: 'function',
        argumentTypes: declaration.params.map(param =>
          this._parseParameter(param),
        ),
        returnType,
      },
    };
  }

  /**
   * Helper function that parses an exported type alias, and returns the name of the alias,
   * along with the type that it refers to.
   */
  _parseTypeAlias(declaration: any): AliasDefinition {
    this._assert(
      declaration,
      declaration.type === 'TypeAlias',
      'parseTypeAlias accepts a TypeAlias node.',
    );
    return {
      kind: 'alias',
      location: this._locationOfNode(declaration),
      name: declaration.id.name,
      definition: this._parseTypeAnnotation(declaration.right),
    };
  }

  /**
   * Parse a ClassDeclaration AST Node.
   * @param declaration - The AST node.
   */
  _parseClassDeclaration(declaration: Object): InterfaceDefinition {
    if (this._fileType === 'import') {
      throw this._error(declaration, 'Exported class in imported RPC file');
    }

    const def: InterfaceDefinition = {
      kind: 'interface',
      name: declaration.id.name,
      location: this._locationOfNode(declaration),
      constructorArgs: [],
      staticMethods: {},
      instanceMethods: {},
    };

    const classBody = declaration.body;
    for (const method of classBody.body) {
      if (method.kind === 'constructor') {
        def.constructorArgs = method.params.map(param =>
          this._parseParameter(param),
        );
        if (method.returnType) {
          throw this._error(method, 'constructors may not have return types');
        }
      } else {
        if (!isPrivateMemberName(method.key.name)) {
          const {name, type} = this._parseClassMethod(method);
          const isStatic = Boolean(method.static);
          this._validateMethod(method, name, type, isStatic);
          this._defineMethod(
            name,
            type,
            isStatic ? def.staticMethods : def.instanceMethods,
          );
        }
      }
    }
    if (!def.instanceMethods.hasOwnProperty('dispose')) {
      throw this._error(
        declaration,
        'Remotable interfaces must include a dispose method',
      );
    }
    return def;
  }

  _validateMethod(
    node: Babel$Node,
    name: string,
    type: FunctionType,
    isStatic: boolean,
  ): void {
    if (name === 'dispose' && !isStatic) {
      // Validate dispose method has a reasonable signature
      if (type.argumentTypes.length > 0) {
        throw this._error(node, 'dispose method may not take arguments');
      }
      if (!isValidDisposeReturnType(type.returnType)) {
        throw this._error(
          node,
          'dispose method must return either void or Promise<void>',
        );
      }
    }
  }

  /**
   * Parse a InterfaceDeclaration AST Node.
   * @param declaration - The AST node.
   */
  _parseInterfaceDeclaration(declaration: Object): InterfaceDefinition {
    const def: InterfaceDefinition = {
      kind: 'interface',
      name: declaration.id.name,
      location: this._locationOfNode(declaration),
      constructorArgs: null,
      staticMethods: {},
      instanceMethods: {},
    };

    invariant(declaration.body.type === 'ObjectTypeAnnotation');
    const properties = declaration.body.properties;
    for (const property of properties) {
      invariant(property.type === 'ObjectTypeProperty');

      if (!isPrivateMemberName(property.key.name)) {
        const {name, type} = this._parseInterfaceClassMethod(property);
        invariant(
          !property.static,
          'static interface members are a parse error',
        );
        this._validateMethod(property, name, type, false);
        this._defineMethod(name, type, def.instanceMethods);
      }
    }
    if (!def.instanceMethods.hasOwnProperty('dispose')) {
      throw this._error(
        declaration,
        'Remotable interfaces must include a dispose method',
      );
    }
    return def;
  }

  _defineMethod(
    name: string,
    type: FunctionType,
    peers: {[name: string]: FunctionType},
  ): void {
    if (peers.hasOwnProperty(name)) {
      const peer = peers[name];
      throw this._errorLocations(
        [type.location, peer.location],
        `Duplicate method definition ${name}`,
      );
    } else {
      peers[name] = type;
    }
  }

  /**
   * Helper function that parses an method definition in a class.
   * @param defintion - The ClassMethod AST node.
   * @returns A record containing the name of the method, and a FunctionType object
   *   encoding the arguments and return type of the method.
   */
  _parseClassMethod(definition: any): {name: string, type: FunctionType} {
    this._assert(
      definition,
      definition.type === 'ClassMethod',
      'This is a ClassMethod object.',
    );
    this._assert(
      definition,
      definition.key && definition.key.type === 'Identifier',
      'This method defintion has an key (a name).',
    );
    this._assert(
      definition,
      definition.returnType && definition.returnType.type === 'TypeAnnotation',
      `${definition.key.name} missing a return type annotation.`,
    );

    const returnType = this._parseTypeAnnotation(
      definition.returnType.typeAnnotation,
    );
    return {
      location: this._locationOfNode(definition.key),
      name: definition.key.name,
      type: {
        location: this._locationOfNode(definition),
        kind: 'function',
        argumentTypes: definition.params.map(param =>
          this._parseParameter(param),
        ),
        returnType,
      },
    };
  }

  /**
   * Parses an method definition in an interface.
   * Note that interface method definitions are slightly different structure to class methods.
   * @param defintion - The ObjectTypeProperty AST node.
   * @returns A record containing the name of the method, and a FunctionType object
   *   encoding the arguments and return type of the method.
   */
  _parseInterfaceClassMethod(
    definition: any,
  ): {name: string, type: FunctionType} {
    this._assert(
      definition,
      definition.type === 'ObjectTypeProperty',
      'This is a ObjectTypeProperty object.',
    );
    this._assert(
      definition,
      definition.key && definition.key.type === 'Identifier',
      'This method definition has an key (a name).',
    );
    this._assert(
      definition,
      definition.value.returnType != null,
      `${definition.key.name} missing a return type annotation.`,
    );
    const returnType = this._parseTypeAnnotation(definition.value.returnType);
    invariant(typeof definition.key.name === 'string');
    invariant(typeof definition.optional === 'boolean');
    if (definition.optional) {
      throw this._error(
        definition,
        `${definition.key.name} optional interface methods are not supported.`,
      );
    }
    return {
      location: this._locationOfNode(definition.key),
      name: definition.key.name,
      type: {
        location: this._locationOfNode(definition.value),
        kind: 'function',
        argumentTypes: definition.value.params.map(param =>
          this._parseInterfaceParameter(param),
        ),
        returnType,
      },
    };
  }

  _parseInterfaceParameter(param: Object): Parameter {
    if (!param.typeAnnotation) {
      throw this._error(
        param,
        `Parameter ${param.name} doesn't have type annotation.`,
      );
    } else {
      const name = param.name.name;
      invariant(typeof name === 'string');
      const type = this._parseTypeAnnotation(param.typeAnnotation);
      if (param.optional && type.kind !== 'nullable') {
        return {
          name,
          type: {
            kind: 'nullable',
            type,
          },
        };
      } else {
        return {
          name,
          type,
        };
      }
    }
  }

  _parseParameter(param: Object): Parameter {
    // Parameter with a default type, e.g. (x: number = 1).
    // Babel's transpiled implementation will take care of actually setting the default.
    if (param.type === 'AssignmentPattern') {
      return this._parseParameter({
        ...param.left,
        // Having a default value implies that it's optional.
        optional: true,
      });
    }

    if (!param.typeAnnotation) {
      throw this._error(
        param,
        `Parameter ${param.name} doesn't have type annotation.`,
      );
    } else {
      const name = param.name;
      const type = this._parseTypeAnnotation(
        param.typeAnnotation.typeAnnotation,
      );
      if (param.optional && type.kind !== 'nullable') {
        return {
          name,
          type: {
            kind: 'nullable',
            type,
          },
        };
      } else {
        return {
          name,
          type,
        };
      }
    }
  }

  /**
   * Helper function that parses a Flow type annotation into our intermediate format.
   * @returns {Type} A representation of the type.
   */
  _parseTypeAnnotation(typeAnnotation: Object): Type {
    switch (typeAnnotation.type) {
      case 'AnyTypeAnnotation':
        return {kind: 'any'};
      case 'MixedTypeAnnotation':
        return {kind: 'mixed'};
      case 'StringTypeAnnotation':
        return {kind: 'string'};
      case 'NumberTypeAnnotation':
        return {kind: 'number'};
      case 'BooleanTypeAnnotation':
        return {kind: 'boolean'};
      case 'StringLiteralTypeAnnotation':
        return {kind: 'string-literal', value: typeAnnotation.value};
      case 'NumericLiteralTypeAnnotation':
        return {kind: 'number-literal', value: typeAnnotation.value};
      case 'BooleanLiteralTypeAnnotation':
        return {kind: 'boolean-literal', value: typeAnnotation.value};
      case 'NullableTypeAnnotation':
        return {
          kind: 'nullable',
          type: this._parseTypeAnnotation(typeAnnotation.typeAnnotation),
        };
      case 'ObjectTypeAnnotation':
        return {
          kind: 'object',
          fields: typeAnnotation.properties.map(prop => {
            invariant(prop.type === 'ObjectTypeProperty');
            return {
              name: prop.key.name,
              type: this._parseTypeAnnotation(prop.value),
              optional: prop.optional,
            };
          }),
        };
      case 'VoidTypeAnnotation':
        return {kind: 'void'};
      case 'TupleTypeAnnotation':
        return {
          kind: 'tuple',
          types: typeAnnotation.types.map(this._parseTypeAnnotation.bind(this)),
        };
      case 'UnionTypeAnnotation':
        return {
          kind: 'union',
          types: typeAnnotation.types.map(this._parseTypeAnnotation.bind(this)),
        };
      case 'IntersectionTypeAnnotation':
        return {
          kind: 'intersection',
          types: typeAnnotation.types.map(this._parseTypeAnnotation.bind(this)),
        };
      case 'GenericTypeAnnotation':
        return this._parseGenericTypeAnnotation(typeAnnotation);
      case 'FunctionTypeAnnotation':
        throw this._error(
          typeAnnotation,
          'Properties that are of a function type are not supported. Use a method instead.',
        );
      default:
        throw this._error(
          typeAnnotation,
          `Unknown type annotation ${typeAnnotation.type}.`,
        );
    }
  }

  /**
   * Helper function that parses annotations of type 'GenericTypeAnnotation'. Meant to be called
   * from parseTypeAnnotation.
   */
  _parseGenericTypeAnnotation(typeAnnotation): Type {
    invariant(typeAnnotation.type === 'GenericTypeAnnotation');
    const id = this._parseTypeName(typeAnnotation.id);
    switch (id) {
      case 'Array':
        return {
          kind: 'array',
          type: this._parseGenericTypeParameterOfKnownType(id, typeAnnotation),
        };
      case 'Set':
        return {
          kind: 'set',
          type: this._parseGenericTypeParameterOfKnownType(id, typeAnnotation),
        };
      case 'Promise':
        return {
          kind: 'promise',
          type: this._parseGenericTypeParameterOfKnownType(id, typeAnnotation),
        };
      case 'ConnectableObservable':
        return {
          kind: 'observable',
          type: this._parseGenericTypeParameterOfKnownType(id, typeAnnotation),
        };
      case 'Map':
        this._assert(
          typeAnnotation,
          typeAnnotation.typeParameters != null &&
            typeAnnotation.typeParameters.params.length === 2,
          `${id} takes exactly two type parameters.`,
        );
        return {
          kind: 'map',
          keyType: this._parseTypeAnnotation(
            typeAnnotation.typeParameters.params[0],
          ),
          valueType: this._parseTypeAnnotation(
            typeAnnotation.typeParameters.params[1],
          ),
        };
      default:
        this._assert(
          typeAnnotation,
          id !== 'Observable',
          'Use of Observable in RPC interface. Use ConnectableObservable instead.',
        );

        // Named types are represented as Generic types with no type parameters.
        this._assert(
          typeAnnotation,
          typeAnnotation.typeParameters == null,
          `Unknown generic type ${id}.`,
        );

        const imp = this._imports.hasOwnProperty(id) ? this._imports[id] : null;
        if (!this._defs.hasOwnProperty(id) && imp != null && !imp.added) {
          imp.added = true;
          this._importsUsed.add(imp.file);
          if (id !== imp.imported) {
            return {kind: 'named', name: imp.imported};
          }
        }
        return {kind: 'named', name: id};
    }
  }

  _parseGenericTypeParameterOfKnownType(
    id: string,
    typeAnnotation: Object,
  ): Type {
    this._assert(
      typeAnnotation,
      typeAnnotation.typeParameters != null &&
        typeAnnotation.typeParameters.params.length === 1,
      `${id} has exactly one type parameter.`,
    );
    return this._parseTypeAnnotation(typeAnnotation.typeParameters.params[0]);
  }

  /**
   * Type names may either be simple Identifiers, or they may be
   * qualified identifiers.
   */
  _parseTypeName(type: Object): string {
    switch (type.type) {
      case 'Identifier':
        return type.name;
      case 'QualifiedTypeIdentifier':
        invariant(type.id.type === 'Identifier');
        return `${this._parseTypeName(type.qualification)}.${type.id.name}`;
      default:
        throw this._error(type, `Expected named type. Found ${type.type}`);
    }
  }
}

function isValidDisposeReturnType(type: Type): boolean {
  return (
    type.kind === 'void' ||
    (type.kind === 'promise' && type.type.kind === 'void')
  );
}
