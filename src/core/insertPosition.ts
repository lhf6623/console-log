import * as acorn from "acorn";
import { tsPlugin } from "acorn-typescript";
import type * as vscode from "vscode";

/**
 * 基于 AST + 作用域分析的"精确插入点"。
 *
 * 位置使用 0 起始的行号与列号（与 vscode.Position 一致），
 * insertText 已含换行与缩进（缩进取自插入行）。
 */
export interface InsertPosition {
  line: number;
  character: number;
  insertText: string;
}

interface InsertionTarget {
  /** 插入点在"有效代码文本"中的字符偏移 */
  offset: number;
  /** 插入行使用的缩进 */
  indent: string;
  /** 是否要把空块体 { } 拆成多行 */
  bodySplit: boolean;
}

interface BindingInfo {
  name: string;
  node: Node;
  /** 声明语句结束偏移（用于 let/const 的可见性判断） */
  declEnd: number;
  /** 是否在整个作用域内可见（var/param/function 提升，true；let/const 假） */
  hoisted: boolean;
}

/**
 * 宽松的 ESTree 节点类型：acorn 产出 ESTree 风格节点，只有 .type，
 * 各节点字段通过索引访问（any），以最低摩擦适配作用域/绑定遍历。
 */
interface Node {
  type: string;
  start: number;
  end: number;
  [key: string]: any;
}

/** 一个解析器覆盖 JS/JSX/TS/TSX/Vue/Svelte/HTML script（acorn-typescript 自带 JSX）。 */
const Parser: any = acorn.Parser.extend(tsPlugin({ jsx: {} }) as any);

function isFnLike(n: Node | null | undefined): boolean {
  return (
    !!n &&
    (n.type === "FunctionDeclaration" ||
      n.type === "FunctionExpression" ||
      n.type === "ArrowFunctionExpression")
  );
}

const STATEMENT_TYPES = new Set([
  "VariableDeclaration",
  "ExpressionStatement",
  "IfStatement",
  "ForStatement",
  "ForInStatement",
  "ForOfStatement",
  "ReturnStatement",
  "FunctionDeclaration",
  "ClassDeclaration",
  "ImportDeclaration",
  "ExportDefaultDeclaration",
  "ExportNamedDeclaration",
  "ExportAllDeclaration",
  "BlockStatement",
  "BreakStatement",
  "ContinueStatement",
  "ThrowStatement",
  "TryStatement",
  "WhileStatement",
  "DoWhileStatement",
  "SwitchStatement",
  "LabeledStatement",
  "EmptyStatement",
  "DebuggerStatement",
]);

function isStatement(n: Node | null | undefined): boolean {
  return !!n && STATEMENT_TYPES.has(n.type);
}

const SCOPE_NODES = new Set([
  "Program",
  "BlockStatement",
  "FunctionDeclaration",
  "FunctionExpression",
  "ArrowFunctionExpression",
  "CatchClause",
  "ForStatement",
  "ForInStatement",
  "ForOfStatement",
  "SwitchStatement",
]);

function isScopeNode(n: Node | null | undefined): boolean {
  return !!n && SCOPE_NODES.has(n.type);
}

// ---------------- offset / line / indent helpers ----------------

function offsetToLineCol(
  text: string,
  offset: number,
): { line: number; character: number } {
  let line = 0;
  let col = 0;
  const n = Math.min(offset, text.length);
  for (let i = 0; i < n; i++) {
    const ch = text[i];
    if (ch === "\n") {
      line++;
      col = 0;
    } else if (ch === "\r") {
      // \r\n 的行结束符：\r 不计入列号
    } else {
      col++;
    }
  }
  return { line, character: col };
}

function lineStartOffset(text: string, line: number): number {
  let cur = 0;
  for (let i = 0; i < line; i++) {
    if (cur >= text.length) {
      return text.length;
    }
    const nl = text.indexOf("\n", cur);
    if (nl < 0) {
      return text.length;
    }
    cur = nl + 1;
  }
  return cur;
}

function getLineIndent(text: string, line: number): string {
  const start = lineStartOffset(text, line);
  let i = start;
  while (i < text.length && (text[i] === " " || text[i] === "\t")) {
    i++;
  }
  return text.slice(start, i);
}

// ---------------- embedded script (vue/svelte/html) extraction ----------------

function isEmbeddedFileName(fileName: string): boolean {
  const lower = fileName.toLowerCase();
  return (
    lower.endsWith(".vue") ||
    lower.endsWith(".svelte") ||
    lower.endsWith(".html")
  );
}

function extractEmbeddedScript(
  text: string,
  fileName: string,
): { script: string; startOffset: number; openTag: string } | null {
  if (!isEmbeddedFileName(fileName)) {
    return null;
  }
  const scriptTagRe = /<script\b[^>]*>/gi;
  let openMatch: RegExpExecArray | null;
  while ((openMatch = scriptTagRe.exec(text)) !== null) {
    const openTag = openMatch[0];
    // 外链脚本（<script src=...>）没有内联内容，跳过
    if (/\bsrc\s*=/.test(openTag)) {
      continue;
    }
    const openEnd = openMatch.index + openTag.length; // '>' 之后
    const closeMatch = /<\/script\s*>/i.exec(text.slice(openEnd));
    if (!closeMatch || closeMatch.index < 0) {
      return null;
    }
    const closeStart = openEnd + closeMatch.index;
    return {
      script: text.slice(openEnd, closeStart),
      startOffset: openEnd,
      openTag,
    };
  }
  return null;
}

// ---------------- parent map ----------------

/**
 * ESTree 默认无 .parent 指针，构建 parent 映射（WeakMap），一次遍历。
 */
function buildParents(ast: Node): WeakMap<Node, Node | null> {
  const parentMap = new WeakMap<Node, Node | null>();
  function walk(node: Node, parent: Node | null): void {
    if (!node || typeof node !== "object") {
      return;
    }
    if (node.type) {
      parentMap.set(node, parent);
    }
    for (const k of Object.keys(node)) {
      const v = node[k];
      if (Array.isArray(v)) {
        for (const it of v) {
          walk(it, node);
        }
      } else if (v && typeof v === "object" && v.type) {
        walk(v, node);
      }
    }
  }
  walk(ast, null);
  return parentMap;
}

function getAncestors(
  node: Node,
  parentMap: WeakMap<Node, Node | null>,
): Node[] {
  const res: Node[] = [];
  let cur = parentMap.get(node) ?? null;
  while (cur) {
    res.push(cur);
    cur = parentMap.get(cur) ?? null;
  }
  return res;
}

// ---------------- AST locating ----------------

/**
 * 在有效代码文本中，找出选区 [startOffset, endOffset] 对应的标识符节点。
 * 优先精确匹配；否则取覆盖选区起点且最"贴近"的标识符。
 *
 * 注意：acorn-typescript 对带类型注解的 Identifier 会给出错误的 node.end，
 * 这里用 node.start + node.name.length 重建精确范围。
 */
function findSelectedIdentifier(
  ast: Node,
  startOffset: number,
  endOffset: number,
): Node | null {
  let best: Node | null = null;
  let bestScore = -1;

  function visit(node: Node): void {
    if (!node || typeof node !== "object" || !node.type) {
      return;
    }
    if (node.type === "Identifier") {
      const s = node.start;
      const e = node.start + node.name.length;
      if (e >= startOffset && s <= endOffset) {
        let score = 0;
        if (s === startOffset && e === endOffset) {
          score = 3; // 精确匹配（通常是双击选中的变量名）
        } else if (s <= startOffset && e >= startOffset) {
          score = 2; // 覆盖选区起点
        } else {
          score = 1; // 与选区相交
        }
        // 同分时优先更小的标识符（更贴近选中的单个变量）
        score = score * 10000 - (e - s);
        if (score > bestScore) {
          bestScore = score;
          best = node;
        }
      }
    }
    for (const k of Object.keys(node)) {
      const v = node[k];
      if (Array.isArray(v)) {
        for (const it of v) {
          visit(it);
        }
      } else if (v && typeof v === "object" && v.type) {
        visit(v);
      }
    }
  }

  visit(ast);
  return best;
}

// ---------------- binding / reference classification ----------------

/**
 * 从 Identifier 向上爬 pattern 链，找到它作为"绑定目标"的锚节点。
 * 覆盖：VariableDeclarator.id、函数形参、函数/类名、方法/属性名、
 * import specifiers、CatchClause.param、以及解构下钻（ObjectPattern/ArrayPattern/
 * RestElement/AssignmentPattern/Property.value 与简写 key）。
 */
function findBindingAnchor(
  id: Node,
  parentMap: WeakMap<Node, Node | null>,
): Node | null {
  let cur: Node = id;
  for (;;) {
    const p = parentMap.get(cur);
    if (!p) {
      return null;
    }
    if (p.type === "VariableDeclarator" && p.id === cur) {
      return p;
    }
    if (p.type === "FunctionDeclaration" && p.id === cur) {
      return p;
    }
    if (p.type === "FunctionExpression" && p.id === cur) {
      return p;
    }
    if (p.type === "ClassDeclaration" && p.id === cur) {
      return p;
    }
    if (p.type === "ClassExpression" && p.id === cur) {
      return p;
    }
    if (p.type === "MethodDefinition" && p.key === cur) {
      return p;
    }
    if (p.type === "PropertyDefinition" && p.key === cur) {
      return p;
    }
    if (p.type === "ImportSpecifier" && p.local === cur) {
      return p;
    }
    if (p.type === "ImportDefaultSpecifier" && p.local === cur) {
      return p;
    }
    if (p.type === "ImportNamespaceSpecifier" && p.local === cur) {
      return p;
    }
    if (isFnLike(p) && p.params && p.params.includes(cur)) {
      return p;
    }
    if (p.type === "CatchClause" && p.param === cur) {
      return p;
    }
    if (p.type === "Property") {
      if (p.value === cur) {
        cur = p;
        continue;
      }
      if (p.shorthand && p.key === cur) {
        cur = p;
        continue;
      }
      return null;
    }
    if (p.type === "ArrayPattern" || p.type === "ObjectPattern") {
      cur = p;
      continue;
    }
    if (p.type === "RestElement") {
      if (p.argument === cur) {
        cur = p;
        continue;
      }
      return null;
    }
    if (p.type === "AssignmentPattern") {
      if (p.left === cur) {
        cur = p;
        continue;
      }
      return null;
    }
    return null;
  }
}

function isBindingIdentifier(
  id: Node,
  parentMap: WeakMap<Node, Node | null>,
): boolean {
  return !!findBindingAnchor(id, parentMap);
}

/**
 * 判定一个已确认是"引用"的标识符是否其实是属性访问/对象键名等非变量引用。
 * 命中这些则不应作为变量引用去解析绑定作用域。
 */
function isReferenceIdentifier(
  id: Node,
  parentMap: WeakMap<Node, Node | null>,
): boolean {
  if (isBindingIdentifier(id, parentMap)) {
    return false;
  }
  const p = parentMap.get(id);
  if (p && p.type === "MemberExpression" && p.property === id) {
    return false;
  }
  if (p && p.type === "Property" && !p.shorthand && p.key === id) {
    return false;
  }
  if (p && p.type === "MethodDefinition" && p.key === id) {
    return false;
  }
  if (p && p.type === "ImportSpecifier" && p.imported === id) {
    return false;
  }
  return true;
}

// ---------------- scope resolution (for reference) ----------------

function addBinding(
  map: Map<string, BindingInfo[]>,
  name: string,
  node: Node,
  hoisted: boolean,
  declEnd?: number,
): void {
  const info: BindingInfo = {
    name,
    node,
    hoisted,
    declEnd: declEnd ?? node.end,
  };
  const arr = map.get(name);
  if (arr) {
    arr.push(info);
  } else {
    map.set(name, [info]);
  }
}

function collectPatternBindings(
  pattern: Node | null | undefined,
  map: Map<string, BindingInfo[]>,
  declEnd: number,
  hoisted: boolean,
): void {
  if (!pattern) {
    return;
  }
  if (pattern.type === "Identifier") {
    addBinding(map, pattern.name, pattern, hoisted, declEnd);
  } else if (pattern.type === "ObjectPattern") {
    for (const prop of pattern.properties as Node[]) {
      if (prop && prop.type === "Property") {
        collectPatternBindings(prop.value, map, declEnd, hoisted);
      }
    }
  } else if (pattern.type === "ArrayPattern") {
    for (const el of pattern.elements as Node[]) {
      collectPatternBindings(el, map, declEnd, hoisted);
    }
  } else if (pattern.type === "RestElement") {
    collectPatternBindings(pattern.argument, map, declEnd, hoisted);
  } else if (pattern.type === "AssignmentPattern") {
    collectPatternBindings(pattern.left, map, declEnd, hoisted);
  }
}

function collectDeclsFromVariableDeclaration(
  stmt: Node,
  map: Map<string, BindingInfo[]>,
): void {
  const isBlockScoped = stmt.kind === "let" || stmt.kind === "const";
  for (const decl of stmt.declarations as Node[]) {
    collectPatternBindings(decl.id, map, stmt.end, !isBlockScoped);
  }
}

function collectStmt(
  stmt: Node | null | undefined,
  map: Map<string, BindingInfo[]>,
): void {
  if (!stmt || !stmt.type) {
    return;
  }
  if (stmt.type === "VariableDeclaration") {
    collectDeclsFromVariableDeclaration(stmt, map);
  } else if (stmt.type === "FunctionDeclaration" && stmt.id) {
    addBinding(map, stmt.id.name, stmt, true, stmt.end);
  } else if (stmt.type === "ClassDeclaration" && stmt.id) {
    addBinding(map, stmt.id.name, stmt, true, stmt.end);
  } else if (stmt.type === "ImportDeclaration") {
    for (const spec of (stmt.specifiers ?? []) as Node[]) {
      if (spec.local) {
        addBinding(map, spec.local.name, spec.local, true, stmt.end);
      }
    }
  }
}

function collectScopeBindings(scope: Node): Map<string, BindingInfo[]> {
  const map = new Map<string, BindingInfo[]>();
  if (scope.type === "Program" || scope.type === "BlockStatement") {
    for (const stmt of scope.body as Node[]) {
      collectStmt(stmt, map);
    }
  } else if (isFnLike(scope)) {
    for (const param of (scope.params ?? []) as Node[]) {
      collectPatternBindings(param, map, param.end, true);
    }
  } else if (scope.type === "CatchClause") {
    if (scope.param) {
      collectPatternBindings(scope.param, map, scope.param.end, true);
    }
  } else if (scope.type === "ForStatement") {
    if (scope.init && scope.init.type === "VariableDeclaration") {
      collectDeclsFromVariableDeclaration(scope.init, map);
    }
  } else if (
    scope.type === "ForInStatement" ||
    scope.type === "ForOfStatement"
  ) {
    if (scope.left && scope.left.type === "VariableDeclaration") {
      collectDeclsFromVariableDeclaration(scope.left, map);
    }
  } else if (scope.type === "SwitchStatement") {
    for (const c of scope.cases as Node[]) {
      for (const stmt of c.consequent as Node[]) {
        collectStmt(stmt, map);
      }
    }
  }
  return map;
}

function isBindingVisible(binding: BindingInfo, refPos: number): boolean {
  return binding.hoisted || refPos >= binding.declEnd;
}

/**
 * 解析一个 reference 标识符的绑定作用域节点。
 * 返回声明该引用所指向变量的最内层作用域容器。
 */
function findReferenceBindingScope(
  id: Node,
  parentMap: WeakMap<Node, Node | null>,
): Node | null {
  const name = id.name;
  const refPos = id.start;
  const scopes = getAncestors(id, parentMap).filter(isScopeNode);
  for (const scope of scopes) {
    const bindings = collectScopeBindings(scope);
    const decls = bindings.get(name);
    if (decls && decls.length > 0) {
      for (const d of decls) {
        if (isBindingVisible(d, refPos)) {
          return scope;
        }
      }
    }
  }
  return null;
}

// ---------------- insertion point computation ----------------

function findContainingStatement(
  node: Node,
  parentMap: WeakMap<Node, Node | null>,
): Node | null {
  let cur = parentMap.get(node) ?? null;
  while (cur) {
    if (isStatement(cur)) {
      return cur;
    }
    cur = parentMap.get(cur) ?? null;
  }
  return null;
}

function makeStatementEndInsertion(
  stmt: Node,
  effectiveText: string,
): InsertionTarget {
  const endOffset = stmt.end;
  const pos = offsetToLineCol(effectiveText, endOffset);
  const indent = getLineIndent(effectiveText, pos.line);
  return { offset: endOffset, indent, bodySplit: false };
}

function makeBlockBodyInsertion(
  body: Node,
  effectiveText: string,
): InsertionTarget {
  const openOffset = body.start;
  const insertOffset = openOffset + 1;
  const empty = body.body.length === 0;
  const openLine = offsetToLineCol(effectiveText, insertOffset).line;
  let indent: string;
  if (!empty) {
    const firstStart = body.body[0].start;
    indent = getLineIndent(
      effectiveText,
      offsetToLineCol(effectiveText, firstStart).line,
    );
  } else {
    indent = getLineIndent(effectiveText, openLine);
  }
  const closePos = body.end - 1;
  const sameLine =
    offsetToLineCol(effectiveText, Math.max(0, closePos)).line === openLine;
  const bodySplit = empty && sameLine;
  return { offset: insertOffset, indent, bodySplit };
}

/**
 * 若 `node`（VariableDeclarator）声明在 for / for-in / for-of 循环的
 * 初始化表达式中，且循环体是块（BlockStatement），返回该循环体块，
 * 以便把 log 插到循环体内部、保证块级作用域变量在作用域内。
 * 否则返回 null（此时应按普通"声明语句之后"处理）。
 */
function findLoopInitializerBody(
  node: Node,
  parentMap: WeakMap<Node, Node | null>,
): Node | null {
  let cur: Node | null = node;
  let vd: Node | null = null;
  while (cur) {
    const pp = parentMap.get(cur);
    if (!pp) {
      break;
    }
    if (pp.type === "VariableDeclaration") {
      vd = pp;
      break;
    }
    cur = pp;
  }
  if (!vd) {
    return null;
  }
  const loop = parentMap.get(vd);
  if (!loop) {
    return null;
  }
  const isLoopInitializer =
    (loop.type === "ForStatement" && loop.init === vd) ||
    ((loop.type === "ForInStatement" || loop.type === "ForOfStatement") &&
      loop.left === vd);
  if (!isLoopInitializer) {
    return null;
  }
  const body = loop.body;
  return body && body.type === "BlockStatement" ? body : null;
}

function computeBindingInsertion(
  id: Node,
  effectiveText: string,
  parentMap: WeakMap<Node, Node | null>,
): InsertionTarget | null {
  const anchor = findBindingAnchor(id, parentMap);
  if (!anchor) {
    return null;
  }

  // 参数 / 箭头函数：插到函数/箭头函数体 { 之后
  if (isFnLike(anchor)) {
    if (anchor.body && anchor.body.type === "BlockStatement") {
      return makeBlockBodyInsertion(anchor.body, effectiveText);
    }
    return null;
  }

  // 命名函数：插到函数体
  if (
    anchor.type === "FunctionDeclaration" ||
    anchor.type === "FunctionExpression"
  ) {
    if (anchor.body && anchor.body.type === "BlockStatement") {
      return makeBlockBodyInsertion(anchor.body, effectiveText);
    }
    return null;
  }

  // let/const/var 声明：默认插到声明语句之后。
  // 若是 for/for-in/for-of 的循环变量（块级作用域），则插到循环体内部。
  if (anchor.type === "VariableDeclarator") {
    const loopBody = findLoopInitializerBody(anchor, parentMap);
    if (loopBody) {
      return makeBlockBodyInsertion(loopBody, effectiveText);
    }
    const stmt = findContainingStatement(anchor, parentMap);
    if (stmt) {
      return makeStatementEndInsertion(stmt, effectiveText);
    }
    return null;
  }

  // class 名：优先构造器体，否则类声明之后
  if (anchor.type === "ClassDeclaration" || anchor.type === "ClassExpression") {
    const ctor = (anchor.body?.body ?? []).find(
      (m: Node) =>
        m.type === "MethodDefinition" &&
        m.kind === "constructor" &&
        m.value?.body &&
        m.value.body.type === "BlockStatement",
    );
    if (ctor) {
      return makeBlockBodyInsertion(ctor.value.body, effectiveText);
    }
    const stmt = findContainingStatement(anchor, parentMap);
    if (stmt) {
      return makeStatementEndInsertion(stmt, effectiveText);
    }
    return null;
  }

  // import 绑定：插到 import 语句之后
  if (typeof anchor.type === "string" && anchor.type.startsWith("Import")) {
    const stmt = findContainingStatement(anchor, parentMap);
    if (stmt) {
      return makeStatementEndInsertion(stmt, effectiveText);
    }
    return null;
  }

  // 方法名：插到方法体
  if (anchor.type === "MethodDefinition") {
    const v = anchor.value;
    if (v && v.body && v.body.type === "BlockStatement") {
      return makeBlockBodyInsertion(v.body, effectiveText);
    }
    return null;
  }

  return null;
}

function computeReferenceInsertion(
  id: Node,
  effectiveText: string,
  parentMap: WeakMap<Node, Node | null>,
): InsertionTarget | null {
  // 属性访问等非变量引用（isReferenceIdentifier 返回 false）直接放弃，
  // 交给调用方回退启发式。
  if (!isReferenceIdentifier(id, parentMap)) {
    return null;
  }
  // 解析绑定作用域，确保插入点落在声明作用域内；找不到则回退到启发式
  const scope = findReferenceBindingScope(id, parentMap);
  if (!scope) {
    return null;
  }
  const stmt = findContainingStatement(id, parentMap);
  if (!stmt) {
    return null;
  }
  return makeStatementEndInsertion(stmt, effectiveText);
}

// ---------------- result generation ----------------

function buildLogLine(selectedText: string): string {
  return "console.log(\`🔥" + selectedText + ":\`, " + selectedText + ");";
}

function buildInsertText(
  indent: string,
  logLine: string,
  bodySplit: boolean,
): string {
  if (bodySplit) {
    return "\n" + indent + logLine + "\n" + indent;
  }
  return "\n" + indent + logLine;
}

function toInsertPosition(
  originalText: string,
  effectiveText: string,
  shift: number,
  isEmbedded: boolean,
  target: InsertionTarget,
  logLine: string,
): InsertPosition {
  const localPos = offsetToLineCol(effectiveText, target.offset);
  let line: number;
  let character: number;
  if (isEmbedded) {
    const startPos = offsetToLineCol(originalText, shift);
    line = startPos.line + localPos.line;
    character =
      localPos.line === 0
        ? startPos.character + localPos.character
        : localPos.character;
  } else {
    line = localPos.line;
    character = localPos.character;
  }
  return {
    line,
    character,
    insertText: buildInsertText(target.indent, logLine, target.bodySplit),
  };
}

// ---------------- pure function entry ----------------

/**
 * 解析插入点。返回 null 表示无法通过 AST 解析（此时应由调用方回退到启发式）。
 */
export function resolveInsertPosition(
  text: string,
  fileName: string,
  startOffset: number,
  endOffset: number,
): InsertPosition | null {
  const embedded = extractEmbeddedScript(text, fileName);
  const isEmbedded = !!embedded;
  const effectiveText = embedded ? embedded.script : text;
  const shift = embedded ? embedded.startOffset : 0;

  if (isEmbeddedFileName(fileName) && !embedded) {
    return null;
  }

  const localStart = startOffset - shift;
  const localEnd = endOffset - shift;
  if (
    localStart < 0 ||
    localEnd < localStart ||
    localEnd > effectiveText.length
  ) {
    return null;
  }

  // typescript 的 createSourceFile 对语法错误是容忍的；acorn 会抛出，
  // 因此这里捕获解析异常并回退，保持 resolveInsertPosition 返回 null 的契约。
  let ast: Node;
  try {
    ast = Parser.parse(effectiveText, {
      ecmaVersion: "latest",
      sourceType: "module",
      locations: true,
      ranges: true,
    }) as Node;
  } catch {
    return null;
  }

  const parentMap = buildParents(ast);

  const id = findSelectedIdentifier(ast, localStart, localEnd);
  if (!id) {
    return null;
  }

  const selectedText = text.slice(startOffset, endOffset);
  const logLine = buildLogLine(selectedText);

  const target = isBindingIdentifier(id, parentMap)
    ? computeBindingInsertion(id, effectiveText, parentMap)
    : computeReferenceInsertion(id, effectiveText, parentMap);
  if (!target) {
    return null;
  }

  return toInsertPosition(
    text,
    effectiveText,
    shift,
    isEmbedded,
    target,
    logLine,
  );
}

// ---------------- vscode wrapper ----------------

/**
 * vscode 包装：从文档与选区取出文本/偏移，委托给纯函数。
 */
export function resolveInsertPositionFromDocument(
  document: vscode.TextDocument,
  selection: vscode.Selection,
): InsertPosition | null {
  // 仅依赖类型，运行时不需要 vscode（纯函数路径保持可脱离 vscode 单测）。
  const text = document.getText();
  const startOffset = document.offsetAt(selection.start);
  const endOffset = document.offsetAt(selection.end);
  return resolveInsertPosition(text, document.fileName, startOffset, endOffset);
}
