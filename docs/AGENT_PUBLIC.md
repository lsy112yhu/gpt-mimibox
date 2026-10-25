# MimiBox 公开只读 Agent 图片索引

这是一层供外部 AI Agent / ChatGPT 对话按需读取的**公开元数据**，不代表已经安装了 ChatGPT 的原生插件或 MCP。

## 稳定入口

- 分类清单：`https://raw.githubusercontent.com/lsy112yhu/gpt-mimibox/main/public/agent/index.json`
- 快速试发候选：`https://raw.githubusercontent.com/lsy112yhu/gpt-mimibox/main/public/agent/quick.json`
- 分类清单中的 `shards`：每片最多 24 张表情的标题、描述、标签和图片 URL。

给 AI 的建议调用顺序：

1. 先读取 `index.json`，按情绪或关键词找到分类。
2. 仅在需要时打开该分类的一个 JSON shard；简单场景可以先看 `quick.json`。
3. 用 `image_url` 显示原图；预览时可以改用 `thumbnail_url`（缩略图不保留动图动画）。
4. 不要将静态 GitHub 原图 URL 误认为 ChatGPT 已能自动调用工具；如果当前聊天不支持远程图片渲染，应提供源图链接。

索引由 `python scripts/export_agent_index.py` 从已经审核、公开的 `data/catalog.json` 生成，推送到 main 后 GitHub Actions 自动提交 `public/agent/`。这不是运行中的服务端 API，不处理写入，不能访问私人站点或本地上传表情包。

**授权注意：** 图包素材仅供符合原作者许可的非商业使用；源码 MIT 许可证不适用于图片。每项返回 `license` 和 `sources` 方便追溯。索引并不声称已独立清理图片权利链。

## 本地验证

```sh
python -m unittest discover -s tests -p 'test_*.py'
python scripts/export_agent_index.py
```

若 GitHub Actions 不允许提交，请由仓库维护者手动执行导出并提交 `public/agent/`，不要假设索引已经发布。
