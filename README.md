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

当前仍然使用占位 URL：

```text
https://example.com/
```

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

这是一个本地运行版应用：

- 默认不带后端
- 不自动上传实验数据到服务器
- 主要职责是驱动流程、保存本地状态、外跳 survey、控制倒计时与截止、并对关键内容做核验
