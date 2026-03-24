# JSON Config Editor (Tauri Desktop)

基于 `React + Vite + Tauri` 的桌面 JSON 配置编辑器。

## 代码改动后是否需要重新打包

需要。  
只要你要分发新的安装包（给测试或用户），代码有变更就应重新执行打包流程。

## 环境要求

- Node.js 18+
- `pnpm`（项目指定 `pnpm@10.14.0`）
- Rust（建议 stable 最新版）
- Tauri v2 依赖（按官方文档安装对应系统依赖）

## 本地开发

```bash
pnpm install
pnpm desktop:dev
```

## 打包步骤

1. 安装依赖

```bash
pnpm install
```

2. 类型检查

```bash
pnpm typecheck
```

3. 构建前端

```bash
pnpm build
```

4. 打包桌面应用

```bash
pnpm desktop:build
```

## 打包产物位置

打包完成后查看：

```text
src-tauri/target/release/bundle/
```

常见目录示例：

- macOS: `bundle/macos/*.app`、`bundle/dmg/*.dmg`
- Windows: `bundle/nsis/*.exe` 或 `bundle/msi/*.msi`（取决于配置）

## 常用脚本

```bash
pnpm desktop:dev
pnpm typecheck
pnpm build
pnpm desktop:build
```

## 备注

- 当前项目已切换到桌面端交付，不再使用本地 HTTP Server 打包方案。
- 若依赖更新或首次打包失败，先确认 Rust/Cargo 网络可访问，再重试 `pnpm desktop:build`。
