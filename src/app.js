import {search_memes,random_meme,get_meme,list_categories,response} from './core.js';
import {read,write} from './storage.js';
const $=s=>document.querySelector(s), $$=s=>[...document.querySelectorAll(s)];
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const safeURL=url=>{try{const u=new URL(url,location.href);return ['http:','https:'].includes(u.protocol)?u.href:'#';}catch{return '#'}};
const size=n=>n>1048576?(n/1048576).toFixed(1)+' MB':Math.ceil(n/1024)+' KB';
const state={catalog:{memes:[],categories:[],packs:[]},local:[],edits:{},deleted:[],disabled:[],favorites:[],recent:[],query:'',category:'',favoritesOnly:false,limit:36,results:[],current:null};
let toastTimer, searchTimer;
function toast(msg){$('#toast').textContent=msg;$('#toast').classList.add('visible');clearTimeout(toastTimer);toastTimer=setTimeout(()=>$('#toast').classList.remove('visible'),3000)}
async function save(key,value){try{await write(key,value)}catch{toast('浏览器存储失败，请检查存储权限并及时导出备份');throw new Error('storage unavailable')}}
function allMemes(){return [...state.catalog.memes,...state.local].filter(m=>!state.deleted.includes(m.id)&&(!m.sources.length||m.sources.some(s=>!state.disabled.includes(s.pack)))).map(m=>({...m,...state.edits[m.id]}));}
function catName(id){return state.catalog.categories.find(c=>c.id===id)?.name??id}
function categoryOptions(current=''){return state.catalog.categories.map(c=>`<option value="${esc(c.id)}" ${c.id===current?'selected':''}>${esc(c.name)}</option>`).join('')}
function renderNav(){
 const memes=allMemes();$('#nav-count').textContent=memes.length;$('#fav-count').textContent=memes.filter(m=>state.favorites.includes(m.id)).length;
 const cats=list_categories(memes,state.catalog.categories);$('#category-count').textContent=cats.length;
 $('#categories').innerHTML=cats.map(c=>`<button class="category-item ${state.category===c.id?'active':''}" data-category="${esc(c.id)}"><span>${esc(c.icon)}</span>${esc(c.name)}<b>${c.count}</b></button>`).join('');
 $('#all-nav').classList.toggle('active',!state.favoritesOnly&&!state.category);$('#favorites-nav').classList.toggle('active',state.favoritesOnly);
 $('#stats').innerHTML=`<span><b>${memes.length}</b> 张表情</span><span><b>${cats.length}</b> 种心情</span><span><b>${state.catalog.packs.length}</b> 个资源包</span>`;
}
function syncURL(){const p=new URLSearchParams();if(state.query)p.set('q',state.query);if(state.category)p.set('category',state.category);if(state.favoritesOnly)p.set('favorites','1');const url=location.pathname+(p.size?'?'+p:'')+location.hash;history.replaceState(null,'',url)}
function render(){
 renderNav();let memes=allMemes();if(state.favoritesOnly)memes=memes.filter(m=>state.favorites.includes(m.id));
 const format=$('#format-filter').value;const filters={category:state.category,pack:$('#pack-filter').value};if(format)filters.animated=format==='animated';
 let matches=search_memes(memes,state.query,Number.MAX_SAFE_INTEGER,filters);
 if($('#sort').value==='newest') matches.sort((a,b)=>b.imported_at.localeCompare(a.imported_at));
 if($('#sort').value==='title') matches.sort((a,b)=>a.title.localeCompare(b.title,'zh-CN'));
 state.results=matches;
 const title=state.favoritesOnly?'我的收藏':state.category?catName(state.category):state.query?'搜索结果':'全部表情';
 $('#breadcrumb').textContent=title;$('#collection-title').innerHTML=`${esc(title)} <span>${matches.length} 张</span>`;
 $('#result-note').textContent=state.query?`关于「${state.query}」的相关表情 · 按标题、标签和分类描述匹配`:'每个小表情，都是一句没说出口的话。';
 $('#grid').innerHTML=matches.length?matches.slice(0,state.limit).map(card).join(''):`<div class="empty"><span>ฅ</span><b>${state.favoritesOnly?'口袋还空着，点一下喜欢的表情上的爱心吧。':'没有找到这个心情，试试换个词？'}</b><p>也可以清除筛选，或者上传你自己的表情。</p></div>`;
 $('#load-more').hidden=state.limit>=matches.length;$('#page-note').textContent=matches.length?`已展示 ${Math.min(state.limit,matches.length)} / ${matches.length} 张`:'暂无表情';
 const filtering=state.query||state.category||state.favoritesOnly||filters.pack||format;
 $('#active-filters').innerHTML=filtering?'<button class="filter-clear" id="clear-filters">清除全部筛选 ×</button>':'';syncURL();
}
function card(m){return `<article class="meme-card"><button class="image-button" data-open="${esc(m.id)}" aria-label="查看 ${esc(m.title)}"><img loading="lazy" decoding="async" src="${esc(m.thumbnail)}" alt="${esc(m.title)}" data-thumb="${esc(m.thumbnail)}" ${m.animated?`data-animation="${esc(m.file)}"`:''}>${m.animated?'<span class="animated-badge">GIF · 动态</span>':''}</button><button class="card-favorite ${state.favorites.includes(m.id)?'saved':''}" data-favorite="${esc(m.id)}" aria-label="${state.favorites.includes(m.id)?'取消收藏':'收藏'} ${esc(m.title)}" aria-pressed="${state.favorites.includes(m.id)}">${state.favorites.includes(m.id)?'♥':'♡'}</button><div class="card-info"><h3 title="${esc(m.title)}">${esc(m.title)}</h3><div class="card-tags"><span>${esc(catName(m.category))}</span><span>${m.format.toUpperCase()} · ${size(m.size)}</span></div></div></article>`}
function showHero(){const list=allMemes();const picks=['like','meow','happy'].map(c=>list.find(m=>m.categories.includes(c)&&m.width<900)).filter(Boolean);$('#hero-art').insertAdjacentHTML('afterbegin',picks.map(m=>`<button class="hero-tile" data-open="${m.id}" aria-label="查看 ${esc(m.title)}"><img src="${m.thumbnail}" alt="${esc(m.title)}"></button>`).join(''))}
async function favorite(id){const next=state.favorites.includes(id)?state.favorites.filter(x=>x!==id):[...state.favorites,id];await save('favorites',next);state.favorites=next;render();if(state.current===id)detail(id,false)}
function detail(id,open=true){const m=get_meme(allMemes(),id);if(!m)return;state.current=id;
 const saved=state.favorites.includes(id);const isLocal=m.status!=='approved';
 $('#detail-content').innerHTML=`<div class="detail-layout"><div class="detail-image"><img src="${esc(m.file)}" alt="${esc(m.title)}"><div class="image-nav"><button class="subtle-btn" data-direction="-1" aria-label="上一张">←</button><button class="subtle-btn" data-direction="1" aria-label="下一张">→</button></div></div><div class="detail-copy"><div class="detail-heading"><span class="eyebrow">A REACTION FOR THIS MOMENT</span><button class="icon-btn" data-close="detail" aria-label="关闭详情">×</button></div><h2>${esc(m.title)}</h2><p>${esc(m.description)}</p><div class="pill-tags">${m.tags.map(t=>`<span>${esc(t)}</span>`).join('')}</div><dl class="metadata"><dt>图片</dt><dd>${m.format.toUpperCase()}${m.animated?' · 动态':''} · ${m.width} × ${m.height} · ${size(m.size)}</dd><dt>分类</dt><dd>${m.categories.map(catName).map(esc).join(' / ')}</dd><dt>来源</dt><dd>${m.sources.length?m.sources.map(s=>`<a href="${esc(safeURL(s.url))}" target="_blank" rel="noopener noreferrer">${esc(state.catalog.packs.find(p=>p.id===s.pack)?.name??s.pack)} ↗</a><br>${esc(s.author)}`).join('<br>'):'本地上传（未公开）'}</dd><dt>使用许可</dt><dd>${esc(m.license)}${isLocal?' · 待审核，仅当前浏览器可见':''}</dd>${m.semantic_source?`<dt>语义署名</dt><dd><a href="${esc(safeURL(m.semantic_source.url))}" target="_blank" rel="noopener noreferrer">${esc(m.semantic_source.author)} ↗</a> · ${esc(m.semantic_source.license)}</dd>`:""}<dt>描述方式</dt><dd>${m.description_origin==='category_metadata'?'根据资源包分类生成，尚未逐图识别':m.description_origin==='upstream_semantic'?'来自上游逐图描述':'人工填写 / 修正'}</dd></dl><div class="detail-actions"><button class="primary-btn" data-favorite="${id}">${saved?'♥ 已收藏':'♡ 收藏这张'}</button><button class="subtle-btn" id="copy-image">复制图片链接</button><a class="subtle-btn" href="${esc(m.file)}" download="${esc(m.title+'.'+m.format)}">保存原图 ↓</a></div><details><summary>编辑这张表情</summary><form class="edit-form" id="edit-form"><label class="field">标题<input name="title" value="${esc(m.title)}" required maxlength="128"></label><label class="field">描述<textarea name="description" maxlength="2000">${esc(m.description)}</textarea></label><label class="field">标签（逗号分隔）<input name="tags" value="${esc(m.tags.join(', '))}" maxlength="1000"></label><label class="field">分类<select name="category">${categoryOptions(m.category)}</select></label><button class="primary-btn">保存修改</button><button type="button" class="danger-btn" id="delete-image">从我的口袋移除</button><span class="small-note">修改仅保存在当前浏览器，可通过备份导出。</span></form></details></div></div>`;
 if(open){history.replaceState(null,'',location.pathname+location.search+'#meme='+encodeURIComponent(id));if(!$('#detail').open)$('#detail').showModal()}
 $('#copy-image').onclick=async()=>{if(isLocal){toast('本地图片还没有跨设备链接，请保存原图');return}try{await navigator.clipboard.writeText(new URL(m.file,location.href).href);toast('图片链接已复制（访问需要你的登录权限）')}catch{toast('浏览器未允许剪贴板，请长按原图保存')}};
 $('#edit-form').onsubmit=async e=>{e.preventDefault();const f=new FormData(e.target),cat=f.get('category');const next={...state.edits,[id]:{title:f.get('title').trim(),description:f.get('description').trim(),tags:String(f.get('tags')).split(/[,，]/).map(s=>s.trim()).filter(Boolean).slice(0,32),category:cat,categories:[cat],description_origin:'human_corrected'}};await save('edits',next);state.edits=next;render();detail(id,false);toast('修改已保存到当前浏览器')};
 $('#delete-image').onclick=async()=>{const next=[...state.deleted,id];await save('deleted',next);state.deleted=next;$('#detail').close();render();toast('已从当前浏览器的口袋移除，可在备份页恢复')};
}
function moveDetail(direction){const list=state.results.length?state.results:allMemes();const i=list.findIndex(m=>m.id===state.current);if(list.length)detail(list[(i+direction+list.length)%list.length].id,false)}
async function random(){let pool=state.results;const m=random_meme(pool,'','',state.recent);if(!m){toast('当前筛选下没有表情');return}state.recent=[...state.recent,m.id].slice(-30);await save('recent',state.recent);detail(m.id)}
function reset(){state.query='';state.category='';state.favoritesOnly=false;state.limit=36;$('#search').value='';$('#pack-filter').value='';$('#format-filter').value='';render()}
function setQuery(q){state.query=q;state.limit=36;$('#search').value=q;render()}
function openManage(tab='upload'){$('#manage').showModal();manageTab(tab)}
function manageTab(tab){$$('[data-tab]').forEach(b=>b.classList.toggle('active',b.dataset.tab===tab));
 if(tab==='upload'){
 $('#manage-body').innerHTML=`<form id="upload-form"><label class="upload-zone"><span>＋</span><b>给口袋添点新表情</b><small>PNG / JPG / GIF / WebP · 每张不超过 8 MB</small><input id="uploads" type="file" accept="image/png,image/jpeg,image/gif,image/webp" multiple required></label><label class="field">放入分类<select id="upload-category">${categoryOptions('meow')}</select></label><label class="field">使用许可 / 来源备注<input id="upload-license" placeholder="尚未确认授权，可先存入私人待审核收藏" maxlength="256"></label><p class="small-note">上传不会公开发布，也不会自动写入 GitHub。图片保存在当前浏览器，可在备份页完整导出。</p><button class="primary-btn" id="upload-submit">加入我的口袋</button></form><p id="upload-progress" role="status"></p>`;
 $('#upload-form').onsubmit=upload;
 }else if(tab==='packs'){
 $('#manage-body').innerHTML=state.catalog.packs.map(p=>`<div class="pack-row"><label><input type="checkbox" data-pack="${esc(p.id)}" ${!state.disabled.includes(p.id)?'checked':''}> 在此设备启用</label><strong>${esc(p.name)}</strong><p>${state.catalog.memes.filter(m=>m.sources.some(s=>s.pack===p.id)).length} 张 · ${esc(p.version)}<br>${esc(p.license)}<br>${esc(p.author)}</p><a href="https://github.com/${esc(p.repo)}" target="_blank" rel="noopener noreferrer">查看上游 ↗</a></div>`).join('')+`<p class="small-note">禁用仅影响此设备。资源包导入、增量更新和永久删除通过仓库脚本执行，保留可审查的 Git 历史。</p><pre>python scripts/mimibox.py import /path/to/pack
# 未知授权先进入待审核，不会加入网站
python scripts/mimibox.py pack PACK_ID disable
python scripts/mimibox.py pack PACK_ID delete</pre>`;
 }else{
 $('#manage-body').innerHTML=`<h3>把口袋好好收起来</h3><p>备份包括收藏、上传图片、标签修改、资源包开关和隐藏记录。换设备后导入即可恢复。</p><div class="backup-actions"><button class="primary-btn" id="export-backup">导出完整备份 ↓</button><label class="subtle-btn">导入备份<input type="file" id="restore-file" accept="application/json,.json" hidden></label><button class="subtle-btn" id="restore-hidden">恢复所有已移除表情（${state.deleted.length}）</button></div><p class="small-note">导入会合并本地图片、收藏和编辑记录。同一图片只保留一份。原图库无需打进备份，上传原图会完整保留。</p><h3>同步到 GitHub</h3><p>静态网站不保存 GitHub 密钥。导出后在项目目录运行：</p><pre>python scripts/mimibox.py apply-backup mimibox-backup.json
python scripts/mimibox.py validate
git add .
git commit -m "chore: curate collection"
git push</pre><p class="small-note">导入工具只同步元数据修改；新增图片先进入待审核，需补充许可证据后再导入发布。</p>`;
 $('#export-backup').onclick=exportBackup;$('#restore-file').onchange=restoreBackup;$('#restore-hidden').onclick=async()=>{await save('deleted',[]);state.deleted=[];render();manageTab('backup');toast('已恢复移除的表情')};
 }
}
async function fileToMeme(file,category,license){
 if(file.size>8*1024*1024)throw new Error('单张图片不能超过 8 MB');
 const bytes=new Uint8Array(await file.arrayBuffer()),sig=[...bytes.slice(0,12)].map(x=>String.fromCharCode(x)).join('');
 let format;if(sig.startsWith('\x89PNG\r\n\x1a\n'))format='png';else if(bytes[0]===255&&bytes[1]===216&&bytes[2]===255)format='jpg';else if(sig.startsWith('GIF87a')||sig.startsWith('GIF89a'))format='gif';else if(sig.startsWith('RIFF')&&sig.slice(8,12)==='WEBP')format='webp';else throw new Error('文件内容不是支持的图片');
 const bitmap=await createImageBitmap(file);const {width,height}=bitmap;
 if(width*height>20_000_000){bitmap.close();throw new Error('图片分辨率过大')}
 const canvas=document.createElement('canvas'),scale=Math.min(1,300/width,300/height);canvas.width=Math.max(1,Math.round(width*scale));canvas.height=Math.max(1,Math.round(height*scale));canvas.getContext('2d').drawImage(bitmap,0,0,canvas.width,canvas.height);bitmap.close();
 const sha=[...new Uint8Array(await crypto.subtle.digest('SHA-256',bytes))].map(x=>x.toString(16).padStart(2,'0')).join('');
 const data=await new Promise((resolve,reject)=>{const f=new FileReader();f.onload=()=>resolve(f.result);f.onerror=reject;f.readAsDataURL(new Blob([bytes],{type:format==='jpg'?'image/jpeg':'image/'+format}))});
 const header=[...bytes.slice(0,1024)].map(x=>String.fromCharCode(x)).join('');
 return {id:'local_'+sha.slice(0,20),title:file.name.replace(/\.[^.]+$/,''),description:'我的私人收藏',description_origin:'human_corrected',category,categories:[category],tags:[catName(category)],moods:[category],scenes:[],format,animated:format==='gif'||(format==='webp'&&header.includes('ANIM'))||(format==='png'&&header.includes('acTL')),width,height,size:file.size,sha256:sha,file:data,thumbnail:canvas.toDataURL('image/webp',.82),sources:[],license:license||'review_required',status:'review_required',imported_at:new Date().toISOString()};
}
async function upload(e){e.preventDefault();const btn=$('#upload-submit');btn.disabled=true;const files=[...$('#uploads').files];let added=0,duplicate=0,failed=0;const list=[...state.local];
 try{if(files.length>100)throw new Error('每批最多上传 100 张');if(files.reduce((n,f)=>n+f.size,0)+list.reduce((n,m)=>n+m.size,0)>200*1024*1024)throw new Error('本地图片总量限制为 200 MB，请先导出整理');
 for(const [i,file] of files.entries()){$('#upload-progress').textContent=`正在检查 ${i+1}/${files.length}：${file.name}`;try{const m=await fileToMeme(file,$('#upload-category').value,$('#upload-license').value);if([...state.catalog.memes,...list].some(x=>x.sha256===m.sha256)){duplicate++;continue}list.push(m);added++}catch{failed++}}
 await save('local',list);state.local=list;render();$('#upload-progress').textContent=`已加入 ${added} 张，跳过 ${duplicate} 张重复，${failed} 张文件未通过检查。`;$('#upload-form').reset();
 }catch(err){toast(err.message)}finally{btn.disabled=false}
}
function exportBackup(){const backup={schema_version:1,exported_at:new Date().toISOString(),local:state.local,edits:state.edits,deleted:state.deleted,favorites:state.favorites,disabled:state.disabled};const u=URL.createObjectURL(new Blob([JSON.stringify(backup)],{type:'application/json'})),a=document.createElement('a');a.href=u;a.download='mimibox-backup-'+new Date().toISOString().slice(0,10)+'.json';a.click();setTimeout(()=>URL.revokeObjectURL(u),2000);toast('备份已导出')}
async function restoreBackup(e){const file=e.target.files[0];if(!file)return;
 try{if(file.size>290*1024*1024)throw new Error('备份文件过大');const b=JSON.parse(await file.text());if(b.schema_version!==1||!Array.isArray(b.local)||typeof b.edits!=='object'||b.edits===null)throw new Error('备份格式不正确');
 const local=[...state.local];for(const item of b.local){if(typeof item.file!=='string'||!/^data:image\/(png|jpeg|gif|webp);base64,/.test(item.file)||item.file.length>12*1024*1024)throw new Error('备份含无效图片');const blob=await (await fetch(item.file)).blob();const restored=await fileToMeme(new File([blob],String(item.title).slice(0,128)),state.catalog.categories.some(c=>c.id===item.category)?item.category:state.catalog.categories[0].id,String(item.license).slice(0,256));if(!local.some(m=>m.sha256===restored.sha256))local.push(restored)}
 if(local.reduce((n,m)=>n+m.size,0)>200*1024*1024)throw new Error('恢复后的本地图片超过 200 MB');
 const edits={...state.edits};for(const [id,m] of Object.entries(b.edits)){if(!get_meme([...state.catalog.memes,...local],id)||!m||typeof m!=='object')continue;const cat=state.catalog.categories.find(c=>c.id===m.category)?.id;if(!cat)throw new Error('备份含无效分类');edits[id]={title:String(m.title).slice(0,128),description:String(m.description).slice(0,2000),tags:Array.isArray(m.tags)?m.tags.map(x=>String(x).slice(0,64)).slice(0,32):[],category:cat,categories:[cat],description_origin:'human_corrected'}}
 const updates={local,edits,favorites:[...new Set([...state.favorites,...(Array.isArray(b.favorites)?b.favorites.filter(x=>typeof x==='string'):[])])],deleted:[...new Set([...state.deleted,...(Array.isArray(b.deleted)?b.deleted.filter(x=>typeof x==='string'):[])])],disabled:[...new Set([...state.disabled,...(Array.isArray(b.disabled)?b.disabled.filter(x=>typeof x==='string'):[])])]};
 for(const [key,value]of Object.entries(updates))await save(key,value);Object.assign(state,updates);render();toast('备份已恢复')
 }catch(err){toast('恢复失败：'+err.message)}
}
function sources(){ $('#info-title').textContent='每张表情，都有来处';$('#info-body').innerHTML=`<p>当前收藏来自以下资源包，仅用于非商业场景。保留原作者署名和各包许可。包的分发许可声明不等于对每张衍生素材权利链的独立认证。</p>${state.catalog.packs.map(p=>`<div class="pack-row"><b>${esc(p.name)}</b><p>${esc(p.author)}<br>${esc(p.license)}</p><a href="https://github.com/${esc(p.repo)}" target="_blank" rel="noopener noreferrer">查看资源与许可 ↗</a></div>`).join('')}<p class="small-note">不明确的授权不会自动进入已发布图库。如需移除资源，请通过仓库 Issue 提供具体图片 ID。</p>`;$('#info').showModal()}
function integration(){ $('#info-title').textContent='这个口袋，怎么用在聊天里？';$('#info-body').innerHTML='<p>现在可以搜索表情、查看原图、保存或复制链接，再手动用于聊天。此站点为私人站点，图片链接需要你的登录权限。</p><p>项目提供 JSON 索引、JavaScript 检索函数和本地 MCP 服务，可供你配置的 Agent 调用。</p><p class="notice">普通 ChatGPT 新对话不会自动发现此站点；当前没有为你安装自动斗图 App。复制链接、提示词和这个说明页都不等于自动接入。</p><p>详细配置和实测记录见仓库的 docs/INTEGRATION.md。</p>';$('#info').showModal()}
document.addEventListener('click',async e=>{
 const target=e.target.closest('button');if(!target)return;
 if(target.dataset.open)detail(target.dataset.open);
 if(target.dataset.favorite)await favorite(target.dataset.favorite);
 if(target.dataset.category){state.category=target.dataset.category;state.favoritesOnly=false;state.limit=36;render()}
 if(target.dataset.query)setQuery(target.dataset.query);
 if(target.dataset.close)$('#'+target.dataset.close).close();
 if(target.dataset.direction)moveDetail(Number(target.dataset.direction));
 if(target.dataset.tab)manageTab(target.dataset.tab);
 if(target.id==='clear-filters')reset();
});
document.addEventListener('change',async e=>{if(e.target.dataset.pack){const p=e.target.dataset.pack,next=e.target.checked?state.disabled.filter(x=>x!==p):[...state.disabled,p];await save('disabled',next);state.disabled=next;render()}});
document.addEventListener('pointerover',e=>{const img=e.target.closest('.image-button')?.querySelector('[data-animation]');if(img&&matchMedia('(hover:hover)').matches&&!matchMedia('(prefers-reduced-motion:reduce)').matches)img.src=img.dataset.animation});
document.addEventListener('pointerout',e=>{const btn=e.target.closest('.image-button');if(btn&&!btn.contains(e.relatedTarget)){const img=btn.querySelector('[data-animation]');if(img)img.src=img.dataset.thumb}});
document.addEventListener('keydown',e=>{if(['INPUT','TEXTAREA','SELECT'].includes(document.activeElement.tagName))return;if(e.key==='/'&&!$$('dialog').some(d=>d.open)){e.preventDefault();$('#search').focus()}if($('#detail').open&&['ArrowLeft','ArrowRight'].includes(e.key)){e.preventDefault();moveDetail(e.key==='ArrowLeft'?-1:1)}});
$('#detail').addEventListener('close',()=>{state.current=null;history.replaceState(null,'',location.pathname+location.search)});
for(const d of $$('dialog'))d.addEventListener('click',e=>{const r=d.getBoundingClientRect();if(e.target===d&&(e.clientX<r.left||e.clientX>r.right||e.clientY<r.top||e.clientY>r.bottom))d.close()});
$('#search-form').onsubmit=e=>{e.preventDefault();clearTimeout(searchTimer);setQuery($('#search').value.trim())};$('#search').oninput=e=>{clearTimeout(searchTimer);searchTimer=setTimeout(()=>setQuery(e.target.value.trim()),180)};
$('#all-nav').onclick=reset;$('#favorites-nav').onclick=()=>{state.favoritesOnly=true;state.category='';state.limit=36;render()};$('#random').onclick=random;
for(const id of ['pack-filter','format-filter','sort'])$('#'+id).onchange=()=>{state.limit=36;render()};
$('#load-more').onclick=()=>{state.limit+=36;render()};$('#manage-open').onclick=()=>openManage();$('#sources-open').onclick=sources;$('#integration-open').onclick=integration;
$('#theme').onclick=async()=>{const theme=document.documentElement.dataset.theme==='dark'?'light':'dark';document.documentElement.dataset.theme=theme;await save('theme',theme)};
async function init(){try{const res=await fetch('./data/catalog.json');if(!res.ok)throw new Error('catalog unavailable');state.catalog=await res.json();
 try{for(const key of ['local','edits','deleted','disabled','favorites','recent'])state[key]=await read(key,state[key]);document.documentElement.dataset.theme=await read('theme',matchMedia('(prefers-color-scheme:dark)').matches?'dark':'light')}catch{toast('浏览器存储不可用，收藏功能需要允许本地存储')}
 const params=new URLSearchParams(location.search);state.query=params.get('q')??'';state.category=params.get('category')??'';state.favoritesOnly=params.get('favorites')==='1';$('#search').value=state.query;
 $('#pack-filter').insertAdjacentHTML('beforeend',state.catalog.packs.map(p=>`<option value="${esc(p.id)}">${esc(p.name)}</option>`).join(''));render();showHero();const hash=new URLSearchParams(location.hash.slice(1));if(hash.get('meme'))detail(hash.get('meme'));
 window.MimiBox={search_memes:(query,limit=10,filters={})=>search_memes(allMemes(),query,limit,filters).map(m=>response(m,location.href)),random_meme:(category,mood)=>response(random_meme(allMemes(),category,mood,state.recent),location.href),get_meme:id=>response(get_meme(allMemes(),id),location.href),list_categories:()=>list_categories(allMemes(),state.catalog.categories)};
 }catch(err){$('#grid').innerHTML='<div class="error-banner">口袋暂时没能打开。请刷新页面，或检查 data/catalog.json 是否已正确部署。</div>';$('#stats').textContent='加载失败';console.error(err)}}
init();
