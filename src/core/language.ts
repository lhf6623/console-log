import * as vscode from "vscode";

const SUPPORTED_LANGUAGES = [
  "javascript",
  "javascriptreact",
  "typescript",
  "typescriptreact",
  "vue",
  "html",
  "svelte",
];

// 文件后缀
const SUPPORTED_FILE_EXTENSIONS = [
  ".js",
  ".jsx",
  ".ts",
  ".tsx",
  ".vue",
  ".html",
  ".svelte",
  ".cjs",
  ".mjs",
];
/** 判断当前语言是否支持 */
export function isSupportedLanguage(editor: vscode.TextEditor): boolean {
  const { languageId, fileName } = editor.document;
  // 先判断文件后缀，是否在支持的语言中
  if (
    SUPPORTED_FILE_EXTENSIONS.some((ext) =>
      fileName.toLocaleLowerCase().endsWith(ext),
    )
  ) {
    return true;
  }
  return SUPPORTED_LANGUAGES.includes(languageId);
}
