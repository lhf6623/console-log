// vscode' 模块包含 VS Code 扩展性 API
// 在下面的代码中导入该模块并使用 vscode 别名引用
import * as vscode from 'vscode';

// 创建输出通道
const outputChannel = vscode.window.createOutputChannel('console-log');

// 支持的 JavaScript 相关语言 ID
const SUPPORTED_LANGUAGES = [
	'javascript',
	'javascriptreact',
	'typescript',
	'typescriptreact',
	'vue',
	'html',
	'svelte'
];
// 文件后缀
const SUPPORTED_FILE_EXTENSIONS = [
	'.js',
	'.jsx',
	'.ts',
	'.tsx',
	'.vue',
	'.html',
	'.svelte',
	'.cjs',
	'.mjs',
];

// 判断当前语言是否支持
function isSupportedLanguage(editorDocument: vscode.TextDocument): boolean {
	const { languageId, fileName } = editorDocument;
	// 先判断文件后缀，是否在支持的语言中
	if (SUPPORTED_FILE_EXTENSIONS.some(ext => fileName.endsWith(ext))) {
		return true;
	}
	return SUPPORTED_LANGUAGES.includes(languageId);
}

// 当扩展被激活时调用此方法
// 首次执行命令时激活扩展
export function activate(context: vscode.ExtensionContext) {

	// 使用控制台输出诊断信息 (console.log) 和错误 (console.error)
	// 这行代码只会在扩展被激活时执行一次
	outputChannel.appendLine('恭喜，"console-log" 扩展现已激活！');

	// 创建状态栏指示器 - 始终显示
	const statusBarItem = vscode.window.createStatusBarItem(
		vscode.StatusBarAlignment.Right,
		100
	);
	statusBarItem.text = 'log';
	// statusBarItem.command = 'console-log.insertLog';
	statusBarItem.tooltip = '快速插入 console.log (Ctrl+Alt+L)';
	statusBarItem.show();

	// 将状态栏项添加到订阅，以便在扩展停用时自动清理
	context.subscriptions.push(statusBarItem);

	// 命令已在 package.json 文件中定义
	// 现在使用 registerCommand 提供命令的实现
	// commandId 参数必须与 package.json 中的 command 字段匹配
	// 快捷键: ctrl+option+l (Mac)
	const disposable = vscode.commands.registerCommand('console-log.insertLog', () => {
		// 获取活动编辑器
		const editor = vscode.window.activeTextEditor;
		if (!editor) {
			vscode.window.showInformationMessage('没有活动编辑器');
			return;
		}

		if (!isSupportedLanguage(editor.document)) {
			return;
		}

		// 获取选中的字符串
		const selection = editor.selection;
		const selectedText = editor.document.getText(selection);

		// 构建 log 语句
		const logLine = `console.log('${selectedText}:', ${selectedText});`;

		// 获取选中内容所在行（多行选中取最后一行）
		const currentLine = selection.end.line;
		const lineText = editor.document.lineAt(currentLine).text;

		// 计算当前行的缩进（空格或 tab）
		const indent = lineText.match(/^(\s*)/)?.[1] ?? '';

		// 在当前行末尾插入换行 + 缩进 + log 语句
		const insertPosition = new vscode.Position(
			currentLine,
			editor.document.lineAt(currentLine).range.end.character
		);

		editor.edit(editBuilder => {
			editBuilder.insert(insertPosition, `\n${indent}${logLine}`);
		});
	});

	context.subscriptions.push(disposable);
}

// 当扩展被停用时调用此方法
export function deactivate() {
	// 需要把状态栏项和输出通道等资源清理掉
	outputChannel.dispose();
}
