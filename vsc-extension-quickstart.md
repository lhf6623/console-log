# Console Log - VS Code 扩展开发指南

## 项目结构

* `package.json` - 扩展清单文件，声明扩展信息、命令和快捷键。
* `src/extension.ts` - 主文件，包含命令的实现逻辑。
* `esbuild.js` - 构建配置，用于打包扩展。

## 开发调试

* 按 `F5` 打开一个加载了扩展的新窗口。
* 按 `Ctrl+Shift+P`（Mac 上为 `Cmd+Shift+P`）打开命令面板，输入 `Insert Console.log` 来运行命令。
* 在 `src/extension.ts` 中设置断点来调试扩展。
* 在调试控制台中查看扩展的输出。

## 修改代码

* 修改 `src/extension.ts` 后，可以从调试工具栏重新启动扩展。
* 也可以按 `Ctrl+R`（Mac 上为 `Cmd+R`）重新加载 VS Code 窗口以加载更改。

## 运行测试

* 安装 [扩展测试运行器](https://marketplace.visualstudio.com/items?itemName=ms-vscode.extension-test-runner)
* 通过 **Tasks: Run Task** 命令运行 "watch" 任务。
* 从活动栏打开测试视图，点击 "Run Test" 按钮。

## 打包发布

```bash
# 打包成 .vsix 文件
pnpm run package
vsce package

# 发布到 VS Code 插件市场
vsce publish
```
