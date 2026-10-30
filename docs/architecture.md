# 地图与路线规划

`src/core.js` 保留原固定地图和遗传算法接口，并提供支持地图尺寸的 A*。`src/planner.js` 实现地图边界校验、分段路径缓存、三种排序算法及统一结果。浏览器和 CLI 调用同一模块。

## 地图契约

`schema_version: 1`；name 是不超过80字符的名称；width/height 为3–40的整数；entrance 是 [x,y]；blocked 是不重复的障碍坐标数组。exhibits 为1–10个对象，每项包含 id、label、pos 和 dwell_minutes。

id 使用大写字母开头及大写字母/数字/下划线/连字符，最长16字符；S 保留给入口。展品位置不能重叠或落在墙体/入口。停留时间为0–120分钟。例子见 examples/gallery-default.json 和 gallery-six.json。

## 求解过程

先对选中节点计算 A* 最短路径，得到距离矩阵。最近邻作为快速对照；遗传算法采用32个体、50代、4个精英，使用显式32位随机种子；Held–Karp 动态规划的状态为“已访问集合、终点”，复杂度 O(n²2ⁿ)，在最多10个展品的限制内计算精确排序。

三种算法使用相同距离矩阵和返回入口规则。显示的精确最优仅针对当前静态网格和所选停靠点，不代表真实展馆距离或拥堵条件下的最优路线。途中经过某展品不会自动算作计划停靠。地图不可达时直接失败，不展示上一条过期路线。

## 结果和兼容

新版结果 schema_version 为2，包含 map、options、order、route、segments、comparison 和 estimated_minutes。地图和临时封闭分开记录。导出地图时合并临时封闭；导出路线时保留两者及种子。

CLI 没有新版选项时保留旧版结果，保证原 examples/expected.json 可复现；添加 --method exact/nearest/genetic 即使用新引擎。

自定义地图只影响平面布局。三维查看器仍显示四个内置网格模型；不导入外部三维资源、不连接 XR 硬件。时间由网格步数及设定的停留时间计算，是估算值。
