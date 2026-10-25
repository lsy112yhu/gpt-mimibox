import unittest, tempfile, json, sys, zipfile, hashlib, io
from pathlib import Path
from PIL import Image
sys.path.insert(0,str(Path(__file__).resolve().parents[1]/'scripts'))
import mimibox as m
class ImportTests(unittest.TestCase):
 def setUp(self):
  self.tmp=tempfile.TemporaryDirectory();self.root=Path(self.tmp.name);self.old=m.ROOT;m.ROOT=self.root/'out'
  self.pack=self.root/'pack';(self.pack/'memes/happy').mkdir(parents=True)
  self.manifest={'id':'test-pack','name':'Test','version':'1','categories':{'happy':{'description':'开心'}} ,'license':'CC0-1.0','source':{'repo':'test/pack','ref':'v1'}}
  self.setmanifest();Image.new('RGB',(30,30),'red').save(self.pack/'memes/happy/a.png')
 def setmanifest(self): (self.pack/'manifest.json').write_text(json.dumps(self.manifest))
 def tearDown(self):m.ROOT=self.old;self.tmp.cleanup()
 def approve(self):return m.import_pack(self.pack,True,'LICENSE','a'*40)
 def test_unknown_license_is_quarantined(self):
  result=m.import_pack(self.pack);self.assertEqual(result['status'],'review_required');self.assertFalse((m.ROOT/'public/images').exists())
 def test_import_is_incremental_and_merges_sources(self):
  self.assertEqual(self.approve()['imported'],1);self.assertEqual(self.approve()['imported'],0)
  self.manifest['id']='other-pack';self.setmanifest();self.assertEqual(self.approve()['duplicates'],1)
  data=m.read(m.ROOT/'data/memes.json');self.assertEqual(len(data[0]['sources']),2);self.assertEqual(m.validate()['images'],1)
 def test_bad_file_rejected(self):
  (self.pack/'memes/happy/evil.png').write_text('<svg onload="evil()"/>');self.assertEqual(len(self.approve()['rejected']),1)
 def test_symlink_escape_rejected(self):
  Image.new('RGB',(5,5)).save(self.root/'outside.png');(self.pack/'memes/happy/evil.png').symlink_to(self.root/'outside.png');self.assertEqual(len(self.approve()['rejected']),1)
 def test_zip_slip_and_symlinks(self):
  z=self.root/'evil.zip'
  with zipfile.ZipFile(z,'w')as f:f.writestr('../escape.txt','bad')
  with self.assertRaises(ValueError):m.extract(z,self.root/'extract')
  with zipfile.ZipFile(z,'w')as f:
   info=zipfile.ZipInfo('link');info.external_attr=0o120777<<16;f.writestr(info,'../target')
  with self.assertRaises(ValueError):m.extract(z,self.root/'extract')
 def test_animation_preserved(self):
  frames=[Image.new('RGB',(20,20),v)for v in ['blue','green']];frames[0].save(self.pack/'memes/happy/a.gif',save_all=True,append_images=frames[1:],duration=100,loop=0)
  self.approve();data=m.read(m.ROOT/'data/memes.json');gif=next(x for x in data if x['animated']);self.assertEqual(gif['frames'],2);self.assertEqual(m.validate()['animated'],1)
 def test_missing_evidence_cannot_approve(self):
  with self.assertRaises(ValueError):m.import_pack(self.pack,True)
 def test_semantic_hash_mismatch_rejected(self):
  meta={'schema_version':'2.0','pack_id':'test-pack','images':{'x':{'relative_path':'memes/happy/a.png','content_sha256':'bad','entry_id':'x','category':'happy'}}};m.write(self.pack/'semantic_metadata.json',meta);self.assertEqual(len(self.approve()['rejected']),1)
 def test_removed_upstream_file_leaves_inventory(self):
  self.approve();(self.pack/'memes/happy/a.png').unlink();self.approve();self.assertEqual(m.validate()['images'],0);self.assertEqual(list((m.ROOT/'public/images').glob('*')),[])
 def test_backup_updates_only_metadata(self):
  self.approve();mid=m.read(m.ROOT/'data/memes.json')[0]['id'];p=self.root/'backup.json';m.write(p,{'schema_version':1,'local':[],'edits':{mid:{'title':'new','description':'new','category':'happy','tags':['ok']}},'deleted':[mid]});m.apply_backup(p);self.assertEqual(m.read(m.ROOT/'data/memes.json')[0]['title'],'new');self.assertEqual(m.validate()['images'],1)
if __name__=='__main__':unittest.main()
