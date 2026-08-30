import * as vscode from "vscode";
import { isSupportedLanguage } from "./language";
import { resolveInsertPositionFromDocument } from "./insertPosition";

/** 添加快捷键 */
export function registerInsertLogCommand(
  context: vscode.ExtensionContext,
  opt?: {
    command: string;
    keybinding: string;
  },
) {
  const _opt = opt || {
    command: "console-log.insertLog",
  };
  const disposable = vscode.commands.registerCommand(_opt.command, () => {
    // 获取活动编辑器
    const editor = vscode.window.activeTextEditor;
    if (!editor) {
      vscode.window.showInformationMessage("没有活动编辑器");
      return;
    }

    if (!isSupportedLanguage(editor)) {
      return;
    }

    // 获取选中的字符串
    const selection = editor.selection;
    const selectedText = editor.document.getText(selection);
    const document = editor.document;

    // 优先使用 AST + 作用域分析解析精确插入点
    const astPosition = resolveInsertPositionFromDocument(document, selection);
    if (astPosition) {
      const insertPosition = new vscode.Position(
        astPosition.line,
        astPosition.character,
      );
      editor.edit((editBuilder) => {
        editBuilder.insert(insertPosition, astPosition.insertText);
      });
      return;
    }

    // 回退：直接在选中行下一行插入
    const logLine =
      "console.log(\`🔥" + selectedText + ":\`, " + selectedText + ");";

    const lineText = document.lineAt(selection.end.line).text;
    const indent = lineText.match(/^(\s*)/)?.[1] ?? "";

    const insertPosition = new vscode.Position(
      selection.end.line,
      document.lineAt(selection.end.line).range.end.character,
    );
    editor.edit((editBuilder) => {
      editBuilder.insert(insertPosition, "\n" + indent + logLine);
    });
  });

  context.subscriptions.push(disposable);
}
