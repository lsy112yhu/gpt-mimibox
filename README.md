# MimiBox · 四次元表情口袋

A little box of endless reactions. 一个可离线维护的私人表情收藏室。

**当前素材：604 张唯一图片，233 张动态图片，23 个实际分类，2 个图片资源包。** 原始 606 个文件中合并了 2 个重复文件的来源；396 张补充了来自 DDZS987 的逐图描述与标签。无占位图凑数。

公开源码与已审核素材：https://github.com/lsy112yhu/gpt-mimibox

当前私有网站：https://monika-mimibox.m0nika6.chatgpt.site

## 已实现

- 响应式图库、静态缩略图懒加载、按需原图/动画预览、分页、深浅色主题。
- 中文关键词及同义词检索，分类/资源包/动静图筛选，情绪/场景/标签接口筛选。
- 随机翻看，近期 30 张避免重复（候选耗尽时重新循环）。
- 图片详情、原图下载、链接复制、许可与来源及语义描述署名。
- 浏览器 IndexedDB 收藏、批量上传、编辑、隐藏、资源包开关，完整备份/恢复。
- AstrBot 目录/ZIP 导入、增量更新、SHA-256 去重并合并来源、坏图校验、待审核隔离。
- 首帧 dHash 相似候选报告，**不自动删除近似图或动画**。
- 可供外部 Agent 手动配置的 MCP stdio 服务及命令行检索。**不等于普通 ChatGPT 自动斗图。**

## 本地运行

需要 Node.js 22+ 和 Python 3.12+。

```sh
python -m pip install -r requirements.txt
python scripts/restore_media.py --if-missing
npm test
npm run build
python -m http.server 8000 --directory dist
```

打开 `http://localhost:8000`。没有运行时 npm 依赖、外部字体、CDN 或前端密钥。

`restore_media.py` 可在媒体缺失时从已审核的固定上游提交恢复原图，逐张核对完整 SHA-256，并重建缩略图；不会执行上游仓库脚本。仓库的 Restore reviewed collection 工作流会将校验通过的媒体提交到 main。

## 维护资源

```sh
# 默认只生成待审核记录，不公开未知授权素材
python scripts/mimibox.py import /path/to/astrbot-pack

# 人工查阅许可后，以证据路径及固定版本明确批准
python scripts/mimibox.py import /path/to/astrbot-pack --approved \
  --evidence docs/upstream/pack-license.md --revision FIXED_COMMIT_SHA

python scripts/mimibox.py pack PACK_ID disable
python scripts/mimibox.py pack PACK_ID enable
python scripts/mimibox.py pack PACK_ID delete
python scripts/mimibox.py edit MEME_ID --title '新标题' --tags '猫猫,震惊'
python scripts/mimibox.py similar --distance 5
python scripts/mimibox.py apply-backup mimibox-backup.json
python scripts/mimibox.py validate
python scripts/mimibox.py rebuild
```

ZIP 中的 `manifest.json` 和 `memes/` 应位于压缩包根目录；嵌套的仓库归档请先安全解压，再选择实际包目录。

`data/categories.json` 可修改显示名、图标和分类描述。`data/category-aliases.json` 合并上游同义分类；当前将 `givemoney` 合并进 `money`、`morning` 合并进 `greeting`，保留图片来源路径。

## Agent 检索

```sh
node scripts/agent.mjs search_memes '{"query":"鼓励我做数学题","limit":5}'
node scripts/agent.mjs random_meme '{"category":"happy"}'
node scripts/agent.mjs get_meme '{"id":"m_..."}'
node scripts/agent.mjs list_categories
node scripts/agent.mjs --stdio
```

不指定 `MIMIBOX_BASE_URL` 时返回本地 `file:` 图片地址。设置为网站地址可返回 HTTP 图片 URL；私有站点依旧要求访问者登录。普通 ChatGPT 网页不会读取本机 stdio 进程；详见 [接入实测报告](docs/INTEGRATION.md)。

## 数据与许可

| 来源 | 唯一图片关联数 | 许可声明 |
|---|---:|---|
| anka-afk/astrbot-meme-pack-official-01 | 396 | CC BY-NC-SA 4.0 |
| anka-afk/seio-stickers | 208 | 非商业；允许下载、分享与分发 |
| DDZS987/astrbot-meme-pack-semantic-01 | 396 张逐图描述，无新增图片 | CC BY-NC-SA 4.0 |

素材仅供非商业使用。软件为 MIT；**素材不适用软件 MIT 许可**。原图未修改，缩略图为首帧缩放转换，描述去除模板前缀并合并标签。素材作者/整理者及逐条固定版本来源保存在数据中。包维护者的许可声明不等于独立确认每张角色/截图的完整权利链。参见 [来源审核](docs/SOURCES.md) 和 [版权策略](docs/RIGHTS.md)。

## 文档与进度

- [需求原文](docs/REQUIREMENTS.md)
- [架构与数据](docs/ARCHITECTURE.md)
- [部署与维护](docs/DEPLOYMENT.md)
- [接入实测](docs/INTEGRATION.md)
- [验证记录](docs/TESTING.md)
- [进度、恢复点与待办](docs/PROGRESS.md)

本项目选择静态 ES modules + Python 工具链，未引入 React/Vite/Tailwind；需求中的技术栈为推荐项。首版功能无须服务器。浏览器管理属于设备本地数据，通过备份和离线脚本同步到 Git；当前没有多设备云同步、在线 GitHub 写入或自动调用视觉模型。
