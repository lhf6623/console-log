# 欢迎使用 VS Code 扩展

## 文件夹内容

* 此文件夹包含扩展所需的所有文件。
* `package.json` - 扩展清单文件，用于声明扩展和命令。
  * 示例插件注册了一个命令，并定义了其标题和命令名称。VS Code 可根据这些信息在命令面板中显示该命令。此时还不需要加载插件。
* `src/extension.ts` - 主文件，包含命令的实现逻辑。
  * 该文件导出一个 `activate` 函数，首次激活扩展时会被调用（在本例中通过执行命令触发）。在 `activate` 函数中，我们调用 `registerCommand`。
  * 将包含命令实现逻辑的函数作为第二个参数传递给 `registerCommand`。

## 设置

* 安装推荐的扩展（amodio.tsl-problem-matcher、ms-vscode.extension-test-runner 和 dbaeumer.vscode-eslint）

## 立即开始运行

* 按 `F5` 打开一个加载了扩展的新窗口。
* 按 `Ctrl+Shift+P`（Mac 上为 `Cmd+Shift+P`）打开命令面板，输入 `Hello World` 来运行命令。
* 在 `src/extension.ts` 中设置断点来调试扩展。
* 在调试控制台中查看扩展的输出。

## 进行修改

* 修改 `src/extension.ts` 中的代码后，可以从调试工具栏重新启动扩展。
* 也可以按 `Ctrl+R`（Mac 上为 `Cmd+R`）重新加载 VS Code 窗口以加载您的更改。

## 探索 API

* 打开 `node_modules/@types/vscode/index.d.ts` 文件可以查看完整的 API。

## 运行测试

* 安装 [扩展测试运行器](https://marketplace.visualstudio.com/items?itemName=ms-vscode.extension-test-runner)
* 通过 **Tasks: Run Task** 命令运行 "watch" 任务。确保此任务正在运行，否则可能无法发现测试。
* 从活动栏打开测试视图，点击 "Run Test" 按钮，或使用快捷键 `Ctrl/Cmd + ; A`
* 在测试结果视图中查看测试结果。
* 可以修改 `src/test/extension.test.ts` 或在 `test` 文件夹中创建新的测试文件。
  * 测试运行器只会匹配名称符合 `**.test.ts` 模式的文件。
  * 可以在 `test` 文件夹中创建子文件夹来组织测试。

## 进一步探索

* 通过 [打包扩展](https://code.visualstudio.com/api/working-with-extensions/bundling-extension) 来减小扩展体积并加快启动速度。
* 在 VS Code 扩展市场[发布您的扩展](https://code.visualstudio.com/api/working-with-extensions/publishing-extension)。
* 通过设置[持续集成](https://code.visualstudio.com/api/working-with-extensions/continuous-integration) 来自动化构建。
