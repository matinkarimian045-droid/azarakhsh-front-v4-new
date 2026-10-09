'use strict';
// Dependency-free build, equivalent to build.py. Does not install anything.
const fs=require('node:fs');const path=require('node:path');const root=path.resolve(__dirname,'..');
const files=['atlas-data.js','locale.js','config.js','icons.js','atlas.js','flight-physics.js','engine.js','commands.js','selftest.js','globe-land.js','globe.js','render.js','audio.js','ui.js','network.js','app.js'];
const read=f=>fs.readFileSync(path.join(root,'src',f),'utf8');
const html=read('shell.html').replace('/*__STYLE__*/',()=>read('style.css')).replace('/*__SCRIPTS__*/',()=>files.map(read).join('\n;\n'));
fs.writeFileSync(path.join(root,'index.html'),html);console.log('Built index.html:',Buffer.byteLength(html),'bytes');
