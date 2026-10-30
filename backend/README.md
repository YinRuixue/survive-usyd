# Survive USYD · Python 后端

## 启动游戏

双击项目根目录的 `Start Game.command`，会启动 Python 并打开 `http://127.0.0.1:8765`。
游戏过程中保持启动窗口打开；结束后在窗口中按 Control+C 停止。

也可以在项目根目录运行：

```sh
python3 backend/server.py --open-browser
```

需要 Python 3.9 或以上，无需安装额外依赖。端口被占用时，可加 `--port 8766`。
不要用静态文件服务器替代此命令，静态服务器不包含游戏接口。

## 已实现

- Python 执行原有剧情跳转、周计划、活动消耗、Fitness 恢复、恋爱分支、考试评分、Target 更新和全部结局条件。
- 读取 `html-game/data/game.json` 中的同一套规则，前端负责画面、交互和转盘动画。
- 本地原创背景音乐和按钮音效；底部 Audio 可分别静音与调节音量。首次交互后开始播放，离开标签页时暂停，音频偏好保存在浏览器中。
- 迎新转盘由 Python 随机抽取十种奖品，每种概率 10%；离线 HTML 同样支持随机抽奖。结果及奖励在动画开始前保存，重试不重复发奖。旧版已领取的固定餐饮券保留。
- 每次有效操作都在同一个数据库事务中保存；刷新页面自动恢复当前进度。
- 9 个手动存档位和独立自动存档，保存名字、性别、剧情位置、数值、选择、计划及弹窗返回位置。
- 新游戏和结局重开保留手动存档。
- 请求编号防止重试导致重复扣钱、结算或发奖励；版本检查防止多个标签页相互覆盖。
- 服务端只接受当前画面实际可用的按钮，不接受客户端自行指定数值或跳到任意剧情。

## 原有 HTML 存档迁移

以前直接打开 `html-game/index.html` 时，存档保存在那个浏览器的本地存储中，与 Python 数据库分开。

1. 用原浏览器刷新旧的 `file://` 游戏页面。
2. 打开 Save 或 Load，点击右下角 **Export saves**，下载备份文件。
3. 启动 Python 版，在 Save 或 Load 中点击 **Import saves**，选择该备份。
4. 从原来的槽位继续游戏。

导入只填补空槽位，已有槽位保持原样。也可以随时导出 Python 版存档备份。
直接双击 `index.html` 仍可运行离线版；Python 版请使用启动入口打开的地址。

## 数据保存位置

默认数据库为 `backend/data/survive.sqlite3`，第一次启动时自动创建。
不同浏览器资料使用各自的存档，由持久化会话 Cookie 对应。再次使用相同浏览器和地址即可继续。
若更换浏览器或清除网站数据，请先导出存档备份。

服务只监听本机 `127.0.0.1`。这是本地单机游戏后端，不包含互联网账号、云端同步或公开部署配置。
游戏运行期间若要移动整个文件夹，请先停止服务；备份整个 `backend/data` 文件夹可以保留数据库。

## 文件结构

```text
Start Game.command          macOS 双击启动
backend/server.py           HTTP 接口、静态文件和启动入口
backend/game_backend/engine.py   Python 游戏规则执行器
backend/game_backend/store.py    SQLite 会话、存档和防重复操作
backend/tests/              接口、持久化、完整路线和边界测试
html-game/backend-client.js     前端 API 连接及存档缓存
html-game/app.js            场景渲染与按钮交互
html-game/audio.js          音乐循环、音效与浏览器音频偏好
html-game/assets/audio/     原创 WAV 音频与来源说明
html-game/tools/create-audio.py  使用 Python 标准库生成原创音频
html-game/data/game.json    共享剧情和规则数据
```

## 接口

所有接口与网页同源，使用 HttpOnly / SameSite=Strict 会话 Cookie。
修改请求使用 JSON，携带 `revision` 与唯一 `requestId`；成功返回新 `state` 和 `revision`。
服务端检查请求来源及当前场景。重复请求返回同一结果；过时版本返回 409，提示刷新。

| 接口 | 用途 | 额外字段 |
| --- | --- | --- |
| GET `/api/health` | 健康状态 | 无 |
| GET `/api/session` | 当前进度、存档和会话 | 无 |
| GET `/api/saves` | 九个槽位及自动存档 | 无 |
| POST `/api/action` | 执行当前画面的按钮 | `action`，标题页可带 `playerName` |
| POST `/api/new-game` | 回到角色创建 | 无 |
| POST `/api/save` | 保存当前状态 | `slot`: 0–8 |
| POST `/api/load` | 读取状态 | `slot`: 0–8，`null` 为自动存档 |
| POST `/api/import` | 导入旧版备份到空位 | `backup` |

## 验证

在项目根目录运行：

```sh
python3 -m unittest discover -s backend/tests -v
```

测试使用临时数据库，不接触真实存档。包括：

- 男女主、恋爱成功、未开启支线、告白失败及不告白，加上十种转盘奖励下的满分恋爱路线，共 16 条完整路线：4,535 次操作与 JavaScript 规则逐项一致。
- 3,665 次边界操作，覆盖每周计划变体、活动实际数值、三次相同活动结局、资源失败优先级、期中成绩和外卖购买限制；小组作业可以从 Week 5 起补做至总进度 100%，并验证超额安排拦截及旧存档提示更新。
- 九槽保存、重新启动后恢复、会话隔离、原子导入、重复请求、版本冲突和接口访问边界。

六条分支路线固定抽中餐饮券作为可重复的比较基准，另外十条满分路线分别覆盖全部奖品。还单独测试随机抽取、保存和重试行为。测试基准压缩保存在 `backend/tests/fixtures/`。
以后修改剧情规则时，应同步更新 `data/game.json` 和 `game-data.js`，再重新生成测试基准。
