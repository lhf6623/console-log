
import * as vscode from 'vscode';

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
/** 判断当前语言是否支持 */
function isSupportedLanguage(editor: vscode.TextEditor): boolean {
    const { languageId, fileName } = editor.document;
    // 先判断文件后缀，是否在支持的语言中
    if (SUPPORTED_FILE_EXTENSIONS.some(ext => fileName.toLocaleLowerCase().endsWith(ext))) {
        return true;
    }
    return SUPPORTED_LANGUAGES.includes(languageId);
}
/** 查找插入行 */
function findStatementEndLine(): number {
    const editor = vscode.window.activeTextEditor!;
    return editor.selection.end.line;
    // const { document, selection } = editor;

    // const startLine = selection.start.line;
    // const endLine = selection.end.line;

    // const bracketPairs: Record<string, string> = {
    // 	'(': ')',
    // 	'{': '}',
    // 	'[': ']',
    // };
    // const closeBrackets = new Set([')', '}', ']']);
    // const openBrackets = new Set(['(', '{', '[']);

    // const stack: string[] = [];

    // // 处理选中跨行的情况，不需要判断，直接返回插入行
    // if (startLine !== endLine) {
    // 	return endLine;
    // }

    // for (let i = startLine; i < document.lineCount; i++) {
    // 	const lineText = document.lineAt(i).text.trim();
    // 	// 如果末尾有分号或者是单行注释，直接返回当前行
    // 	if (lineText.endsWith(';') || lineText.startsWith('//')) {
    // 		return startLine;
    // 	}
    // 	// 多行注释,找到最后注释行
    // 	if (lineText.startsWith('/*')) {
    // 		while (i < document.lineCount) {
    // 			const lineText = document.lineAt(i).text.trim();
    // 			if (lineText.includes('*/')) {
    // 				return i;
    // 			}
    // 			i++;
    // 		}
    // 		// 注释未闭合，返回起始行
    // 		return startLine;
    // 	}
    // 	// 末尾是 { 寻找对应的 }，不考虑字符串和注释中的括号
    // 	if (lineText.endsWith('{')) {

    // 	}

    // 	for (let j = 0; j < lineText.length; j++) {
    // 		const ch = lineText[j];

    // 		if (openBrackets.has(ch)) {
    // 			stack.push(ch);
    // 		} else if (closeBrackets.has(ch)) {
    // 			if (stack.length === 0) { continue; }
    // 			const top = bracketPairs[stack[stack.length - 1]];

    // 			if (top === ch) {
    // 				stack.pop();
    // 				if (stack.length === 0) {
    // 					return i;
    // 				}
    // 			}
    // 		}
    // 	}
    // }

    // return startLine;
}

type BarItemOptions = {
    text: string;
    tooltip?: string;
    command?: string;
};
/** 添加状态栏项 */
export function addBarItem(context: vscode.ExtensionContext, opt?: BarItemOptions) {
    const _opt = opt || {
        text: 'log',
        tooltip: '快速插入 console.log (Ctrl+Alt+L)',
        // command: 'console-log.insertLog'
    };

    // 创建状态栏指示器 - 始终显示
    const statusBarItem = vscode.window.createStatusBarItem(
        vscode.StatusBarAlignment.Right,
        100
    );
    statusBarItem.text = _opt.text;
    // statusBarItem.command = 'console-log.insertLog';
    statusBarItem.tooltip = _opt.tooltip;
    statusBarItem.show();
    // 将状态栏项添加到订阅，以便在扩展停用时自动清理
    context.subscriptions.push(statusBarItem);
}

/** 添加快捷键 */
export function addKeybinding(context: vscode.ExtensionContext, opt?: {
    command: string;
    keybinding: string;
}) {
    const _opt = opt || {
        command: 'console-log.insertLog',
    };
    const disposable = vscode.commands.registerCommand(_opt.command, () => {
        // 获取活动编辑器
        const editor = vscode.window.activeTextEditor;
        if (!editor) {
            vscode.window.showInformationMessage('没有活动编辑器');
            return;
        }

        if (!isSupportedLanguage(editor)) {
            return;
        }

        // 获取选中的字符串
        const selection = editor.selection;
        const selectedText = editor.document.getText(selection);

        if (!selectedText) {
            return;
        }

        // 构建 log 语句
        const logLine = 'console.log(\`' + selectedText + ':\`, ' + selectedText + ');';

        // 从选中起始行向下，用括号匹配找到当前语句结尾
        const document = editor.document;
        const targetLine = findStatementEndLine();

        // 取选中起始行的缩进
        const lineText = document.lineAt(targetLine).text;
        const indent = lineText.match(/^(\s*)/)?.[1] ?? '';

        // 在目标行末尾插入换行 + 缩进 + log 语句
        const insertPosition = new vscode.Position(
            targetLine,
            document.lineAt(targetLine).range.end.character
        );

        editor.edit(editBuilder => {
            editBuilder.insert(insertPosition, `\n${indent}${logLine}`);
        });
    });

    context.subscriptions.push(disposable);
}