export const SYNONYMS = [
 ['震惊','惊讶','意外','surprised'],['猫猫','猫','喵','meow'],['鼓励','加油','安慰','comfort'],
 ['数学','做题','复习','学习','work'],['吐槽','离谱','无语','baka','sigh'],['睡觉','晚安','困','sleep'],
 ['开心','高兴','庆祝','happy'],['难过','委屈','伤心','sad'],['喜欢','爱心','点赞','like'],['你好','早安','问候','greeting','morning']
];
const norm = x => String(x ?? '').normalize('NFKC').toLowerCase();
export function search_memes(memes, query='', limit=36, filters={}) {
  const q=norm(query).trim(), tokens=new Set(q.split(/\s+/).filter(Boolean));
  const groups=SYNONYMS.filter(group=>group.some(s=>q.includes(s)));
  // CJK bigrams aid unsegmented Chinese; English fragments cause unrelated matches.
  for(const segment of q.match(/[\p{Script=Han}]+/gu)??[]) for(let i=0;i<segment.length-1;i++) tokens.add(segment.slice(i,i+2));
  const results=[];
  for(const m of memes) {
    if(filters.category && !m.categories.includes(filters.category)) continue;
    if(filters.mood && !m.moods.includes(filters.mood)) continue;
    if(filters.pack && !m.sources.some(s=>s.pack===filters.pack)) continue;
    if(filters.animated!==undefined && m.animated!==filters.animated) continue;
    if(filters.tags?.length && !filters.tags.every(t=>m.tags.includes(t))) continue;
    if(filters.scene && !m.scenes.includes(filters.scene)) continue;
    const title=norm(m.title), desc=norm(m.description), tags=norm([...m.tags,...m.categories,...m.scenes].join(' '));
    let score=q ? (title.includes(q)?20:0)+(desc.includes(q)?7:0)+(tags.includes(q)?14:0) : 1;
    if(q) for(const t of tokens) score+=(title.includes(t)?4:0)+(tags.includes(t)?5:0)+(desc.includes(t)?1:0);
    for(const group of groups) if(group.some(t=>title.includes(t)||tags.includes(t)||desc.includes(t))) score+=group.includes('猫猫')?30:12;
    if(score>0) results.push({...m,score});
  }
  results.sort((a,b)=>b.score-a.score || a.id.localeCompare(b.id));
  return results.slice(0, Math.max(0,limit));
}
export function random_meme(memes, category='', mood='', exclude=[]) {
  const pool=memes.filter(m=>(!category||m.categories.includes(category))&&(!mood||m.moods.includes(mood)));
  const fresh=pool.filter(m=>!exclude.includes(m.id));const candidates=fresh.length?fresh:pool;
  return candidates.length?candidates[Math.floor(Math.random()*candidates.length)]:null;
}
export const get_meme=(memes,id)=>memes.find(m=>m.id===id)??null;
export const list_categories=(memes,categories)=>categories.map(c=>({...c,count:memes.filter(m=>m.categories.includes(c.id)).length})).filter(c=>c.count);
export function response(m,base='') {
  return m?{...m,image_url:new URL(m.file,base||'http://localhost/').href,thumbnail_url:new URL(m.thumbnail,base||'http://localhost/').href}:null;
}
