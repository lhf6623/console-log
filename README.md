# Console Log

快速插入 `console.log` 的 VS Code 扩展。

选中变量或表达式，一键插入 `console.log('变量名:', 变量名)`，自动保持缩进。

## 功能

- 选中 `user.name`，按快捷键自动插入 `console.log('user.name:', user.name);`
- 自动保持当前行的缩进
- 支持多行选中，log 插入在选区最后一行下方
- 右下角状态栏提示

## 快捷键

| 平台 | 快捷键 |
|---|---|
| Windows / Linux | `Ctrl+Alt+L` |
| macOS | `Ctrl+Alt+L` |

也可以通过命令面板（`Cmd+Shift+P`）搜索 `Insert Console.log` 触发。

## 支持的语言

JavaScript、TypeScript、Vue、HTML、Svelte

## 使用示例

选中代码中的变量：

```javascript
const name = user.name;
//            ^^^^^^^^ 选中
```

按 `Ctrl+Alt+L`，自动插入：

```javascript
const name = user.name;
console.log('user.name:', user.name);
```

## 已知问题

暂无

## 更新日志

参见 [CHANGELOG.md](./CHANGELOG.md)
