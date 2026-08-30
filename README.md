# Console Log

快速插入 `console.log` 的 VS Code 扩展。

选中变量或表达式，一键插入带变量名的 `console.log`，自动保持缩进。

## 功能

- 选中 `user.name`，按快捷键自动插入带变量名的 `console.log`，见下方“使用示例”。
- 自动保持当前行的缩进
- 支持多行选中，log 插入在选区最后一行下方
- 右下角状态栏提示

## 快捷键

| 平台            | 快捷键       |
| --------------- | ------------ |
| Windows / Linux | `Ctrl+Alt+L` |
| macOS           | `Ctrl+Alt+L` |

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
console.log(`🔥user.name:`, user.name);
```

> 说明：扩展会先基于 AST 做作用域分析，尽量把 `console.log` 插到变量仍“在作用域内”的位置（例如函数/箭头体内部、语句之后）；无法精确分析时才回退到在选中行下一行插入。

## 开发

### 项目结构

```
src/
  extension.ts            # 扩展入口（activate/deactivate），负责组装
  core/
    language.ts           # 语言/代码后缀检测
    insertPosition.ts     # AST + 作用域分析：精确定位 console.log 插入点
    insertLog.ts          # 插入 console.log 的命令（AST 优先，失败则下一行兜底）
    statusBar.ts          # 右下角状态栏项
```

### 开发调试

- 按 `F5` 打开一个加载了扩展的新窗口。
- 按 `Ctrl+Shift+P`（macOS 为 `Cmd+Shift+P`）打开命令面板，输入 `Insert Console.log` 来运行命令。
- 在 `src/extension.ts` 中设置断点来调试扩展。
- 在调试控制台中查看扩展的输出。

### 修改代码

- 修改 `src/extension.ts` 后，可以从调试工具栏重新启动扩展。
- 也可以按 `Ctrl+R`（macOS 为 `Cmd+R`）重新加载 VS Code 窗口以加载更改。

### 打包发布

```bash
# 打包成 .vsix 文件
pnpm run package
vsce package

# 发布到 VS Code 插件市场
vsce publish
```

### 格式化

项目使用 [Prettier](https://prettier.io/) 统一代码风格，配置见 [`.prettierrc.json`](./.prettierrc.json)。

```bash
# 格式化全部文件
pnpm format

# 仅检查格式是否合规（不修改文件）
pnpm format:check
```

格式检查已集成到 `pnpm run compile`，CI 发布前会自动校验。

推荐在 VS Code 中安装 [Prettier 扩展](https://marketplace.visualstudio.com/items?itemName=esbenp.prettier-vscode)，保存时自动格式化。

## 已知问题

暂无

## 更新日志

- **v0.1.0（当前）**：改用 `acorn` + `acorn-typescript` 做 AST 作用域分析，让 `console.log` 插到变量在作用域内的位置（`dist` 约 230KB）；移除括号匹配启发式，兜底改为在选中行下一行插入。
- **v0.0.5**：引入 Prettier 统一代码风格，接入格式检查。
- **v0.0.1**：首次发布，支持 `Ctrl+Alt+L` 快速插入带变量名的 `console.log`。
