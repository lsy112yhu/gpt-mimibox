#!/usr/bin/env node
// Dependency-free MCP stdio server and command-line retrieval.
import {readFileSync} from 'node:fs';
import {fileURLToPath,pathToFileURL} from 'node:url';
import {resolve,dirname} from 'node:path';
import {createInterface} from 'node:readline';
import {search_memes,random_meme,get_meme,list_categories,response} from '../src/core.js';
const root=resolve(dirname(fileURLToPath(import.meta.url)),'..');
const catalog=JSON.parse(readFileSync(resolve(root,'data/catalog.json'),'utf8'));
const base=process.env.MIMIBOX_BASE_URL||pathToFileURL(resolve(root,'public')+'/').href;
const properties={category:{type:'string'},mood:{type:'string'},pack:{type:'string'},animated:{type:'boolean'},scene:{type:'string'},tags:{type:'array',items:{type:'string'}}};
const tools=[
 {name:'search_memes',description:'Search MimiBox titles, tags and descriptions. Returns licensed media with provenance; does not send images to chats.',inputSchema:{type:'object',properties:{query:{type:'string'},limit:{type:'integer',minimum:1,maximum:50},filters:{type:'object',properties}},required:['query']}},
 {name:'random_meme',description:'Choose a meme excluding recent results within this server session.',inputSchema:{type:'object',properties:{category:{type:'string'},mood:{type:'string'}}}},
 {name:'get_meme',description:'Read image and provenance by stable ID.',inputSchema:{type:'object',properties:{id:{type:'string'}},required:['id']}},
 {name:'list_categories',description:'List current categories and image counts.',inputSchema:{type:'object',properties:{}}}
];
const recent=[];
export function call(name,args={}) {
 if(!args||typeof args!=='object'||Array.isArray(args))throw new Error('arguments must be an object');
 if(name==='search_memes'){
  if(typeof args.query!=='string'||args.limit!==undefined&&(!Number.isInteger(args.limit)||args.limit<1||args.limit>50))throw new Error('query must be a string; limit must be 1..50');
  return search_memes(catalog.memes,args.query,args.limit??10,args.filters??{}).map(m=>response(m,base));
 }
 if(name==='random_meme'){const m=random_meme(catalog.memes,args.category,args.mood,recent);if(m){recent.push(m.id);if(recent.length>30)recent.shift()}return response(m,base)}
 if(name==='get_meme'){if(typeof args.id!=='string')throw new Error('id required');return response(get_meme(catalog.memes,args.id),base)}
 if(name==='list_categories')return list_categories(catalog.memes,catalog.categories);
 throw new Error('unknown tool');
}
function dispatch(msg){
 if(msg.id===undefined)return null;
 const result={jsonrpc:'2.0',id:msg.id};
 if(msg.method==='initialize')return {...result,result:{protocolVersion:'2024-11-05',capabilities:{tools:{}},serverInfo:{name:'mimibox',version:'1.0.0'}}};
 if(msg.method==='ping')return {...result,result:{}};
 if(msg.method==='tools/list')return {...result,result:{tools}};
 if(msg.method==='tools/call'){try{const data=call(msg.params.name,msg.params.arguments);return {...result,result:{content:[{type:'text',text:JSON.stringify(data)}]}}}catch(e){return {...result,result:{isError:true,content:[{type:'text',text:e.message}]}}}}
 return {...result,error:{code:-32601,message:'Method not found'}};
}
if(process.argv[2]==='--stdio'){
 const lines=createInterface({input:process.stdin,crlfDelay:Infinity});
 lines.on('line',line=>{try{const msg=JSON.parse(line),r=dispatch(msg);if(r)process.stdout.write(JSON.stringify(r)+'\n')}catch{process.stdout.write(JSON.stringify({jsonrpc:'2.0',id:null,error:{code:-32700,message:'Parse error'}})+'\n')}});
}else if(process.argv[2]){
 try{const name=process.argv[2],args=process.argv[3]?JSON.parse(process.argv[3]):{};console.log(JSON.stringify(call(name,args),null,2))}catch(e){console.error(e.message);process.exitCode=1}
}
