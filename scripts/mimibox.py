"""MimiBox offline curator. Never executes pack code or downloads remote URLs."""
import argparse, base64, hashlib, json, re, shutil, sys, zipfile, tempfile, warnings
from datetime import datetime, timezone
from pathlib import Path
from PIL import Image, ImageFile
Image.MAX_IMAGE_PIXELS = 20_000_000
ImageFile.LOAD_TRUNCATED_IMAGES = False
warnings.simplefilter('error', Image.DecompressionBombWarning)
ROOT = Path(__file__).resolve().parents[1]
MAX_FILE = 8 * 1024 * 1024
MAX_ARCHIVE = 300 * 1024 * 1024
FORMATS = {'PNG':'png', 'JPEG':'jpg', 'GIF':'gif', 'WEBP':'webp'}
CATEGORY_MAP = {
 'happy':('开心庆祝','✦',['开心','快乐','庆祝','笑','成功','鼓励','加油','胜利']),
 'surprised':('震惊意外','!',['震惊','惊讶','意外','离谱','不可思议']),
 'confused':('疑惑思考','?',['疑惑','思考','不懂','问号','为什么']),
 'angry':('生气吐槽','♨',['生气','吐槽','反对','愤怒']),
 'sad':('委屈难过','☂',['难过','哭','委屈','伤心','遗憾']),
 'like':('喜欢认可','♡',['喜欢','爱心','点赞','认同','夸奖']),
 'shy':('害羞心动','❀',['害羞','心动','脸红','可爱']),
 'sleep':('困困休息','☾',['睡觉','困','晚安','休息','疲惫']),
 'work':('学习工作','⌨',['学习','工作','数学','复习','打字','忙碌']),
 'greeting':('招呼问候','☀',['问候','你好','早安','打招呼']),
 'morning':('早安时刻','☀',['早安','早上好','起床']),
 'see':('围观偷瞄','◎',['围观','偷看','吃瓜','观察']),
 'sigh':('无奈叹气','…',['无奈','无语','叹气','累了']),
 'baka':('友善吐槽','↯',['笨蛋','吐槽','调侃','离谱']),
 'fool':('搞怪自嘲','☺',['搞笑','搞怪','自嘲','抽象']),
 'meow':('猫猫卖萌','ฅ',['猫','猫猫','喵','卖萌','可爱']),
 'reply':('等待回应','↩',['回复','等待','收到','确认']),
 'cpu':('大脑加载','◌',['加载','卡住','思考','烧脑']),
 'color':('俏皮互动','✿',['俏皮','互动','暧昧']),
 'food':('吃吃喝喝','♧',['吃饭','喝水','零食','食物','干杯']),
 'money':('红包打赏','¥',['红包','付款','金钱','奖励','打赏']),
 'givemoney':('红包打赏','¥',['要钱','金钱','奖励','打赏']),
 'entertainment':('游戏娱乐','♫',['游戏','唱歌','跳舞','娱乐']),
 'comfort':('安慰摸摸','☁',['安慰','摸头','鼓励','加油','抱抱']),
 'mischief':('调皮搞事','♬',['调皮','恶作剧','搞事','吐舌'])}
def read(path, default=None):
    return json.loads(path.read_text(encoding='utf-8-sig')) if path.exists() else default
def write(path, data):
    path.parent.mkdir(parents=True,exist_ok=True)
    tmp = path.with_suffix(path.suffix+'.tmp')
    tmp.write_text(json.dumps(data,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
    tmp.replace(path)
def safe(root, name):
    if not isinstance(name,str) or '\\' in name or Path(name).is_absolute() or '..' in Path(name).parts:
        raise ValueError('unsafe path')
    path=(root/name).resolve()
    if not path.is_relative_to(root.resolve()): raise ValueError('path escape')
    return path
def image_info(path):
    if path.stat().st_size > MAX_FILE: raise ValueError('image exceeds 8 MiB')
    with Image.open(path) as im:
        if im.format not in FORMATS: raise ValueError('unsupported image content')
        ext=FORMATS[im.format]; w,h=im.size; frames=getattr(im,'n_frames',1)
        if frames > 1000 or w*h*frames > 250_000_000: raise ValueError('animation budget exceeded')
        for i in range(frames): im.seek(i); im.load()
    return ext,w,h,frames
def dhash(path):
    with Image.open(path) as im:
        im.seek(0); pixels=list(im.convert('L').resize((9,8)).get_flattened_data())
    return f'{sum((pixels[y*9+x]>pixels[y*9+x+1])<<(y*8+x) for y in range(8) for x in range(8)):016x}'
def extract(archive, root):
    with zipfile.ZipFile(archive) as z:
        if len(z.infolist()) > 10000 or sum(i.file_size for i in z.infolist()) > MAX_ARCHIVE:
            raise ValueError('archive budget exceeded')
        for i in z.infolist():
            safe(root,i.filename)
            if (i.external_attr >> 16) & 0o170000 == 0o120000: raise ValueError('symlink in ZIP')
        z.extractall(root)
def import_pack(pack_root, approved=False, evidence=None, revision=None):
    pack_root=pack_root.resolve(); manifest=read(safe(pack_root,'manifest.json'))
    if not isinstance(manifest,dict): raise ValueError('manifest required')
    pid=manifest.get('id','')
    if not re.fullmatch(r'[a-z0-9][a-z0-9._-]{1,63}',pid): raise ValueError('invalid pack ID')
    license=manifest.get('license','review_required')
    if approved and (not evidence or license=='review_required'): raise ValueError('approval requires license and evidence')
    if not approved:
        q=ROOT/'quarantine'/pid
        q.mkdir(parents=True,exist_ok=True)
        write(q/'review.json',{'manifest':manifest,'status':'review_required','path':str(pack_root)})
        return {'status':'review_required','id':pid,'imported':0}
    memes=read(ROOT/'data/memes.json',[]); packs=read(ROOT/'data/packs.json',[]); cats=read(ROOT/'data/categories.json',[])
    byhash={m['sha256']:m for m in memes}; catmap={c['id']:c for c in cats}
    semantics=read(safe(pack_root,'semantic_metadata.json'),{})
    if semantics and (semantics.get('schema_version')!='2.0' or semantics.get('pack_id')!=pid):
        raise ValueError('invalid semantic metadata identity')
    sem={v['relative_path']:v for v in semantics.get('images',{}).values()}
    repo=manifest.get('source',{}).get('repo',''); rev=revision or manifest.get('source',{}).get('ref','main')
    if not re.fullmatch(r'[A-Za-z0-9_.-]+/[A-Za-z0-9_.-]+',repo): raise ValueError('GitHub source repository required')
    imported=duplicates=0; rejected=[]; inventory=[]
    for path in sorted((pack_root/'memes').glob('*/*')):
        try:
            if path.is_symlink() or not path.is_file(): raise ValueError('not a regular image')
            path=safe(pack_root,path.relative_to(pack_root).as_posix())
            cat=path.parent.name
            if not re.fullmatch(r'[A-Za-z0-9][A-Za-z0-9._-]{0,63}',cat) or cat not in manifest['categories']: raise ValueError('unknown category')
            ext,w,h,frames=image_info(path); sha=hashlib.sha256(path.read_bytes()).hexdigest()
            rel=path.relative_to(pack_root).as_posix(); meta=sem.get(rel,{})
            if meta:
                expected=hashlib.sha256((sha+'\0'+cat+'\0'+rel).encode()).hexdigest()
                if meta.get('content_sha256')!=sha or meta.get('entry_id')!=expected or meta.get('category')!=cat:
                    raise ValueError('semantic metadata hash/path mismatch')
            source={'pack':pid,'url':f'https://github.com/{repo}/blob/{rev}/{rel}', 'path':rel,'revision':rev,'license':license,'author':manifest.get('author',manifest.get('maintainer','未注明'))}
            inventory.append(sha)
            if sha in byhash:
                if source not in byhash[sha]['sources']: byhash[sha]['sources'].append(source)
                if cat not in byhash[sha]['categories']: byhash[sha]['categories'].append(cat)
                duplicates+=1
            else:
                mid='m_'+sha[:20]; dest=ROOT/f'public/images/{mid}.{ext}'; dest.parent.mkdir(parents=True,exist_ok=True); shutil.copyfile(path,dest)
                thumb=ROOT/f'public/thumbnails/{mid}.webp';thumb.parent.mkdir(parents=True,exist_ok=True)
                with Image.open(path) as im:
                    im.seek(0); im=im.convert('RGBA'); im.thumbnail((300,300)); im.save(thumb,'WEBP',quality=82)
                label,icon,tags=CATEGORY_MAP.get(cat,(cat,'✦',[cat]))
                original_title=re.sub(r'^\d+[_-]?','',path.stem)
                generic=bool(re.fullmatch(r'(?:s\d?[-_]\d+|file_\d+|[0-9_]+|[a-fA-F0-9]{16,})',path.stem))
                title=f'{label} · {len(memes)+1:03}' if generic else original_title
                caption=meta.get('caption','') if meta.get('caption_status')=='done' else ''
                m={'id':mid,'title':title,'description':caption or f'{label}。{manifest["categories"][cat]["description"]}',
                   'description_origin':'upstream_semantic' if caption else 'category_metadata',
                   'category':cat,'categories':[cat],'tags':list(dict.fromkeys(tags+meta.get('tags',[]))),
                   'moods':[cat],'scenes':tags,'format':ext,'animated':frames>1,'frames':frames,'width':w,'height':h,'size':path.stat().st_size,
                   'file':f'images/{mid}.{ext}','thumbnail':f'thumbnails/{mid}.webp','sha256':sha,'dhash':dhash(path),
                   'sources':[source],'license':license,'status':'approved','imported_at':datetime.now(timezone.utc).isoformat()}
                memes.append(m);byhash[sha]=m;imported+=1
            label,icon,tags=CATEGORY_MAP.get(cat,(cat,'✦',[cat]))
            catmap.setdefault(cat,{'id':cat,'name':label,'icon':icon,'keywords':tags,'description':manifest['categories'][cat]['description']})
        except (ValueError,OSError,Image.DecompressionBombError,Image.DecompressionBombWarning) as e:
            rejected.append({'path':path.name,'reason':str(e)})
    # Update this pack's current inventory; removed upstream entries cease to be published.
    inventory=set(inventory)
    for m in memes: m['sources']=[s for s in m['sources'] if s['pack']!=pid or m['sha256'] in inventory]
    memes=[m for m in memes if m['sources']]
    pack={'id':pid,'name':manifest['name'],'version':manifest['version'],'revision':rev,'repo':repo,
          'license':license,'license_evidence':evidence,'author':manifest.get('author',manifest.get('maintainer','未注明')),
          'enabled':True,'status':'approved','imported_at':datetime.now(timezone.utc).isoformat(),'rejected':rejected}
    packs=[p for p in packs if p['id']!=pid]+[pack]
    write(ROOT/'data/memes.json',memes);write(ROOT/'data/packs.json',packs);write(ROOT/'data/categories.json',list(catmap.values()))
    rebuild()
    return {'imported':imported,'duplicates':duplicates,'rejected':rejected,'total':len(memes)}
def rebuild():
    memes=read(ROOT/'data/memes.json',[]);packs=read(ROOT/'data/packs.json',[])
    aliases=read(ROOT/'data/category-aliases.json',{})
    cats={}
    for c in read(ROOT/'data/categories.json',[]):
        cid=aliases.get(c['id'],c['id'])
        if cid not in cats or cid==c['id']:cats[cid]={**c,'id':cid}
    for m in memes:
        m['category']=aliases.get(m['category'],m['category'])
        m['categories']=list(dict.fromkeys(aliases.get(c,c) for c in m['categories']))
        m['moods']=list(dict.fromkeys(aliases.get(c,c) for c in m['moods']))
    write(ROOT/'data/memes.json',memes);write(ROOT/'data/categories.json',list(cats.values()))
    enabled={p['id'] for p in packs if p.get('enabled') and p['status']=='approved'}
    visible=[m for m in memes if m['status']=='approved' and any(s['pack'] in enabled for s in m['sources'])]
    for path in (ROOT/'public/images').glob('*'):
        if path.name not in {Path(m['file']).name for m in memes}: path.unlink()
    for path in (ROOT/'public/thumbnails').glob('*'):
        if path.name not in {Path(m['thumbnail']).name for m in memes}: path.unlink()
    write(ROOT/'data/search-index.json',[{'id':m['id'],'text':' '.join([m['title'],m['description'],*m['tags'],*m['scenes']])} for m in visible])
    write(ROOT/'data/catalog.json',{'schema_version':1,'memes':visible,'categories':read(ROOT/'data/categories.json',[]),'packs':packs})
def validate():
    memes=read(ROOT/'data/memes.json',[]);cats={c['id'] for c in read(ROOT/'data/categories.json',[])};seen=set();ids=set()
    packs={p['id']:p for p in read(ROOT/'data/packs.json',[])}
    for m in memes:
        assert m['id'] not in ids and m['sha256'] not in seen,'duplicate ID/hash'
        ids.add(m['id']); seen.add(m['sha256'])
        assert set(m['categories'])<=cats and m['category'] in cats,'unknown category'
        assert m['sources'] and all(s['pack'] in packs and s.get('license') and s.get('revision') for s in m['sources']),'source required'
        assert m['status']=='approved' and m['license']!='review_required','unapproved image'
        path=safe(ROOT/'public',m['file']);ext,w,h,frames=image_info(path)
        assert hashlib.sha256(path.read_bytes()).hexdigest()==m['sha256'],'hash mismatch'
        assert (ext,w,h,frames,path.stat().st_size)==(m['format'],m['width'],m['height'],m['frames'],m['size']),'metadata mismatch'
        image_info(safe(ROOT/'public',m['thumbnail']))
    published=read(ROOT/'data/catalog.json',{})
    assert {m['id'] for m in published.get('memes',[])}=={m['id'] for m in memes if any(packs[s['pack']].get('enabled') for s in m['sources'])},'stale catalog'
    return {'images':len(memes),'animated':sum(m['animated'] for m in memes),'categories':len({c for m in memes for c in m['categories']}),'packs':len(packs),'bytes':sum(m['size'] for m in memes)}
def apply_backup(path):
    if path.stat().st_size > 290*1024*1024: raise ValueError('backup exceeds budget')
    backup=read(path); cats={c['id'] for c in read(ROOT/'data/categories.json',[])}
    if backup.get('schema_version')!=1 or not isinstance(backup.get('edits'),dict) or not isinstance(backup.get('local'),list):raise ValueError('invalid backup schema')
    memes=read(ROOT/'data/memes.json',[]); byid={m['id']:m for m in memes};changes=[]
    for mid, edit in backup['edits'].items():
        if mid not in byid:continue
        if edit.get('category') not in cats or not isinstance(edit.get('title'),str) or not isinstance(edit.get('description'),str) or not isinstance(edit.get('tags'),list) or not all(isinstance(t,str) for t in edit['tags']):raise ValueError('invalid edit')
        m=byid[mid];m.update(title=edit['title'][:128],description=edit['description'][:2000],tags=[t[:64] for t in edit['tags'][:32]],category=edit['category'],categories=[edit['category']],description_origin='human_corrected');changes.append(mid)
    # Browser removals, favorites and pack toggles remain preferences, never repository deletion commands.
    staged=[]
    with tempfile.TemporaryDirectory() as tmp:
        for item in backup['local']:
            match=re.fullmatch(r'data:image/(png|jpeg|gif|webp);base64,([A-Za-z0-9+/=]+)',item.get('file',''))
            if not match or len(match[2])>12*1024*1024:raise ValueError('invalid local image')
            raw=base64.b64decode(match[2],validate=True); sha=hashlib.sha256(raw).hexdigest();file=Path(tmp)/sha;file.write_bytes(raw);ext,*_=image_info(file)
            staged.append((sha,ext,raw,{'title':str(item.get('title',''))[:128],'license':str(item.get('license','review_required'))[:256],'status':'review_required'}))
        for sha,ext,raw,meta in staged:
            q=ROOT/'quarantine'/'browser-upload';q.mkdir(parents=True,exist_ok=True);(q/(sha+'.'+ext)).write_bytes(raw);write(q/(sha+'.json'),meta)
    write(ROOT/'data/memes.json',memes);rebuild()
    return {'edited':len(changes),'quarantined':len(staged),'note':'New images require a reviewed manifest and explicit license evidence before import.'}
def enrich(path, repository, revision, evidence):
    if not re.fullmatch(r'[A-Za-z0-9_.-]+/[A-Za-z0-9_.-]+',repository) or not re.fullmatch(r'[0-9a-f]{40}',revision):raise ValueError('repository and pinned commit required')
    metadata=read(path)
    if metadata.get('schema_version')!='2.0':raise ValueError('unsupported semantic schema')
    memes=read(ROOT/'data/memes.json',[]);byhash={m['sha256']:m for m in memes};count=0
    for key,item in metadata.get('images',{}).items():
        sha=item['content_sha256']; cat=item['category']; rel=item['relative_path']
        expected=hashlib.sha256((sha+'\0'+cat+'\0'+rel).encode()).hexdigest()
        if key!=expected or item['entry_id']!=expected:raise ValueError('semantic identity mismatch')
        m=byhash.get(sha)
        if not m or item.get('caption_status')!='done' or m.get('description_origin')=='human_corrected':continue
        # Packs can rename files. Content SHA-256 is the identity for cross-pack enrichment.
        caption=re.sub(r'^以当前分类.*?所代表的情绪、态度或用途为主体[：:]','',item['caption'])
        tags=[t for t in item.get('tags',[]) if not t.startswith('category:')]
        m['description']=caption;m['tags']=list(dict.fromkeys([*m['tags'],*tags]))[:32]
        m['description_origin']='upstream_semantic';m['semantic_source']={'author':'DDZS987','license':'CC-BY-NC-SA-4.0','url':f'https://github.com/{repository}/blob/{revision}/semantic_metadata.json','revision':revision,'evidence':evidence,'provenance':item.get('provenance','unknown')}
        text=item.get('visible_text','').strip()
        if ' · ' in m['title']:m['title']=text[:40] if text else ' · '.join(tags[:2])[:40] or m['title']
        count+=1
    write(ROOT/'data/memes.json',memes);rebuild();return {'enriched_entries':count,'unique_described':sum(m.get('description_origin')=='upstream_semantic' for m in memes)}
def main():
    p=argparse.ArgumentParser();sub=p.add_subparsers(dest='command',required=True)
    imp=sub.add_parser('import');imp.add_argument('path',type=Path);imp.add_argument('--approved',action='store_true');imp.add_argument('--evidence');imp.add_argument('--revision')
    sub.add_parser('validate');sub.add_parser('rebuild')
    backup=sub.add_parser('apply-backup');backup.add_argument('path',type=Path)
    en=sub.add_parser('enrich');en.add_argument('path',type=Path);en.add_argument('--repository',required=True);en.add_argument('--revision',required=True);en.add_argument('--evidence',required=True)
    dup=sub.add_parser('similar');dup.add_argument('--distance',type=int,default=5)
    pack=sub.add_parser('pack');pack.add_argument('id');pack.add_argument('action',choices=['enable','disable','delete'])
    edit=sub.add_parser('edit');edit.add_argument('id');edit.add_argument('--title');edit.add_argument('--description');edit.add_argument('--tags');edit.add_argument('--category');edit.add_argument('--delete',action='store_true')
    args=p.parse_args()
    if args.command=='import':
        if args.path.suffix.lower()=='.zip':
            with tempfile.TemporaryDirectory() as tmp:
                extract(args.path,Path(tmp));result=import_pack(Path(tmp),args.approved,args.evidence,args.revision)
        else:result=import_pack(args.path,args.approved,args.evidence,args.revision)
    elif args.command=='validate':result=validate()
    elif args.command=='apply-backup':result=apply_backup(args.path)
    elif args.command=='enrich':result=enrich(args.path,args.repository,args.revision,args.evidence)
    elif args.command=='rebuild':rebuild();result={'rebuilt':True}
    elif args.command=='similar':
        memes=read(ROOT/'data/memes.json',[]); result=[{'a':a['id'],'b':b['id'],'distance':(int(a['dhash'],16)^int(b['dhash'],16)).bit_count(),'warning':'First frame only; review manually. Never auto-delete animations.'} for i,a in enumerate(memes) for b in memes[i+1:] if (int(a['dhash'],16)^int(b['dhash'],16)).bit_count()<=args.distance]
    elif args.command=='pack':
        packs=read(ROOT/'data/packs.json',[])
        if not any(x['id']==args.id for x in packs):raise ValueError('pack not found')
        if args.action=='delete':
            packs=[x for x in packs if x['id']!=args.id];memes=read(ROOT/'data/memes.json',[])
            for m in memes:m['sources']=[s for s in m['sources'] if s['pack']!=args.id]
            write(ROOT/'data/memes.json',[m for m in memes if m['sources']])
        else:
            for x in packs:
                if x['id']==args.id:x['enabled']=args.action=='enable'
        write(ROOT/'data/packs.json',packs);rebuild();result={'updated':args.id}
    elif args.command=='edit':
        memes=read(ROOT/'data/memes.json',[]);m=next((m for m in memes if m['id']==args.id),None)
        if m is None:raise ValueError('meme not found')
        if args.delete:memes.remove(m)
        else:
            for field in ['title','description']:
                if getattr(args,field) is not None:m[field]=getattr(args,field)
            if args.tags is not None:m['tags']=[s.strip() for s in args.tags.split(',') if s.strip()]
            if args.category:
                assert args.category in {c['id'] for c in read(ROOT/'data/categories.json',[])},'unknown category'
                m['category']=args.category;m['categories']=[args.category]
            m['description_origin']='human_corrected'
        write(ROOT/'data/memes.json',memes);rebuild();result={'updated':args.id}
    print(json.dumps(result,ensure_ascii=False))
if __name__=='__main__':main()
