# NarrativeMining — 金融叙事挖掘桌面应用

## 项目概述

这是一个金融新闻叙事挖掘桌面应用，采用以下技术栈：

- **Electron 29** - 跨平台桌面应用框架
- **Vue 3** - 前端框架（Composition API）
- **TypeScript** - 类型安全
- **Vite 5** - 构建工具
- **SQLite**（better-sqlite3 + sqlite-vec） - 本地数据库 + 向量存储
- **Electron Forge** - 打包和分发

## 项目结构

```
├── src/
│   ├── main/                    # 主进程 (Node.js 环境)
│   │   ├── index.ts             # 应用入口
│   │   ├── database/            # SQLite 初始化 + FTS 索引
│   │   ├── services/            # 业务逻辑
│   │   │   ├── ApiClient.ts     # 远程 API 封装
│   │   │   ├── SyncService.ts   # 数据同步调度
│   │   │   ├── RawMessageService.ts
│   │   │   ├── NarrativeService.ts
│   │   │   ├── EmbeddingService.ts  # 向量嵌入生成
│   │   │   ├── VectorService.ts     # 语义相似度搜索
│   │   │   └── ClusteringService.ts # HDBSCAN 聚类分析
│   │   ├── ipc/                 # IPC 通信
│   │   ├── store/               # 配置存储 (electron-store)
│   │   ├── logger/              # 日志系统
│   │   └── window/              # 窗口管理
│   ├── preload/                 # 预加载脚本
│   ├── renderer/                # 渲染进程 (Vue 3)
│   └── shared/                  # 共享类型 + 常量
├── CLAUDE.md
└── package.json
```

## 开发指南

### 启动开发服务器

```bash
npm install
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

## 开发哲学：MSVB 模式

本项目采用 **MSVB（Model → Service → View → Bridge）** 开发模式，为 Electron 桌面应用提供清晰的开发流程。

### 核心理念

```
数据层 → 服务层 → 视图层 → 桥接层
Model  → Service → View  → Bridge
```

### 四层架构

| 层级 | 职责 | 位置 | 说明 |
|------|------|------|------|
| **Model** | 数据定义与存储 | `src/shared/types.ts`<br>`src/main/store/` | 定义数据结构、类型、持久化方案 |
| **Service** | 业务逻辑 | `src/main/services/`<br>`src/main/ipc/handlers.ts` | 主进程中的业务处理、IPC 处理器 |
| **View** | 用户界面 | `src/renderer/src/views/`<br>`src/renderer/src/components/` | Vue 组件、页面、状态管理 |
| **Bridge** | 进程桥接 | `src/preload/index.ts`<br>`src/shared/constants.ts` | 连接主进程与渲染进程、频道定义 |

### 开发流程

添加新功能时，按以下顺序进行：

```
1. Model   → 定义数据类型和存储结构
2. Service → 实现业务逻辑，注册 IPC 处理器
3. View    → 创建页面和组件
4. Bridge  → 在 preload 中暴露 API
```

### 示例：添加"笔记"功能

按 Model → Service → View → Bridge 顺序：`types.ts` 定义接口 → `services/` 实现逻辑 + `ipc/handlers.ts` 注册处理器 → `views/` 创建组件 → `preload/index.ts` 暴露 API。

### 设计原则

1. **单向依赖**：View → Bridge → Service → Model，禁止反向依赖
2. **类型安全**：所有 IPC 通信必须有 TypeScript 类型定义
3. **进程隔离**：渲染进程不直接访问 Node.js API，必须通过 Bridge
4. **职责分离**：Service 只处理业务逻辑，View 只负责展示

---

## 核心功能

- **IPC 通信**：主进程/渲染进程通过 IPC 通信，类型定义在 `src/shared/types.ts`，频道常量在 `src/shared/constants.ts`
- **数据存储**：`electron-store`，配置在 `src/main/store/index.ts`，支持 dot-notation key
- **SQLite 数据库**：`better-sqlite3`，WAL 模式，位于 `%APPDATA%/electron-vue-template/narrative-mining.db`
- **日志系统**：`electron-log`，日志位于 `%APPDATA%/electron-vue-template/logs/`

## 数据层规则

- **better-sqlite3 必须外部化**：`vite.main.config.ts` 的 `rollupOptions.external` 必须包含 `'better-sqlite3'`、`'sqlite-vec'`、`'hdbscan-ts'`、`'umap-js'`，否则构建失败
- **同步表的 id 用 `INTEGER PRIMARY KEY`，不加 AUTOINCREMENT**：`raw_messages` 和 `narratives` 的 `id` 来自远程 API，AUTOINCREMENT 会导致 INSERT OR REPLACE 时 id 跑偏，增量同步判断失效
- **FTS 索引随数据写入**：`SyncService` 在同一事务中写入数据行 + FTS 行，不单独重建索引
- **增量同步基于 max_id**：`sync_state` 表存储 `max_raw_id` / `max_narrative_id`，每批检查 `item.id > lastMaxId`，全批旧记录时提前终止
- **Schema 变更需要重建数据库**：`CREATE TABLE IF NOT EXISTS` 不修改已存在的表，改 schema 后需删除旧 `.db` 文件
- **FTS INSERT 必须显式指定 rowid**：FTS5 的冲突检测基于隐式 rowid，不是 UNINDEXED 的 row_id 列。INSERT 缺少 rowid 会导致 INSERT OR REPLACE 失效、每次同步追加重复行。写入格式：`INSERT INTO fts (rowid, row_id, text) VALUES (?, ?, ?)`
- **FTS 提取函数必须覆盖表的全部列**：`extractXxxFtsText` 的字段变更后递增 `FTS_VERSION`（database/index.ts），下次启动自动重建索引
- **FTS 搜索策略**：unicode61 分词器不拆分 CJK 连续字符（整个中文短语是一个 token），连字符是分隔符。`toFtsQuery` 对简单词用裸前缀 `term*`，含特殊字符（`-`, `.`, `:`, `*`, `(`, `)`, `"`, 空格）用引号包裹 `"term"`。`*` 只能跟裸词，不能跟引号短语。搜索前对输入做 `trim()` 检查，空字符串不能进 MATCH
- **sqlite-vec 元数据列**：`narrative_vec` 使用 `vec0(embedding float[N], publish_time text)` 创建。`publish_time` 作为元数据列可在 KNN 查询的 WHERE 子句中直接过滤（距离计算前），无需 JS 端后过滤。KNN 查询格式：`WHERE embedding MATCH ? AND k = ? AND publish_time >= ? AND publish_time <= ?`
- **vec0 schema 版本控制**：`ensureVecDimensions()` 通过 `sync_state` 中的 `vec_dimensions` + `vec_schema_version` 检测变更。维度或 schema 版本不匹配时 DROP + 重建 `narrative_vec`，需重新触发嵌入生成。当前版本：`VEC_SCHEMA_VERSION = 2`
- **聚类使用 Worker Thread**：`ClusteringService.runHdbscanWorker()` 通过 `new Worker(code, { eval: true })` 执行 UMAP + HDBSCAN，避免阻塞主线程。Worker 内 `require()` 在 dev 模式下从 node_modules 解析

## TypeScript 配置

- 根 `tsconfig.json` 不使用 project references（Vite 自行处理构建）
- 三个子配置（`tsconfig.main.json` / `tsconfig.preload.json` / `tsconfig.renderer.json`）独立运行，均设 `noEmit: true` + `skipLibCheck: true`
- preload 的 tsconfig 不能设 `rootDir`（会阻止 `src/shared/` 被包含）
- renderer 需要 `src/renderer/src/env.d.ts` 声明 `.vue` 模块

## AI 智能体指引

### 添加新功能流程

1. `src/shared/types.ts` 添加类型 + `src/shared/constants.ts` 添加 IPC 频道
2. `src/main/services/` 实现业务逻辑
3. `src/main/ipc/handlers.ts` 注册处理器
4. `src/preload/index.ts` 暴露 API
5. `src/renderer/src/views/` 创建组件

### 红线

- 渲染进程不能直接访问 Node.js API，必须通过 IPC
- 所有 IPC 通信必须有 TypeScript 类型定义
- 敏感操作在主进程处理

## 故障排查

- **npm install 失败**：设置 `$env:ELECTRON_MIRROR='https://npmmirror.com/mirrors/electron/'` 后重装
- **better-sqlite3 构建失败**：`npx electron-rebuild -f -w better-sqlite3`
- **同步数据不更新**：Schema 变更后需删除 `%APPDATA%/electron-vue-template/narrative-mining.db` 重建
- **TypeScript 报错**：清理 `.vite/build/` 后重试；三个子项目用各自的 tsconfig 独立检查
- **向量搜索报 KNN 错误**：vec0 的 KNN 查询必须有 `k = ?` 约束，不能用 `WHERE rowid IN (...)` 干扰 KNN 扫描计划
- **维度变更后向量丢失**：修改 embedding 维度或 vec0 schema 升级会自动 DROP 重建 `narrative_vec`，需在设置页重新触发嵌入生成

## 相关文档

- [Electron 文档](https://www.electronjs.org/docs)
- [Vue 3 文档](https://vuejs.org/guide/introduction.html)
- [Electron Forge 文档](https://www.electronforge.io/)
- [Vite 文档](https://vitejs.dev/)
