"""Restore reviewed media from pinned upstream commits; never execute upstream code."""
import argparse
import hashlib
import json
from pathlib import Path
import re
import shutil
import subprocess
import tempfile
from PIL import Image

ROOT = Path(__file__).resolve().parents[1]

def sha(path):
    return hashlib.sha256(path.read_bytes()).hexdigest()

def restore():
    memes = json.loads((ROOT/'data/memes.json').read_text())
    packs = {p['id']:p for p in json.loads((ROOT/'data/packs.json').read_text())}
    missing = [m for m in memes if not (ROOT/'public'/m['file']).is_file()]
    restored = thumbs = 0
    with tempfile.TemporaryDirectory(prefix='mimibox-upstream-') as tmp:
        checkouts = {}
        for m in missing:
            assert m['status']=='approved', 'Unreviewed media is never restored'
            success = False
            for source in m['sources']:
                pack = packs[source['pack']]
                assert pack['status']=='approved' and pack.get('license_evidence'), 'Missing review evidence'
                repo, revision = pack['repo'], source['revision']
                assert re.fullmatch(r'[A-Za-z0-9_.-]+/[A-Za-z0-9_.-]+',repo)
                assert re.fullmatch(r'[0-9a-f]{40}',revision), 'Pin upstream commit'
                key = (repo, revision)
                if key not in checkouts:
                    checkout = Path(tmp)/str(len(checkouts))
                    subprocess.run(['git','init','-q',str(checkout)],check=True)
                    subprocess.run(['git','-C',str(checkout),'fetch','--quiet','--depth=1',f'https://github.com/{repo}.git',revision],check=True)
                    subprocess.run(['git','-C',str(checkout),'checkout','--quiet','--detach','FETCH_HEAD'],check=True)
                    checkouts[key] = checkout
                checkout = checkouts[key]
                relative = Path(source['path'])
                if relative.is_absolute() or '..' in relative.parts or '\\' in str(relative):
                    raise ValueError('Unsafe source path')
                original = (checkout/relative).resolve()
                if not original.is_relative_to(checkout.resolve()) or not original.is_file():
                    continue
                if sha(original)!=m['sha256']:
                    continue
                target = ROOT/'public'/m['file']
                assert target.resolve().is_relative_to((ROOT/'public/images').resolve())
                target.parent.mkdir(parents=True,exist_ok=True)
                shutil.copyfile(original,target)
                restored += 1
                success = True
                break
            if not success:
                raise ValueError('No verified original found for '+m['id'])
        for m in memes:
            original = ROOT/'public'/m['file']
            assert sha(original)==m['sha256'], 'Image content hash mismatch'
            thumb = ROOT/'public'/m['thumbnail']
            assert thumb.resolve().is_relative_to((ROOT/'public/thumbnails').resolve())
            if not thumb.is_file():
                thumb.parent.mkdir(parents=True,exist_ok=True)
                with Image.open(original) as im:
                    im.seek(0)
                    image = im.convert('RGBA')
                    image.thumbnail((300,300))
                    image.save(thumb,'WEBP',quality=82)
                thumbs += 1
    print(json.dumps({'images':len(memes),'restored':restored,'thumbnails_generated':thumbs}))

if __name__=='__main__':
    parser=argparse.ArgumentParser()
    parser.add_argument('--if-missing',action='store_true',help='Existing files are always kept and verified.')
    parser.parse_args()
    restore()
