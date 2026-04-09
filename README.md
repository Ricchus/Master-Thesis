# Office Workflow Local Study App

一个本地运行的 Vite + React + TypeScript 实验程序，用于让受试者在两种 assistant 界面下完成同类 office workflow simulation。

## 项目现状

当前版本保留并支持以下核心能力：

- 两轮实验流程
- 四种组合随机且理论上等概率
  - ChatGPT → Avatar / Avatar → ChatGPT
  - Set A → Set B / Set B → Set A
- `participant ID` 自动生成，且全程固定
- 15 分钟总时长的 meeting countdown
- Stage 1A：required email replies
- Stage 1B：pre-meeting task breakdown
- Stage 2：analysis brief
- urgent task 插入
- meeting hard cutoff
- EMA 外跳 checkpoint
- researcher mode
- researcher timeline 点击跳转阶段
- reset 并重开
- 本地断点恢复
- 内容核验机制
- ChatGPT shell 与 Avatar shell 可独立替换

---

## 目录说明

### 主流程入口

- `src/App.tsx`

### Intro / Guide 组件

- `src/components/IntroScreen.tsx`
- `src/components/GuideOverlay.tsx`

### Avatar assistant 独立目录

必须继续保留在独立目录中，方便后续单独替换：

- `src/assistant-shells/avatar-ui/`

Avatar 动画与状态机相关逻辑在：

- `src/features/avatar/`

### ChatGPT 风格 shell

- `src/assistant-shells/chatgpt-ui/`

### 样式

- `src/styles.css`

### 状态 / 持久化 / 随机化

- `src/lib/types.ts`
- `src/lib/storage.ts`
- `src/lib/randomization.ts`

### 材料与核验

- `src/data/materials.ts`
- `src/lib/materials.ts`
- `src/lib/validation.ts`

### Vercel API Routes

- `api/chat.js`
- `api/validate.js`
- `api/_openai.js`

### 环境变量示例

- `.env.example`

---

## 安装与运行

### 1. 安装依赖

```bash
npm install
```

### 2. 配置 OpenAI API key

当前版本不再把 OpenAI key 放在前端代码里。

生产环境推荐部署到 Vercel，并在项目设置里配置：

- `OPENAI_API_KEY`
- `OPENAI_MODEL`

仓库根目录的 `.env.example` 只用于展示需要哪些变量名。

### 3. 启动开发环境

```bash
npm run dev
```

默认地址通常是：

```text
http://localhost:5173
```

说明：

- 这个命令只启动 Vite 前端
- 本地前端界面可以正常预览
- live assistant reply 与 AI validation 现在走 `/api/*`
- 如果你没有同时运行 Vercel 的本地函数环境，那么 assistant 会提示 backend 不可用，validation 会自动退回规则检查

### 3.1 本地联调前端 + `/api/*`

如果要在本地完整测试 assistant 对话与 AI validation，而不只是预览前端 UI，请使用：

```bash
npx vercel dev
```

说明：

- 这会同时启动前端和 `api/` 目录下的本地 serverless functions
- 第一次运行如果本机没有 Vercel CLI，`npx` 会自动拉起临时执行环境
- 如果本地也要真实调用 OpenAI，需要在当前 shell 环境或 Vercel 本地环境里提供：
  - `OPENAI_API_KEY`
  - `OPENAI_MODEL`

### 4. 生产构建

```bash
npm run build
```

---

## Vercel 部署

当前项目已经改成适合 Vercel 的最小后端结构：

- 前端：Vite + React
- 后端：`api/` 目录下的 serverless functions

推荐流程：

1. 把仓库推到 GitHub
2. 在 Vercel 网页端导入该 repo
3. 在 `Settings -> Environment Variables` 中添加：
   - `OPENAI_API_KEY`
   - `OPENAI_MODEL`
4. 重新部署

部署完成后：

- assistant chat 走 `/api/chat`
- AI validation 走 `/api/validate`
- 浏览器端不再持有 OpenAI key

---

## 当前技术框架（重要）

这一节是为了防止后续换一个新对话后，因为缺少上下文而把当前已经稳定下来的结构再次改坏。
如果后续要修改 assistant、avatar、消息 reveal 或 GIF 切换逻辑，建议先读完这一节。

### 1. 总体分层

当前程序和 assistant 相关的结构，分成 5 层：

1. `App.tsx` 的 transcript / request 层
2. shared assistant reply playback queue
3. shared text rendering 层
4. avatar reply coordination 层
5. avatar media playback 层

这 5 层职责已经刻意拆开。后续修改时，优先在正确的那一层修问题，不要跨层补丁。

### 2. Transcript / request 层

核心文件：

- `src/App.tsx`
- `src/lib/assistant.ts`
- `src/lib/types.ts`

职责：

- 持有整轮真实消息 transcript：`RoundState.chatMessages`
- 用户发送消息时先写入 user message
- 发起 `/api/chat`
- 收到结果后再写入 assistant message
- 维护 `assistantBusy`

关键约束：

- `ConversationMessage` 只表示消息本身：
  - `id`
  - `role`
  - `text`
  - `createdAt`
- 不要再把 reveal / queued / static 这种 UI 播放状态写回 `ConversationMessage`
- `assistantBusy` 只表示“请求是否还在飞行中”，不表示“assistant 回复是否已经 reveal 完成”

### 3. Shared assistant reply playback queue

核心文件：

- `src/assistant-shells/shared/useAssistantReplyPlayback.ts`

职责：

- 这是当前 assistant 回复 reveal 的单一真相源
- 它负责把“挂载后新出现的 assistant 消息”加入 FIFO 队列
- 它保证 assistant 回复按到达顺序播放，不再使用“只盯最新一条消息”的旧逻辑
- 它统一提供：
  - 当前 active reply message
  - 当前 playback phase
  - reveal duration
  - 每条消息的 render mode

当前 phase：

- `idle`
- `awaiting_start`
- `revealing`
- `awaiting_settle`

当前 render mode：

- `static`
- `queued`
- `revealing`

关键约束：

- `queued` assistant message 是故意不渲染出来的，避免空壳气泡或全文闪现
- 不要重新引入“最新 assistant message heuristic”
- 不要在 shell 里再次维护一套独立 reply phase
- 两个 shell 都应消费这一份 queue，而不是各自再猜测哪条 assistant 消息该播放

### 4. Shared text rendering 层

核心文件：

- `src/assistant-shells/shared/assistantMessageContent.tsx`

职责：

- 统一 assistant 文本的结构化解析与渲染
- 统一 reveal 阶段和 reveal 完成阶段的 DOM 语义结构
- 统一 reveal 时长预算计算

当前原则：

- reveal 阶段和最终静态显示阶段必须使用同一套结构化 block model
- 无序列表从一开始就应是 `<ul><li>`
- 有序列表从一开始就应是 `<ol><li>`
- 段落从一开始就应是 `<p>`
- 不要再回到“动画阶段直接按原始字符串切字符，完成后再换成格式化 DOM”的做法

这样做是为了避免：

- bullet point 在 reveal 中先显示 `-`
- reveal 完成后再闪一下变成 `·`
- reveal 与静态阶段因为 DOM 结构不同而产生额外布局跳动

### 5. Avatar reply coordination 层

核心文件：

- `src/assistant-shells/avatar-ui/useAvatarReplyCoordinator.ts`

职责：

- 这是 avatar controller 的唯一编排入口
- 它把：
  - `isLoading`
  - `hasInput`
  - shared reply queue 的 phase
  - avatar runtime 当前状态
  组合成真正的 avatar 动作策略
- 它负责：
  - startup warm
  - explain 启动确认
  - explain 启动超时兜底
  - explain 结束后的 settle
  - 对 hold state 的 runtime 对齐

关键约束：

- 后续如果要改 avatar 行为，优先改这个文件
- 不要再在 shell 内部、button handler、或别的 effect 里直接 `controller.requestState(...)`
- 不要再让多个地方同时写 avatar controller

当前单一写入源原则：

- `useAvatarReplyCoordinator.ts` 才是 controller 的唯一 writer
- `AvatarAssistantShell.tsx` 负责消费协调结果，不负责自己再写一套 avatar 状态机
- `useAvatarController.ts` 只负责创建 / reset / dispose controller，不负责行为策略

### 6. Avatar runtime / media playback 层

核心文件：

- `src/features/avatar/avatarController.ts`
- `src/features/avatar/useAvatarController.ts`
- `src/features/avatar/AvatarMediaPlayer.tsx`
- `src/features/avatar/gifPlayback.ts`

职责拆分：

- `avatarController.ts`
  - avatar 状态机与 runtime 更新
- `useAvatarController.ts`
  - controller 生命周期
- `AvatarMediaPlayer.tsx`
  - canvas / GIF 播放器接入
- `gifPlayback.ts`
  - GIF 解码与帧级播放

关键约束：

- 当前 GIF 的播放方式已经恢复为原 avatar demo 风格的播放器，不是普通 `<img>` 定时切换
- 如果问题属于“回复什么时候开始 reveal”“avatar 什么时候进 explain”“为什么多次请求导致动作乱跳”，优先检查 coordinator / queue，不要先改 GIF 播放器
- 只有在确认问题真的是媒体解码、帧时序、canvas 渲染层的问题时，才应修改 `AvatarMediaPlayer.tsx` 或 `gifPlayback.ts`

### 7. 两种 shell 的关系

核心文件：

- `src/assistant-shells/chatgpt-ui/ChatgptAssistantShell.tsx`
- `src/assistant-shells/avatar-ui/AvatarAssistantShell.tsx`

当前原则：

- 两个 shell 共用同一套 assistant reply playback queue
- 两个 shell 共用同一套 assistant 文本 reveal / formatted rendering 组件
- 不同点只在于：
  - Avatar shell 额外接入 avatar coordinator 和 avatar player
  - ChatGPT shell 不需要 explain handshake，队列头在合适时机可直接开始 reveal

这意味着：

- 对话 reveal 时序问题，优先修 shared queue / shared text rendering
- avatar explain / idle / listening / thinking 时序问题，优先修 avatar coordinator
- 不要为了解某个 shell 的局部症状，复制一套新的 reveal 逻辑

### 8. 当前 conversation key 的作用

当前两个 shell 都使用稳定 conversation key 重置 shared playback queue。

目的：

- round 或 conversation 切换时，旧会话的 seen assistant message 集合要清空
- 新会话的欢迎语或已存在 transcript 不应误进 reveal 队列

如果以后要改 conversation key：

- 要保证它在“同一轮同一段 transcript”内稳定
- 只在真正进入新会话时变化
- 否则会导致 reveal queue 被意外重置

### 9. 未来修改时不要做的事

下面这些做法，之前已经证明会让结构再次混乱：

- 不要把 UI reveal 状态写回 `ConversationMessage`
- 不要在 `AvatarAssistantShell.tsx` 里直接再写 `controller.requestState(...)`
- 不要在 `useAvatarController.ts` 里重新加入自动 `boot()` 或别的策略行为
- 不要把 assistant 回复 reveal 再改回“按最新一条消息猜测”
- 不要让 reveal 阶段和静态阶段使用不同的 DOM 结构
- 不要为了修对话时序问题，优先去改 GIF 播放器

### 10. 推荐的排错顺序

以后如果再出现问题，建议按这个顺序查：

1. assistant message 是否已经进入 `chatMessages`
2. shared queue 是否正确入队、出队、推进 phase
3. shell 是否正确按 `renderMode` 渲染
4. avatar coordinator 是否正确请求并确认 explain / settle
5. 最后才看 GIF 播放器本身

这样可以避免把 transcript 问题误判成播放器问题，也能避免把媒体问题误判成 queue 问题。

---

## Intro 与 Guide

### Intro

应用首次进入时先显示 Intro 页面，而不是直接进入 round。

Intro 会说明：

- 这是一个时间限制下的 office workflow simulation
- 会完成两轮任务
- 两轮中会使用两种不同的 assistant interface
- `participant ID` 在外部 survey 中需要重复使用
- meeting countdown 表示距离 meeting 开始还剩多少时间
- meeting 开始后程序会锁定编辑
- 请仅使用界面内材料完成任务

点击 `Continue` 后进入 Guide。

### Guide

Guide 是一个覆盖在真实界面上的 onboarding overlay，不是静态说明页。

Guide 会逐步高亮并介绍：

1. Participant ID 与 Copy ID
2. Background dropdown
3. Meeting countdown
4. researcher timeline（仅作为流程指示，不向普通用户暴露 researcher 功能）
5. 左侧 materials 区入口
6. 左侧材料阅读区域
7. 右上工作区
8. 右下 assistant 区
9. Continue / validation 按钮

Guide 支持：

- `Back`
- `Next`
- `Skip guide`
- `Finish guide`

Guide 完成后才进入正式实验流程。

---

## participant ID 如何工作

程序会自动生成一个唯一 `participant ID`。

格式中包含：

- 日期
- 时间
- 随机短码
- 实验组合编码

这个 ID：

- 在两轮中保持不变
- 在所有 EMA survey 中重复使用
- 刷新页面后仍保持不变
- reset 前不会改变

---

## 实验流程

### App-level flow

当前应用顶层状态分为：

- `intro`
- `guide`
- `study`
- `finished`

### 每轮内部流程

1. Round intro
2. EMA 1
3. Stage 1A：required email replies
4. Stage 1B：pre-meeting task breakdown
5. EMA 2
6. Analysis brief
7. Urgent task（analysis 开始约 5 分钟后触发）
8. EMA 3
9. Analysis continuation
10. Hard cutoff
11. EMA 4
12. Round complete

### 时间规则

- meeting 前总工作时间固定 15 分钟
- 倒计时从 EMA 1 完成、正式进入工作区后开始
- meeting 开始后立即 hard cutoff
- hard cutoff 后编辑锁定

---

## researcher mode 与 reset 快捷键

### researcher mode

Windows / Linux：

```text
Ctrl + Alt + Shift + M
```

macOS：

```text
Command + Option + Shift + M
```

说明：

- researcher mode 默认隐藏
- 仅通过快捷键切换
- 在 researcher mode 下，顶部 timeline 节点可点击，能直接跳转阶段
- 在 researcher mode 下，header 还会显示 researcher-only 的 `Urgent task` 倒计时或状态
- researcher timeline 跳到 `analysis / urgent / ema3 / cutoff / ema4` 时，会同步重建这几个阶段对应的时间戳语义，保证 urgent trigger 与 cutoff 显示可信
- 为避免误触，输入框 / textarea / select / contenteditable 内不会触发该快捷键

### reset

Windows / Linux：

```text
Ctrl + Alt + Shift + R
```

macOS：

```text
Command + Option + Shift + R
```

说明：

- 会弹出确认框
- 确认后清除本地 session、guide 进度、所有草稿和 round 进度
- 清除后重新生成新的 participant ID 和随机组合

---

## 本地断点恢复

程序使用浏览器本地存储保存会话。

当前会保存：

- `participant ID`
- 当前 app flow：`intro / guide / study / finished`
- 当前 guide step
- 当前 round
- 当前 phase
- 所有草稿内容
- 计时起点
- EMA 完成状态
- researcher mode 状态

恢复逻辑：

- 如果还没通过 Intro，刷新后回到 Intro
- 如果正在 Guide 中，刷新后回到当前 Guide step
- 如果已经完成 Guide，刷新后直接回到 study
- 正式实验中的草稿、计时和阶段进度会继续恢复
- reset 后重新回到 Intro，并且 Guide 会重新出现

---

## 布局说明

当前主界面采用固定 viewport 布局，而不是长网页堆叠：

- 顶部采用紧凑 header，participant 信息、阶段信息、background、countdown、timeline 集中在同一个 header 区
- 主体区域占据剩余高度
- 左区是 materials
- 右区分为：
  - 上部工作区
  - 下部 chatbot 区
- 各子区域内部独立滚动
- assistant 区域相对上一版得到更多空间
- avatar assistant 使用独立舞台进行等比缩放，以尽量保持原 demo 比例与内部布局
- 在常见桌面全屏尺寸下，主界面应保持一屏可用

---

## 内容核验逻辑

### Stage 1A：指定邮件回复

检查：

- 两封指定邮件都已回复
- `To / Subject / Body` 不为空
- 回复正文至少是一两句完整英文句子
- 若配置了 API，会进一步判断是否真的回应了原邮件请求

### Stage 1B：Pre-meeting task breakdown

检查：

- 至少 3 条任务
- 每条不能太短
- 不能重复
- 不能是泛泛空话
- 若配置了 API，会进一步检查是否为真正的 meeting 前动作

### Analysis Brief

检查：

- findings / evidence / recommendation / risk / questions 都有内容
- evidence 至少达到基本长度
- 若 Vercel 环境变量已配置，会检查是否明显离题或敷衍

### Urgent Task

检查：

- Type A：customer reply + 3 step action plan
- Type B：add-on note + 3 bullets
- 若 Vercel 环境变量已配置，会检查输出是否与类型匹配

---

## 外部 Survey URL

当前已按 round / EMA 配置为 8 份固定问卷：

```text
Round 1 / EMA 1: https://gatech.co1.qualtrics.com/jfe/form/SV_a9I8QWdCu8nvWjs
Round 1 / EMA 2: https://gatech.co1.qualtrics.com/jfe/form/SV_6JqGbsDmrQ7GW5o
Round 1 / EMA 3: https://gatech.co1.qualtrics.com/jfe/form/SV_1A1ScZCjg1SnKAu
Round 1 / EMA 4: https://gatech.co1.qualtrics.com/jfe/form/SV_6FDWo9PBtbNNLZI
Round 2 / EMA 1: https://gatech.co1.qualtrics.com/jfe/form/SV_4YpuK5cybC16SEK
Round 2 / EMA 2: https://gatech.co1.qualtrics.com/jfe/form/SV_6fEXeD3oBv0XMdE
Round 2 / EMA 3: https://gatech.co1.qualtrics.com/jfe/form/SV_9LFY9RV6CnLQI3Y
Round 2 / EMA 4: https://gatech.co1.qualtrics.com/jfe/form/SV_87x4PTPFdihypb8
```

程序在打开链接时还会额外附加：

- `participant`
- `round`
- `ema`

位置在：

- `src/App.tsx`
- `surveyUrl(...)`

---

## Avatar shell 如何单独替换

保留并优先修改：

- `src/assistant-shells/avatar-ui/`

如果你只想替换 Avatar assistant UI：

- 保持 `src/App.tsx` 对 `AvatarAssistantShell` 的调用接口不变
- 在 `src/assistant-shells/avatar-ui/` 内调整实现
- 更底层的 avatar 动画资源和状态机在 `src/features/avatar/`
- 如果只是改对话 reveal / explain 时序，请优先看：
  - `src/assistant-shells/shared/useAssistantReplyPlayback.ts`
  - `src/assistant-shells/shared/assistantMessageContent.tsx`
  - `src/assistant-shells/avatar-ui/useAvatarReplyCoordinator.ts`
- 不要直接绕过 coordinator 去写 `controller.requestState(...)`

这样可以避免和主实验流程写死耦合。

---

## 新增状态结构

本次新增了 app-level flow 与 onboarding 相关状态：

- `appFlow`
  - `intro`
  - `guide`
  - `study`
  - `finished`
- `guideStep`

旧版本地 session 会在加载时自动迁移到新版结构。

---

## 你后续最可能修改的地方

### 1. 换 Survey URL

改 `src/App.tsx` 里的 `surveyUrl(...)`

### 2. 换 assistant shell

- ChatGPT shell：`src/assistant-shells/chatgpt-ui/`
- Avatar shell：`src/assistant-shells/avatar-ui/`

### 3. 换材料内容

改：

- `src/data/materials.ts`

### 4. 调整核验标准

改：

- `src/lib/validation.ts`

### 5. 调整 onboarding 文案或步骤

改：

- `src/components/IntroScreen.tsx`
- `src/components/GuideOverlay.tsx`

---

## 备注

这是一个以本地实验流程为核心、配合 Vercel 最小后端的应用：

- 前端主界面、实验流程和草稿状态主要在浏览器本地运行与保存
- assistant chat 与 AI validation 通过 `/api/*` 调用 Vercel functions
- 默认不自动把整套实验过程上传到自建数据库
- 主要职责仍然是驱动流程、保存本地状态、外跳 survey、控制倒计时与截止、并对关键内容做核验
