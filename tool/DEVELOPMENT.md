# 构建与验证

Python 3 标准库可重建产品；Node.js 用于验证。JSZip 3.10.1、pngjs 7.0.0、JSON5 2.2.3 的固定浏览器依赖及许可证随源码提供，构建不需要网络下载或 npm install。

## 可复现构建

```sh
python -B tools/build.py
python -B tools/build.py --twee-entry
node tests/release-smoke.cjs
node tests/rule-groups.cjs
node tests/diagnostics.cjs
node tests/profiles.cjs
node tests/source-dependencies.cjs
```

输出分别是 dist/DoLBeautyManager-M0.mod.zip、dist/DoLBeautyManager-Twee.mod.zip。ZIP 元数据时间固定，配置和认证规则顺序固定，源码包重建须与交付二进制 SHA-256 一致。`--fixture` 需要私有完整游戏副本，仅供任务内运行验证。

## 实现与规则合同

src/host.js 提供原生 BSA、仅 Hook、仅 ModLoader 的覆盖后端；bootstrap.js 在加载阶段预登记，避免宿主加载完成后已关闭的 BSA 缓存。manager.js 只操作自有覆盖层、独立存储与撤销快照，指纹排除自身而包含上游和实时模型函数。

sources.js 分离声明、登记、启用、可读和实际胜出。engine.js 在虚拟树保留八种历史操作语义；rules.js 按依赖组原子提交、校验后置条件及真实原版摘要。UI 对部分独立组保留不完整范围，manager.exportZip 也检查门禁。

四版 profile 仅规范化 LF 和边界空白，保留内部源码差异。运行时汉化变体另行冻结。Twee 构建使用经宏结构验证的精确锚点变体，默认 DOM 与占位共享所有权和一次绑定；无可见容器时保留尚待接管的合法占位。

规则原始意图不得自动认证；认证需输入/输出哈希、目标 profile、实际模型函数合同、依赖组和真实渲染控制。全透明输入需可见控制，不能把空画面当像素正确。新规则变更后重新运行对应认证，不覆盖旧失败证据。

ZIP 优先使用允许环境中的 Worker；固定宿主 CSP 禁止 Blob Worker 时使用可暂停的 JSZip 分块流。取消不返回半包，应用失败恢复原快照。不可修改宿主 CSP 绕过限制。

## 需要私有夹具的验证

以下测试不包含游戏或原美化资源；复现时须依法取得并按固定清单准备独立副本。原文件保持只读。

- engine.cjs：八操作及完整旧序列对照 Python 参照。
- sources.cjs、source-contracts.cjs、sources-runtime.cjs：四模式、JSON5、实际请求和未知声明阻塞。
- host-matrix.cjs：Chrome/Edge file/HTTP、仅 Hook/仅 ModLoader 的像素闭环。
- version-runtime.cjs：三个旧版的任务内完整副本、受控DOM/Renderer应用/重载/撤销/独立导出、原生开始按钮和入口；识别精确运行profile，并在缺少目标认证规则时拒绝自动修复。
- entry-matrix-runtime.cjs：DOM/Twee-only/Twee+DOM，真实导航与侧栏重建。
- reliability-runtime.cjs、persistence-runtime.cjs、partial-groups-runtime.cjs：取消、回滚、配额失败、来源变化、独立组与导出门禁。
- original-partial-runtime.cjs：全坏输入、未知代码依赖、基线坏图的组隔离与保存/重载/导出门禁。
- performance-runtime.cjs：相同840图在Chrome/Edge的阶段耗时、长任务与CDP采样JS堆；--profile另存CPU采样。
- eyeshadow-rule-runtime.cjs、path-rule-runtime.cjs：认证规则的实际模型控制。
- mascara-rule-runtime.cjs：单帧流妆的40状态与3帧控制、24张原版家族40状态、六图故障组隔离。
- fullpack-runtime.cjs、fullpack-independent-runtime.cjs：840 全组合、基线与新宿主的840请求和40代表图层/遮罩。

内部运行工具保存在任务工程；审阅源码白名单含无私有夹具的 smoke、组事务、诊断、profile变动和来源依赖测试。浏览器依赖的记录版本为 Playwright 1.62.1；浏览器路径由本机实际安装决定。测试必须用独立数据目录和受限网络。

## 本地审阅打包

```sh
python -B tools/package-local.py
python -B tools/verify-source-package.py
```

显式白名单排除 fixtures-private、原交接包、游戏 HTML/原图、reports、node_modules、本机日志和用户路径。清单列每个源码文件和二进制摘要。解包重建在任务目录的新子目录执行，不覆盖原工程。

源码许可及完整平台/规则矩阵未完成前，不将本地预览包称为正式公开发行版。

## Git开发位置与提交

仓库根部保留已发布的默认安装包，`tool/`是开发与可重建源码目录，`docs/`是产品与UI要求。后续功能修改在Git分支中进行，完成一个可说明的步骤并通过相应检查后提交。推送遵循该任务的授权范围，不使用强制推送或后台自动同步。

进入`tool/`后执行上面的构建与测试命令。`dist/`、`reports/`、私人夹具及依赖缓存均被排除跟踪；仅按明确清单暂存文件。不得将游戏/美化原图、私人报告、对话日志、用户路径或凭据加入Git历史。
