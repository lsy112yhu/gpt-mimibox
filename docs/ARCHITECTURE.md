# 架构与数据协议

## 分层

- `public/images/`：经审核的原始图片，SHA-256 内容地址对应稳定 ID。
- `public/thumbnails/`：300×300 范围内的首帧 WebP 预览，不承诺保持动图。
- `data/memes.json`：维护用完整元数据，含禁用包的记录。
- `data/categories.json`、`category-aliases.json`：可编辑分类与上游别名。
- `data/packs.json`：资源包版本、固定提交、作者、许可证据、启用状态。
- `data/catalog.json`：构建用可检索目录，只含启用且已审核的记录。
- `data/search-index.json`：可离线消费的文本索引。
- `src/core.js`：浏览器和 Node 共用的无副作用检索逻辑。
- `src/storage.js`：设备本地 IndexedDB。
- `scripts/mimibox.py`：导入/审核隔离/校验/编辑/包管理/近似图报告。
- `scripts/agent.mjs`：本地 JSON-RPC MCP stdio 和命令行检索。

## 图片记录

每张图至少包含 `id,title,description,description_origin,category,categories,tags,moods,scenes,format,animated,frames,width,height,size,file,thumbnail,sha256,dhash,sources,license,status,imported_at`。

- ID 为 `m_` + SHA-256 前 20 个十六进制字符。完整 SHA-256 用于精确去重。校验器阻止 ID 碰撞及重复内容。
- `sources[]` 保留同一字节内容在多个来源中的路径、作者、许可和提交，不为不同版本去重。
- `semantic_source` 标记逐图描述的独立作者、许可、上游 URL、版本、模型/人工来源；不导入向量、模型密钥或上游运行状态。
- `description_origin` 为 `category_metadata`、`upstream_semantic` 或 `human_corrected`。分类模板不能冒充逐图视觉识别。
- `moods` 使用分类键；`scenes/tags` 为中文词表。分类数不等于互斥图片数，一张图可有多类。
- APNG 在 Pillow 将其识别为多帧 PNG 时保留动画。动态 WebP/GIF 也保留原字节。
- `dhash` 仅为首帧 64 位近似特征。不同帧序列可能首帧相同，只生成审查候选。

## 四个检索函数

浏览器加载完成后提供 `window.MimiBox`：

```js
MimiBox.search_memes('震惊猫猫', 8, {category: 'surprised', animated: true})
MimiBox.random_meme('happy', '')
MimiBox.get_meme('m_...')
MimiBox.list_categories()
```

结果包含来源、许可、标签、描述和绝对 `image_url`/`thumbnail_url`；搜索额外返回可比较的词法分数 `score`。分数是词法相关性，不是概率或视觉相似度。中文双字切分、同义词与标题/标签权重用于首版检索。没有 Embeddings 或远程模型请求。

## 管理持久化边界

站点完全静态，不持有 GitHub 令牌。上传、收藏、隐藏、编辑存在当前 origin 的 IndexedDB。浏览器清理数据可能丢失这些改动，需导出完整备份。预览和正式站点为不同 origin，浏览器收藏不会自动跨 origin 同步。

导出备份包含原图 data URL、缩略图、本地覆盖记录及偏好。恢复时重新校验图片内容、SHA-256、类型及尺寸；不信任备份提供的路径、URL、许可通过状态或 ID。`apply-backup` 只同步已存在记录的文本元数据，将新图隔离到忽略的 `quarantine/`，不把浏览器隐藏操作解释为删除仓库文件。

## 安全边界

只导入本地目录或 ZIP，不执行包内 Python/JS/安装脚本。路径校验防止绝对路径、`..`、符号链接和 ZIP Slip。PNG/JPEG/GIF/WebP 均经真实解码，全动画逐帧检查，单图 ≤8 MiB、≤20MP、≤1000 帧且像素×帧数有预算。ZIP 总展开量 ≤300 MiB、≤10000 项。网页文本统一转义；外链限定 http/https；上传拒绝 SVG/HTML 与伪造扩展名。

包禁用是展示/检索开关，不是撤销原图 URL。要撤下原图需删除来源/图片、重建和重新部署。Git 历史仍可能包含旧媒体；删除历史或公开传播需要额外处理。
