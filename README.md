# NarrativeMining

金融新闻叙事挖掘桌面应用 — 远程数据同步、FTS5 全文检索、AI 叙事分析查询。

基于 Electron + Vue 3 + TypeScript，采用 MSVB 架构模式。

## 技术栈

- **Electron 29** - 跨平台桌面应用框架
- **Vue 3** - 前端框架（Composition API）
- **TypeScript** - 类型安全
- **Vite 5** - 构建工具
- **SQLite**（better-sqlite3 + FTS5） - 本地全文检索数据库
- **Electron Forge** - 打包和分发

## 特性

- 远程 API 数据同步（自动/手动，增量同步）
- 原始消息与叙事分析数据的本地存储与查询
- FTS5 中文全文检索（前缀匹配、全字段覆盖）
- 叙事分析多维度筛选（趋势、模式、情绪、强度等）
- 自动同步间隔可配置
- 完整的 MSVB 架构（Model → Service → View → Bridge）
- 浅色/深色主题切换
- 数据持久化（electron-store）
- 日志系统（electron-log）
- 完整的 TypeScript 类型定义

## 快速开始

```bash
npm install
npm run dev
```

### 使用模板创建新项目

```bash
gh repo create my-app --template chaofanat/electron-vue-template
cd my-app
npm install
npm run dev
```

或通过 GitHub 网页点击 "Use this template" 按钮，克隆后执行 `npm install && npm run dev`。

### 网络问题

Electron 下载失败时设置镜像源：

```bash
# Windows
$env:ELECTRON_MIRROR='https://npmmirror.com/mirrors/electron/'
npm install

# macOS / Linux
export ELECTRON_MIRROR='https://npmmirror.com/mirrors/electron/'
npm install
```

## 开发指南

### 启动开发服务器

```bash
npm run dev
```

### 构建和打包

```bash
# 打包应用
npm run build

# 创建安装包
npm run make
```

### 代码规范

```bash
# 检查代码规范
npm run lint

# 自动修复
npm run lint:fix

# 格式化代码
npm run format
```

## 项目结构

```
├── src/
│   ├── main/                    # 主进程 (Node.js 环境)
│   │   ├── index.ts             # 应用入口
│   │   ├── database/            # SQLite 数据库初始化 + FTS 索引
│   │   ├── services/            # 业务逻辑 (API + 同步 + 查询)
│   │   ├── ipc/                 # IPC 通信
│   │   ├── store/               # 配置存储
│   │   ├── logger/              # 日志系统
│   │   └── window/              # 窗口管理
│   ├── preload/                 # 预加载脚本
│   ├── renderer/                # 渲染进程 (Vue 3)
│   └── shared/                  # 共享类型 + 常量
├── CLAUDE.md                    # AI 开发规则
└── package.json
```

## 开发哲学：MSVB 模式

本项目采用 MSVB（Model → Service → View → Bridge）开发模式：

```
数据层 → 服务层 → 视图层 → 桥接层
Model  → Service → View  → Bridge
```

### 开发流程

添加新功能时，按以下顺序进行：

1. **Model** - 定义数据类型和存储结构
2. **Service** - 实现业务逻辑，注册 IPC 处理器
3. **View** - 创建页面和组件
4. **Bridge** - 在 preload 中暴露 API

详细说明请参考 [CLAUDE.md](./CLAUDE.md)

## 核心功能

### 数据同步

连接远程 API 拉取金融新闻原始消息和 AI 叙事分析数据，存储到本地 SQLite。

```typescript
// 手动同步
await window.electronAPI.data.startSync();

// 获取同步状态
const state = await window.electronAPI.data.getSyncStatus();
// { lastSyncTime, rawCount, narrativeCount, isSyncing }
```

### 全文搜索

FTS5 全文检索，支持中文前缀匹配和全字段覆盖。

```typescript
// 搜索原始消息
const result = await window.electronAPI.data.listRaw({ search: '利弗莫尔' });

// 搜索叙事数据（可组合筛选）
const result = await window.electronAPI.data.listNarratives({
  search: '俄罗斯',
  text_type: '政策发布',
  narrative_trend: '利好',
});
```

### 自动同步

设置页面可配置自动同步开关和间隔（1-60 分钟），启动后自动拉取新增数据。

## 文档

- [Electron 文档](https://www.electronjs.org/docs)
- [Vue 3 文档](https://vuejs.org/guide/introduction.html)
- [Electron Forge 文档](https://www.electronforge.io/)
- [Vite 文档](https://vitejs.dev/)

## 许可证

MIT License
