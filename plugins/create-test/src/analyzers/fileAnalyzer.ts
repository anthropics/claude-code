/**
 * File Analyzer
 *
 * Analyzes source files and extracts structural metadata — exported functions,
 * classes, methods, parameters, return types, and imports — that the test
 * generator uses to produce idiomatic test suites.
 *
 * Supported languages:
 *   - TypeScript (.ts, .tsx)  — via TypeScript compiler AST
 *   - JavaScript (.js, .jsx)  — via TypeScript compiler AST (JS mode)
 *   - Python     (.py)        — via regex-based parser
 *   - Go         (.go)        — via regex-based parser
 */

import * as ts from 'typescript';
import * as fs from 'fs';
import * as path from 'path';

// ─────────────────────────────────────────────────────────────────────────────
// Public types
// ─────────────────────────────────────────────────────────────────────────────

export interface ParameterInfo {
  name: string;
  /** Type annotation as written in source (e.g. "string", "number | null"). */
  type: string;
  /** True when the param has `?` or a default value. */
  optional: boolean;
  defaultValue?: string;
}

export interface FunctionInfo {
  name: string;
  isAsync: boolean;
  parameters: ParameterInfo[];
  /** Return type annotation as written in source, or inferred fallback. */
  returnType: string;
  /** True when this is also the module's default export. */
  isDefault: boolean;
}

export interface MethodInfo {
  name: string;
  isAsync: boolean;
  isStatic: boolean;
  visibility: 'public' | 'protected' | 'private';
  parameters: ParameterInfo[];
  returnType: string;
}

export interface ClassInfo {
  name: string;
  isDefault: boolean;
  methods: MethodInfo[];
  hasConstructor: boolean;
  constructorParams: ParameterInfo[];
}

export interface ImportInfo {
  /** The raw module specifier string (e.g. "../db", "axios"). */
  modulePath: string;
  /** True when the path does not start with "." or "/". */
  isExternal: boolean;
  namedImports: string[];
  defaultImport?: string;
  namespaceImport?: string;
}

export interface AnalyzedFile {
  filePath: string;
  language: 'typescript' | 'javascript' | 'python' | 'go';
  functions: FunctionInfo[];
  classes: ClassInfo[];
  imports: ImportInfo[];
  hasDefaultExport: boolean;
  /** All names visible from outside the module. */
  exportedNames: string[];
}

// ─────────────────────────────────────────────────────────────────────────────
// Entry point
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Analyze a source file and return its structural metadata.
 * Throws if the file does not exist or the extension is unsupported.
 */
export function analyzeFile(filePath: string): AnalyzedFile {
  const absolutePath = path.resolve(filePath);

  if (!fs.existsSync(absolutePath)) {
    throw new Error(`File not found: ${filePath}`);
  }

  const ext = path.extname(absolutePath).toLowerCase();

  switch (ext) {
    case '.ts':
    case '.tsx':
      return analyzeTypeScriptFile(absolutePath, 'typescript');
    case '.js':
    case '.jsx':
      return analyzeTypeScriptFile(absolutePath, 'javascript');
    case '.py':
      return analyzePythonFile(absolutePath);
    case '.go':
      return analyzeGoFile(absolutePath);
    default:
      throw new Error(
        `Unsupported extension "${ext}". Supported: .ts, .tsx, .js, .jsx, .py, .go`,
      );
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// TypeScript / JavaScript analyzer  (uses TypeScript compiler API)
// ─────────────────────────────────────────────────────────────────────────────

function analyzeTypeScriptFile(
  filePath: string,
  language: 'typescript' | 'javascript',
): AnalyzedFile {
  const sourceText = fs.readFileSync(filePath, 'utf-8');
  const scriptKind =
    language === 'typescript' ? ts.ScriptKind.TS : ts.ScriptKind.JS;

  // createSourceFile gives us a lightweight parse tree without type resolution.
  const sourceFile = ts.createSourceFile(
    filePath,
    sourceText,
    ts.ScriptTarget.Latest,
    /* setParentNodes */ true,
    scriptKind,
  );

  const functions: FunctionInfo[] = [];
  const classes: ClassInfo[] = [];
  const imports: ImportInfo[] = [];
  const exportedNames: string[] = [];
  let hasDefaultExport = false;

  for (const statement of sourceFile.statements) {
    // ── import declarations ────────────────────────────────────────────────
    if (ts.isImportDeclaration(statement)) {
      const info = extractImport(statement, sourceFile);
      if (info) imports.push(info);
      continue;
    }

    // ── export default expression/assignment  (export default someVar) ────
    if (ts.isExportAssignment(statement)) {
      hasDefaultExport = true;
      continue;
    }

    // ── function declaration ───────────────────────────────────────────────
    if (ts.isFunctionDeclaration(statement) && isExported(statement)) {
      const fn = extractFunctionDecl(statement, sourceFile);
      functions.push(fn);
      exportedNames.push(fn.name);
      if (fn.isDefault) hasDefaultExport = true;
      continue;
    }

    // ── variable statement with arrow/function expression ─────────────────
    if (ts.isVariableStatement(statement) && isExported(statement)) {
      for (const decl of statement.declarationList.declarations) {
        if (decl.initializer && isFunctionLike(decl.initializer)) {
          const fn = extractVariableFn(decl, sourceFile);
          if (fn) {
            functions.push(fn);
            exportedNames.push(fn.name);
          }
        }
      }
      continue;
    }

    // ── class declaration ──────────────────────────────────────────────────
    if (ts.isClassDeclaration(statement) && isExported(statement)) {
      const cls = extractClass(statement, sourceFile);
      classes.push(cls);
      exportedNames.push(cls.name);
      if (cls.isDefault) hasDefaultExport = true;
      continue;
    }

    // ── named re-exports: export { foo, bar } ─────────────────────────────
    if (ts.isExportDeclaration(statement)) {
      if (
        statement.exportClause &&
        ts.isNamedExports(statement.exportClause)
      ) {
        for (const el of statement.exportClause.elements) {
          exportedNames.push(el.name.getText(sourceFile));
        }
      }
    }
  }

  return {
    filePath,
    language,
    functions,
    classes,
    imports,
    hasDefaultExport,
    exportedNames,
  };
}

// ── TS helpers ─────────────────────────────────────────────────────────────

/** Returns true when the declaration carries an `export` keyword. */
function isExported(node: ts.Node): boolean {
  if (!ts.canHaveModifiers(node)) return false;
  const mods = ts.getModifiers(node as ts.HasModifiers);
  return !!mods?.some((m) => m.kind === ts.SyntaxKind.ExportKeyword);
}

/** Returns true when the declaration also carries a `default` keyword. */
function isDefaultExport(node: ts.Node): boolean {
  if (!ts.canHaveModifiers(node)) return false;
  const mods = ts.getModifiers(node as ts.HasModifiers);
  return !!mods?.some((m) => m.kind === ts.SyntaxKind.DefaultKeyword);
}

/** Returns true when the declaration carries an `async` keyword. */
function isAsync(node: ts.Node): boolean {
  if (!ts.canHaveModifiers(node)) return false;
  const mods = ts.getModifiers(node as ts.HasModifiers);
  return !!mods?.some((m) => m.kind === ts.SyntaxKind.AsyncKeyword);
}

function isFunctionLike(node: ts.Node): node is ts.FunctionExpression | ts.ArrowFunction {
  return ts.isFunctionExpression(node) || ts.isArrowFunction(node);
}

function extractImport(
  node: ts.ImportDeclaration,
  sourceFile: ts.SourceFile,
): ImportInfo | null {
  if (!ts.isStringLiteral(node.moduleSpecifier)) return null;

  const modulePath = node.moduleSpecifier.text;
  const isExternal =
    !modulePath.startsWith('.') && !modulePath.startsWith('/');
  const namedImports: string[] = [];
  let defaultImport: string | undefined;
  let namespaceImport: string | undefined;

  const clause = node.importClause;
  if (clause) {
    if (clause.name) defaultImport = clause.name.text;

    const bindings = clause.namedBindings;
    if (bindings) {
      if (ts.isNamespaceImport(bindings)) {
        namespaceImport = bindings.name.text;
      } else if (ts.isNamedImports(bindings)) {
        for (const spec of bindings.elements) {
          namedImports.push(spec.name.text);
        }
      }
    }
  }

  return { modulePath, isExternal, namedImports, defaultImport, namespaceImport };
}

function extractFunctionDecl(
  node: ts.FunctionDeclaration,
  sourceFile: ts.SourceFile,
): FunctionInfo {
  const name = node.name?.getText(sourceFile) ?? 'anonymous';
  const parameters = node.parameters.map((p) => extractParam(p, sourceFile));
  const returnType = node.type
    ? node.type.getText(sourceFile)
    : isAsync(node)
      ? 'Promise<unknown>'
      : 'unknown';

  return {
    name,
    isAsync: isAsync(node),
    parameters,
    returnType,
    isDefault: isDefaultExport(node),
  };
}

function extractVariableFn(
  decl: ts.VariableDeclaration,
  sourceFile: ts.SourceFile,
): FunctionInfo | null {
  if (!ts.isIdentifier(decl.name)) return null;
  if (!decl.initializer || !isFunctionLike(decl.initializer)) return null;

  const name = decl.name.text;
  const fn = decl.initializer;
  const parameters = fn.parameters.map((p) => extractParam(p, sourceFile));
  const asyncFlag = isAsync(fn);
  const returnType = fn.type
    ? fn.type.getText(sourceFile)
    : asyncFlag
      ? 'Promise<unknown>'
      : 'unknown';

  return { name, isAsync: asyncFlag, parameters, returnType, isDefault: false };
}

function extractClass(
  node: ts.ClassDeclaration,
  sourceFile: ts.SourceFile,
): ClassInfo {
  const name = node.name?.getText(sourceFile) ?? 'AnonymousClass';
  const methods: MethodInfo[] = [];
  let hasConstructor = false;
  let constructorParams: ParameterInfo[] = [];

  for (const member of node.members) {
    if (ts.isConstructorDeclaration(member)) {
      hasConstructor = true;
      constructorParams = member.parameters.map((p) =>
        extractParam(p, sourceFile),
      );
      continue;
    }

    if (ts.isMethodDeclaration(member)) {
      const methodName = member.name.getText(sourceFile);
      if (methodName.startsWith('#')) continue; // ECMAScript private field

      const mods = ts.canHaveModifiers(member)
        ? ts.getModifiers(member as ts.HasModifiers)
        : undefined;

      const isPrivate = !!mods?.some(
        (m) => m.kind === ts.SyntaxKind.PrivateKeyword,
      );
      // Skip private methods — they cannot be tested from outside the class
      if (isPrivate) continue;

      const isStatic = !!mods?.some(
        (m) => m.kind === ts.SyntaxKind.StaticKeyword,
      );
      const isProtected = !!mods?.some(
        (m) => m.kind === ts.SyntaxKind.ProtectedKeyword,
      );
      const asyncFlag = isAsync(member);
      const parameters = member.parameters.map((p) =>
        extractParam(p, sourceFile),
      );
      const returnType = member.type
        ? member.type.getText(sourceFile)
        : asyncFlag
          ? 'Promise<unknown>'
          : 'unknown';

      methods.push({
        name: methodName,
        isAsync: asyncFlag,
        isStatic,
        visibility: isProtected ? 'protected' : 'public',
        parameters,
        returnType,
      });
    }
  }

  return {
    name,
    isDefault: isDefaultExport(node),
    methods,
    hasConstructor,
    constructorParams,
  };
}

function extractParam(
  param: ts.ParameterDeclaration,
  sourceFile: ts.SourceFile,
): ParameterInfo {
  const name = ts.isIdentifier(param.name)
    ? param.name.text
    : param.name.getText(sourceFile);
  const type = param.type ? param.type.getText(sourceFile) : 'any';
  const optional = !!param.questionToken || !!param.initializer;
  const defaultValue = param.initializer?.getText(sourceFile);

  return { name, type, optional, defaultValue };
}

// ─────────────────────────────────────────────────────────────────────────────
// Python analyzer  (regex-based)
// ─────────────────────────────────────────────────────────────────────────────

function analyzePythonFile(filePath: string): AnalyzedFile {
  const source = fs.readFileSync(filePath, 'utf-8');
  const lines = source.split('\n');

  const functions: FunctionInfo[] = [];
  const classes: ClassInfo[] = [];
  const imports: ImportInfo[] = [];
  const exportedNames: string[] = [];

  let i = 0;
  while (i < lines.length) {
    const line = lines[i];

    // ── imports ──────────────────────────────────────────────────────────
    const fromImport = line.match(
      /^from\s+([\w.]+)\s+import\s+(.+)/,
    );
    if (fromImport) {
      const mod = fromImport[1];
      const names = fromImport[2]
        .replace(/[()]/g, '')
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean);
      imports.push({
        modulePath: mod,
        isExternal: !mod.startsWith('.'),
        namedImports: names,
      });
      i++;
      continue;
    }

    const bareImport = line.match(/^import\s+([\w., ]+)/);
    if (bareImport) {
      for (const mod of bareImport[1].split(',').map((s) => s.trim())) {
        imports.push({
          modulePath: mod,
          isExternal: !mod.startsWith('.'),
          namedImports: [],
        });
      }
      i++;
      continue;
    }

    // ── top-level function (not indented) ─────────────────────────────────
    const funcMatch = line.match(
      /^(async\s+)?def\s+([a-zA-Z_]\w*)\s*\(([^)]*)\)(?:\s*->\s*([^:]+))?\s*:/,
    );
    if (funcMatch) {
      const funcIsAsync = !!funcMatch[1];
      const name = funcMatch[2];
      const paramsStr = funcMatch[3];
      const returnType = funcMatch[4]?.trim() ?? 'None';
      const parameters = parsePythonParams(paramsStr);

      // Python has no explicit export; by convention, names starting with _
      // are considered private.
      if (!name.startsWith('_')) {
        functions.push({
          name,
          isAsync: funcIsAsync,
          parameters,
          returnType,
          isDefault: false,
        });
        exportedNames.push(name);
      }
      i++;
      continue;
    }

    // ── top-level class ───────────────────────────────────────────────────
    const classMatch = line.match(
      /^class\s+([A-Z][a-zA-Z0-9_]*)\s*(?:\([^)]*\))?\s*:/,
    );
    if (classMatch) {
      const className = classMatch[1];
      const methods: MethodInfo[] = [];
      let hasConstructor = false;
      let constructorParams: ParameterInfo[] = [];

      i++;
      while (i < lines.length) {
        const bodyLine = lines[i];

        // End of class body when we hit a non-empty, non-indented line
        if (bodyLine.trim() && !bodyLine.match(/^[ \t]/)) break;

        const methodMatch = bodyLine.match(
          /^[ \t]+(async\s+)?def\s+([a-zA-Z_]\w*)\s*\(self(?:,\s*([^)]*))?\)(?:\s*->\s*([^:]+))?\s*:/,
        );
        if (methodMatch) {
          const mIsAsync = !!methodMatch[1];
          const methodName = methodMatch[2];
          const paramsStr = methodMatch[3] ?? '';
          const retType = methodMatch[4]?.trim() ?? 'None';
          const parameters = parsePythonParams(paramsStr);

          if (methodName === '__init__') {
            hasConstructor = true;
            constructorParams = parameters;
          } else if (!methodName.startsWith('_')) {
            methods.push({
              name: methodName,
              isAsync: mIsAsync,
              isStatic: false,
              visibility: 'public',
              parameters,
              returnType: retType,
            });
          }
        }

        i++;
      }

      classes.push({
        name: className,
        isDefault: false,
        methods,
        hasConstructor,
        constructorParams,
      });
      exportedNames.push(className);
      continue;
    }

    i++;
  }

  return {
    filePath,
    language: 'python',
    functions,
    classes,
    imports,
    hasDefaultExport: false,
    exportedNames,
  };
}

/** Parse a Python parameter list string, skipping `self`/`cls`/`*args`/`**kwargs`. */
function parsePythonParams(paramsStr: string): ParameterInfo[] {
  if (!paramsStr.trim()) return [];

  return paramsStr
    .split(',')
    .map((p) => {
      const trimmed = p.trim();
      if (!trimmed || ['self', 'cls'].includes(trimmed)) return null;
      if (trimmed.startsWith('*') || trimmed.startsWith('**')) return null;

      const eqIdx = trimmed.indexOf('=');
      const lhs = eqIdx !== -1 ? trimmed.slice(0, eqIdx).trim() : trimmed;
      const defaultValue =
        eqIdx !== -1 ? trimmed.slice(eqIdx + 1).trim() : undefined;

      const colonIdx = lhs.indexOf(':');
      const name = colonIdx !== -1 ? lhs.slice(0, colonIdx).trim() : lhs;
      const type = colonIdx !== -1 ? lhs.slice(colonIdx + 1).trim() : 'Any';

      if (!name) return null;
      return { name, type, optional: eqIdx !== -1, defaultValue };
    })
    .filter((p): p is ParameterInfo => p !== null);
}

// ─────────────────────────────────────────────────────────────────────────────
// Go analyzer  (regex-based)
// ─────────────────────────────────────────────────────────────────────────────

function analyzeGoFile(filePath: string): AnalyzedFile {
  const source = fs.readFileSync(filePath, 'utf-8');

  const functions: FunctionInfo[] = [];
  const classes: ClassInfo[] = []; // Go structs with exported methods
  const imports: ImportInfo[] = [];
  const exportedNames: string[] = [];
  const structMethods = new Map<string, MethodInfo[]>();

  // ── imports ──────────────────────────────────────────────────────────────
  const importBlock = source.match(/import\s*\(([\s\S]*?)\)/);
  if (importBlock) {
    for (const line of importBlock[1].split('\n')) {
      const m = line.match(/"([^"]+)"/);
      if (m) {
        imports.push({
          modulePath: m[1],
          isExternal: !m[1].startsWith('.'),
          namedImports: [],
        });
      }
    }
  }
  for (const m of source.matchAll(/^import\s+"([^"]+)"/gm)) {
    imports.push({
      modulePath: m[1],
      isExternal: !m[1].startsWith('.'),
      namedImports: [],
    });
  }

  // ── functions and methods ─────────────────────────────────────────────────
  // Matches:
  //   func FuncName(params) ReturnType {
  //   func (r *ReceiverType) MethodName(params) ReturnType {
  const funcRe =
    /^func\s+(?:\(\s*\w+\s+\*?(\w+)\s*\)\s+)?([A-Z]\w*)\s*\(([^)]*)\)\s*(?:\(([^)]*)\)|(\*?\w[\w.*[\]]*))?\s*\{/gm;

  let m: RegExpExecArray | null;
  while ((m = funcRe.exec(source)) !== null) {
    const receiverType = m[1]; // present for methods
    const name = m[2];
    const paramsStr = m[3];
    const multiReturn = m[4];
    const singleReturn = m[5];
    const returnType = multiReturn ?? singleReturn ?? 'void';
    const parameters = parseGoParams(paramsStr);

    if (receiverType) {
      if (!structMethods.has(receiverType)) structMethods.set(receiverType, []);
      structMethods.get(receiverType)!.push({
        name,
        isAsync: false,
        isStatic: false,
        visibility: 'public',
        parameters,
        returnType,
      });
    } else {
      functions.push({ name, isAsync: false, parameters, returnType, isDefault: false });
      exportedNames.push(name);
    }
  }

  for (const [structName, methods] of structMethods) {
    classes.push({
      name: structName,
      isDefault: false,
      methods,
      hasConstructor: false,
      constructorParams: [],
    });
    exportedNames.push(structName);
  }

  return {
    filePath,
    language: 'go',
    functions,
    classes,
    imports,
    hasDefaultExport: false,
    exportedNames,
  };
}

/** Parse a Go parameter list string (e.g. "ctx context.Context, id int"). */
function parseGoParams(paramsStr: string): ParameterInfo[] {
  if (!paramsStr.trim()) return [];

  return paramsStr
    .split(',')
    .map((p) => {
      const parts = p.trim().split(/\s+/);
      if (parts.length === 1) {
        // unnamed parameter — type only
        return { name: '_', type: parts[0], optional: false };
      }
      if (parts.length >= 2) {
        return { name: parts[0], type: parts.slice(1).join(' '), optional: false };
      }
      return null;
    })
    .filter((p): p is ParameterInfo => p !== null && p.name !== '_');
}
