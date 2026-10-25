# 部署与日常更新

## 当前部署

网站：https://monika-mimibox.m0nika6.chatgpt.site

Sites 项目 ID 与静态目录已写入 `.openai/hosting.json`。首次注册为仅所有者可见，后续更新保留访问范围。

```sh
npm test
npm run build
```

发布输入为 `dist/`，包含 `index.html`、ES modules、JSON 索引和已审核图片。源代码提交与部署归档必须对应同一版本。Sites 内部源仓库和用户 GitHub 仓库是两个不同远端。

详情使用 `#meme=ID`，搜索/分类使用 query 参数，不要求服务器路由重写。刷新不会出现深路径 404。

## GitHub / Pages

GitHub 目标：`lsy112yhu/gpt-mimibox`。用户于 2026-10-25 明确允许公开上传源码和已审核素材；后续未知授权素材仍须单独审核。`.github/workflows/ci.yml` 仅提供测试、数据校验和构建 artifact，不自动公开 GitHub Pages。

如果用户决定公开，先检查所有素材的分发条件，再配置 Pages 或 Cloudflare Pages：构建命令 `npm run build`，输出 `dist`。站点使用相对路径，也支持 `https://owner.github.io/gpt-mimibox/` 子路径。私有仓库不自动意味着 Pages 也私有；勿用公开 Pages 替代访问控制。

## 资源规模

首版约 150 MiB 原图。每张图 ≤8 MiB，无大型视频；不使用 Base64 打进 JS。网页首屏只加载 36 张小缩略图，原图和动画按需加载。Git 历史对二进制差分不友好，达到数千张或数百 MiB 后应迁移到对象存储/CDN，避免重复提交整套媒体。当前不配置 LFS 或付费服务。

## 更新已有包

先获取并检查上游新固定提交和许可变化，再运行导入。相同 SHA-256 不复制；不同字节的新版本独立保留。当前包消失的来源从最新库存移除，其他包仍引用的图片不删除。执行 `validate`、测试和重建后提交 Git，最后发布。

恢复工作时先阅读 `PROGRESS.md`，保留 `.openai/hosting.json` 中现有项目 ID，禁止重复创建 Site 或重置用户仓库历史。
