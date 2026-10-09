'use strict';
const express=require('express');
const http=require('node:http');
const path=require('node:path');
const {Server}=require('socket.io');
const {RoomService}=require('./server/rooms.cjs');
function createApp(options={}){
 const app=express();app.disable('x-powered-by');
 app.use((req,res,next)=>{res.setHeader('X-Content-Type-Options','nosniff');res.setHeader('Referrer-Policy','same-origin');next();});
 app.get('/health',(_req,res)=>res.json({ok:true,version:'2.2.0-stage1'}));
 app.get('/',(_req,res)=>res.sendFile(path.join(__dirname,'index.html')));
 app.get('/index.html',(_req,res)=>res.sendFile(path.join(__dirname,'index.html')));
 app.use('/music',express.static(path.join(__dirname,'music'),{dotfiles:'deny',maxAge:'1h',index:false}));
 app.use((_req,res)=>res.status(404).json({ok:false,error:'notFound'}));
 const server=http.createServer(app),allowed=(process.env.ALLOWED_ORIGINS||'').split(',').map(s=>s.trim()).filter(Boolean);
 const originOK=(origin,req)=>{if(!origin)return true;try{const u=new URL(origin);return u.host===req.headers.host||allowed.includes(origin);}catch{return false;}};
 const io=new Server(server,{maxHttpBufferSize:16384,pingTimeout:20000,pingInterval:15000,allowRequest:(req,done)=>done(null,originOK(req.headers.origin,req))});
 const rooms=new RoomService(io,options);
 return {app,server,io,rooms,close:async()=>{rooms.stop();await new Promise(resolve=>io.close(resolve));if(server.listening)await new Promise(resolve=>server.close(resolve));}};
}
if(require.main===module){const runtime=createApp(),port=Number(process.env.PORT)||3000,host=process.env.HOST||'0.0.0.0';runtime.server.on('error',err=>{console.error('Server failed:',err.message);process.exitCode=1;runtime.rooms.stop();});runtime.server.listen(port,host,()=>console.log(`AF Stage 1 listening on http://localhost:${port} (LAN: use this machine's local IP)`));for(const signal of ['SIGTERM','SIGINT'])process.on(signal,async()=>{await runtime.close();process.exit(0);});}
module.exports={createApp};
