import * as vscode from "vscode";
type BarItemOptions = {
  text: string;
  tooltip?: string;
  command?: string;
};
/** 添加状态栏项 */
export function createStatusBarItem(
  context: vscode.ExtensionContext,
  opt?: BarItemOptions,
) {
  const _opt = opt || {
    text: "log",
    tooltip: "快速插入 console.log (Ctrl+Alt+L)",
    // command: 'console-log.insertLog'
  };

  // 创建状态栏指示器 - 始终显示
  const statusBarItem = vscode.window.createStatusBarItem(
    vscode.StatusBarAlignment.Right,
    100,
  );
  statusBarItem.text = _opt.text;
  // statusBarItem.command = 'console-log.insertLog';
  statusBarItem.tooltip = _opt.tooltip;
  statusBarItem.show();
  // 将状态栏项添加到订阅，以便在扩展停用时自动清理
  context.subscriptions.push(statusBarItem);
}
