# SandBase Jev Trader

[English](README.md) | 中文

每 300 毫秒一个 tick，一次交易决策。模型盯着一份合成出来的 Anthropic 订单簿，
每个 tick 回答一次买还是卖，然后按这个方向挂一张 post-only 限价单，挂在盘口内侧
一个最小变动价位，同时撤掉上一张。成交来自主动单打进来，所以这个做市台赚的是价差，
不是付价差。一个小服务把每个 tick 推给实时看板。

> **Anthropic 没有上市，所以这里不存在真实市场。** 标的和订单簿都是虚构的。
> 真实的是这套机器：一次决策、一张挂单、一条成交与盈亏的记账链路，跑在一个固定
> 时钟上。仓库里没有任何投资建议，模型也不是在追求盈利。

## 运行

```sh
bun install
bun run start
```

看板另开一个终端：

```sh
cd web
bun install
cp .env.example .env.local
bun run dev
```

后端在 `http://localhost:3000`，看板连它并监听 `http://localhost:3001`。

两个常用命令：

```sh
bun run typecheck
bun run scripts/session.ts 8000   # 离线回放，输出成交归因
```

## 接口

- `GET /` 快照：模型、标的、种子、最新 tick
- `GET /history` 最近 1000 个 tick
- `GET /events` SSE：连上时发一次 `snapshot`，之后每个 tick 一个 `tick` 事件

事件结构见 `src/trader.ts` 的类型定义，字段含义在英文 README 里逐条说明了。

## 市场怎么模拟的

Anthropic 没有订单簿可读，所以 `src/exchange.ts` 同时扮演交易所和行情源。
它的几个性质比看上去重要：

- **一个 tick 分两段。** `beginTick()` 先兑现上一 tick 计划好的价格变动、规划下一
  次变动、生成订单簿；`trade()` 再跑这一 tick 的主动单流，并且**优先撮合我们自己的
  挂单**。
- **挂单必须在它被挂出的那个 tick 内就生效。** 拿上一 tick 的旧盘口报价、只把这
  张单交给下一 tick 的流来吃，是一个结构上必亏的设计：这样一来，「被成交」这件事
  本身就在筛选「价格已经反向走掉」的时刻。在这套模拟里实测，光是改对这个顺序，
  一个会话的盈亏就差出约 10 个百分点（从大约 -6% 变成大约 +4%）。
- **挂单深度里带着信号。** 每一份生成的订单簿都会朝它即将走的方向倾斜，所以
  `bookImbalance` 是真有预测力的。倾斜里刻意加了噪声：是优势，不是白送。
- **主动单大部分是不知情的。** `FLOW_LEAN` 决定其中有多大比例是按信号交易的，
  这个比例就是做市方面对的逆向选择，也是「盈利」和「失血」之间最主要的旋钮。
  默认值下，这个台子小幅盈利，并且有真实的回撤。

`bun run scripts/session.ts` 会打印归因：模型选边准确率，以及每笔成交后在
+1/+5/+20/+50 个 tick 上每股的平均优势。

## 模型

默认的 `stand-in` 是一个本地启发式：盘口深度失衡（权重最高）、主动单流和短期动量
（权重较低），再加一个按 tick 播种的抖动。看板上把它标成 `stand-in model`，
因为它就是。

想接真实模型，设 `MODEL=claude` 和 `ANTHROPIC_API_KEY`。注意托管模型会跳过预热，
因为那需要每个 tick 一次网络请求。

## 视频

两版都在仓库里。

- `video/takes/hero.mp4` —— 31 秒看板实录，1920x1080 / 30fps。录制工具在 `video/`：
  用 CDP screencast 保住每一次重绘的完整画质，再把真实的逐帧时间戳重采样到固定
  网格上，所以节奏跟得住 tick 时钟。
- `videos/sandbase-jev-trader/renders/sandbase-jev-trader.mp4` —— 34.5 秒包装片，
  用 HyperFrames 制作，配了一段极简环境音。片子里每一个数字都是这次运行真实产出的。
  分镜在 `videos/sandbase-jev-trader/STORYBOARD.md`。

## 环境变量

见 `.env.example`。影响最大的几个：`SEED`（可复现性）、`VOL_BPS`（行情快慢）、
`FLOW_LEAN`（主动单里有多少是知情的）、`TICK_MS`、`TRADE_SIZE`、`MAX_POSITION`。

## 来源

改编自 [jarrodwatts/jev-trader](https://github.com/jarrodwatts/jev-trader)。原项目做的
是同一件事，只不过发生在真实场所：一个 TypeSafe Jev 模型在 Monad 上给 Kuru 的
MON-USDC 盘口报价，每个 300ms 区块一张单，赚价差而不是付价差。

这里的架构、看板的设计系统，以及「每 tick 一次决策、并且整体替换」这个核心想法，
都来自那个项目。改掉的是市场（用带种子的模拟替代链和真实交易所）和标的
（一个虚构的 Anthropic 上市标的，因为 Anthropic 未上市、没有盘口可读）。

MIT 许可。原始版权声明保留在 [LICENSE](LICENSE)。
