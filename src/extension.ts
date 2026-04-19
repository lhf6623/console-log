// vscode' 模块包含 VS Code 扩展性 API
// 在下面的代码中导入该模块并使用 vscode 别名引用
import * as vscode from 'vscode';
import { addBarItem, addKeybinding } from './utils';

// 创建输出通道
const outputChannel = vscode.window.createOutputChannel('console-log');

// 当扩展被激活时调用此方法
// 首次执行命令时激活扩展
export function activate(context: vscode.ExtensionContext) {

	// 这行代码只会在扩展被激活时执行一次
	outputChannel.appendLine('恭喜，"console-log" 扩展现已激活！');

	// 添加状态栏项
	addBarItem(context);
	// 添加快捷键
	addKeybinding(context);
}

// 当扩展被停用时调用此方法
export function deactivate() {
	// 需要把状态栏项和输出通道等资源清理掉
	outputChannel.dispose();
}
