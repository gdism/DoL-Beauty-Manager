# 原生UI整合方向

管家应跟随游戏设计语言，方便其他UI美化Mod覆盖。以下是源码核对后的实现约束，尚未表示新UI已实现或任意主题已兼容。

## 已核对的原生接口

依据游戏5.12.13固定提交`0354ffeb81884323d70f2ec2338bcaa52567cb67`的`modules/css/theme.css`、`base.css`、`ui-start-menu.css`、默认布局样式，以及Options、overlayReplace和theme.js。

- 主题使用`--000`至`--900`及`--link`、`--danger`等变量。
- 原生按钮有`.macro-button`等样式；设置页使用`.settingsGrid`、`.settingsHeader`、`.settingsToggleItem`等结构。
- 原生浮层使用`.customOverlay`及统一标题/内容与关闭流程。分发器是明确key的switch，不能假设任意key可自动注册。
- 字体类位于html；浮层有单独字号和行距设置。

## 实现要求

继承游戏主题、字体、字号、行距及表单状态，移除固定内联配色和字体。优先通过经版本核验的适配器接入原生浮层与生命周期，避免复制宿主全局ID或覆盖其菜单状态。

保留普通CSS可覆盖的语义DOM，使用原生按钮、复选框、下拉和标签；不以Shadow DOM、iframe或canvas隔离界面。自有CSS主要负责ABC布局、树缩进、溢出和响应式，避免高优先级外观锁定，并提供稳定类名或data属性供主题扩展。

## 验收

核验原生主题、游戏字体/浮层字号/行距变化、宽屏ABC与窄屏纵排，以及具体第三方UI美化Mod对主要区域和交互状态的实际覆盖。只面向特定原生菜单的主题可能需要扩展选择器，不能承诺所有主题自动全面覆盖。
