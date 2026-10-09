'use strict';
// Load our trusted, DOM-free source in one lexical realm. This is code sharing,
// not a security sandbox: user data is never evaluated as JavaScript.
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
const root=path.resolve(__dirname,'..');
const files=['atlas-data.js','locale.js','config.js','atlas.js','flight-physics.js','engine.js','commands.js'];
const context=vm.createContext({console,atob,performance,Uint8Array,Map,Set});
vm.runInContext(files.map(f=>fs.readFileSync(path.join(root,'src',f),'utf8')).join('\n;\n')+
 '\n;globalThis.AF={Simulation,GameCommands,Trajectory,InterceptorPath,FlightPhysics,atlas,CONFIG,WEAPONS,STRUCTURES,RESEARCH,NATIONS,DEFENSE,SAM_INTERCEPT_CHANCE,TRUCE_DURATION,tr};',context,{timeout:15000});
module.exports=context.AF;
