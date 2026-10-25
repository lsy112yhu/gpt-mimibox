import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {spawnSync} from 'node:child_process';
import {search_memes,random_meme,get_meme,list_categories,response} from '../src/core.js';
const c=JSON.parse(readFileSync(new URL('../data/catalog.json',import.meta.url)));
test('natural language ranks cats and encouragement',()=>{
 const cats=search_memes(c.memes,'震惊猫猫',10);assert.ok(cats.length);assert.ok(cats.some(m=>m.tags.includes('猫猫')));
 const study=search_memes(c.memes,'鼓励我做数学题',10);assert.ok(study.some(m=>m.categories.includes('work')||m.categories.includes('comfort')||m.categories.includes('happy')));
});
test('combined filters, scene and tags',()=>{const m=c.memes.find(x=>x.animated),r=search_memes(c.memes,'',100,{category:m.category,pack:m.sources[0].pack,animated:true,tags:[m.tags[0]],scene:m.scenes[0]});assert.ok(r.length);assert.ok(r.every(x=>x.animated&&x.categories.includes(m.category)))});
test('zero results, limits and unknown ID',()=>{assert.deepEqual(search_memes(c.memes,'unmatchablezzzxxyy',10),[]);assert.equal(search_memes(c.memes,'',3).length,3);assert.equal(get_meme(c.memes,'no'),null);assert.equal(random_meme([],''),null)});
test('random excludes recent and respects category',()=>{const pool=c.memes.filter(m=>m.category==='meow').slice(0,3);const result=random_meme(pool,'meow','',pool.slice(0,2).map(m=>m.id));assert.equal(result.id,pool[2].id);assert.ok(random_meme(pool,'meow','',pool.map(m=>m.id)))});
test('category counts and URL construction',()=>{const cats=list_categories(c.memes,c.categories);assert.ok(cats.every(cat=>cat.count>0));assert.equal(response(c.memes[0],'https://example.test/').image_url,'https://example.test/'+c.memes[0].file)});
test('MCP initialize, tools and actual retrieval over stdio',()=>{
 const input=[{jsonrpc:'2.0',id:1,method:'initialize',params:{}},{jsonrpc:'2.0',method:'notifications/initialized'},{jsonrpc:'2.0',id:2,method:'tools/list'},{jsonrpc:'2.0',id:3,method:'tools/call',params:{name:'search_memes',arguments:{query:'晚安',limit:3}}},{jsonrpc:'2.0',id:4,method:'tools/call',params:{name:'search_memes',arguments:{query:'猫',limit:-1}}}].map(JSON.stringify).join('\n')+'\n';
 const r=spawnSync(process.execPath,['scripts/agent.mjs','--stdio'],{input,encoding:'utf8'});assert.equal(r.status,0);const messages=r.stdout.trim().split('\n').map(JSON.parse);assert.equal(messages.length,4);assert.equal(messages[1].result.tools.length,4);assert.equal(JSON.parse(messages[2].result.content[0].text).length,3);assert.equal(messages[3].result.isError,true);
});
