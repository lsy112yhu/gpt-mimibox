# ChatGPT / Agent 集成实测报告

记录日期：2026-10-25。

## 实测与边界

| 能力 | 状态 | 证据 / 限制 |
|---|---|---|
| 当前开发环境读取 AstrBot/GitHub 文件 | 实测成功 | GitHub connector 读取 README、许可证、资源索引；Git 拉取固定版本媒体 |
| 浏览器搜索和打开原图 | 实测成功 | 预览 UI 检索、详情和原图元素实际加载；不只是 README 示例 |
| 本地 JS/CLI 返回候选、来源和图片 URL | 实测成功 | 自动测试调用共用检索模块 |
| MCP stdio 初始化、列工具、搜索调用 | 实测成功 | 启动真实 Node 子进程，写入多条 JSON-RPC，检查四工具和候选结果 |
| 外部 Agent 使用 MCP | 理论可行，需手动配置 | 服务已实现，但未在用户实际使用的外部客户端安装/验收 |
| 当前 ChatGPT 原生自动调用这个 MCP | 当前未接入 | 本地 stdio 服务不会自行注册到 ChatGPT；此站点不包含托管 HTTP MCP |
| 普通 ChatGPT 新对话自动发现仓库 | 当前不支持 | 没有注册自动发现能力或修改全局工具清单；README 提示词不能做到 |
| 私人站点图片在任意普通对话直接显示 | 需手动操作 / 未验证 | 用户可在有权限浏览器保存图片后上传；复制链接仍受站点登录保护，不能承诺聊天渲染器带登录凭据 |
| 按聊天上下文自动斗图 | 未实现 | 没有监听普通 ChatGPT 消息的 App/Connector，也没有声称模拟聊天是集成 |

GitHub 连接可用于明确请求中的文件读取，但这不代表每个新会话会自动检索此仓库。私有站点图片 URL 不是公共图床。没有在最终回答中自动插入已登录私有图片，因为尚未验证该展示链路。

## 一种真实可用的检索方式

在项目目录运行：

```sh
node scripts/agent.mjs search_memes '{"query":"鼓励我做数学题","limit":5}'
```

结果包含可供本地打开的 `file:` 图片地址、候选描述、来源、标签、许可和相关性分数。网站内搜索→详情→保存原图→手动发到聊天是可用路径。它需要用户操作，不能称自动发送。

## 外部客户端手工配置

支持本地 stdio MCP 的客户端可按自身配置格式使用以下字段（绝对路径需替换为本机 clone 的位置）：

```json
{
  "mcpServers": {
    "mimibox": {
      "command": "node",
      "args": ["/absolute/path/gpt-mimibox/scripts/agent.mjs", "--stdio"]
    }
  }
}
```

默认不要求密钥。可选环境变量 `MIMIBOX_BASE_URL` 指定已部署网站根 URL（尾部带 `/`）。对私有站点返回的 HTTP URL，调用方仍需要访问权限。

服务按 MCP `2024-11-05` stdio 兼容形态实现换行 JSON-RPC，提供 initialize/ping/tools/list/tools/call。实际客户端兼容矩阵尚未验证，不宣称通过官方认证或支持所有后续版本。协议参考：https://github.com/modelcontextprotocol/modelcontextprotocol/blob/main/docs/specification/2025-11-25/basic/transports.mdx

## 后续正式 ChatGPT 接入

可研究带鉴权的远程 MCP 服务，通过当前账户可用的正式自定义 App 路径安装。这需要单独的服务端、访问控制和真实客户端验收。本轮没有注册 App，没有向前端写入密钥，也不绕过私有站点鉴权。

若日后实现自动选图，默认遵守：严肃/学习解答不插搞怪图；用户要求不发表情时停止；默认控制频率；避免近期重复；不把搜索得分当作内容安全审核。当前实现只做用户主动请求的查询，不监听私人对话。

## 已核对的正式产品路径

核对官方文档：
- https://developers.openai.com/api/docs/guides/custom-mcp-server
- https://learn.chatgpt.com/docs/extend/mcp

网页端通过 Plugins 添加自定义 MCP，配置 Server URL 或 Secure MCP Tunnel，再安装使用；受工作区权限限制。本地桌面/Codex 可配置 stdio。尚未确认本账户设置页是否提供入口，也未替用户安装。本项目仅实现 stdio，不直接兼容网页端 HTTP 接口。

桌面 / Codex 可参考以下 TOML（路径按实际位置修改）：

```toml
[mcp_servers.mimibox]
command = "node"
args = ["/absolute/path/gpt-mimibox/scripts/agent.mjs", "--stdio"]
```

这是一条正式可研究的接入路径，不代表本轮已经接通普通 ChatGPT 对话。

## 上线访问检查

部署接口返回 succeeded；在未登录的实际浏览器访问正式地址，页面显示「登录后即可访问」。这证实了访问门槛，不等于已在普通 ChatGPT 中完成私有图片渲染测试。未绕过鉴权或改变站点 audience。
