"""Real renderer/engine integration scenarios, using funded test fixtures.
This is not a performance benchmark or a real-world physics validation.
"""
import json,sys
from pathlib import Path
from playwright.sync_api import sync_playwright
ROOT=Path(__file__).resolve().parents[1]
OUT=ROOT/'tests'/'screenshots-2_2';OUT.mkdir(exist_ok=True)
checks=[];errors=[]
def check(name,ok,detail=None):
    checks.append({'name':name,'ok':bool(ok),'detail':detail});print(('PASS ' if ok else 'FAIL ')+name,flush=True)
with sync_playwright() as p:
    browser=p.chromium.launch(executable_path='/usr/bin/chromium',headless=True,args=['--no-sandbox','--disable-dev-shm-usage'])
    ctx=browser.new_context(viewport={'width':1440,'height':900},device_scale_factor=1)
    ctx.route('https://fonts.googleapis.com/**',lambda r:r.abort());ctx.route('https://fonts.gstatic.com/**',lambda r:r.abort())
    page=ctx.new_page();page.on('pageerror',lambda e:errors.append(str(e)))
    page.set_content((ROOT/'index.html').read_text(),wait_until='domcontentloaded');page.wait_for_function('window.Reborn');page.evaluate('Reborn.app.assetsReady')
    page.evaluate('''(()=>{const a=Reborn.app,g=new Reborn.Simulation({style:'realistic',intel:false,prep:0,startMoney:60000,nation:'iran',slots:[{nation:'israel',role:'enemy'}]},8147);a.adopt(g);a.paused=true;g.updateAI=()=>{};
      const place=(f,k)=>{const p=Reborn.atlas.findSpace(f,g.alive(f.id),g.rng,k);if(!p)throw Error('No fixture land for '+k);return g.addEntity(f.id,k,p,{ready:true});};
      for(const f of g.factions){f.res.oil=1000;for(const key of Object.keys(Reborn.RESEARCH))f.done[key]=true;for(const key of Object.keys(f.stock))f.stock[key]=20;for(const k of ['oilrig','factory','radar','aaa','sam','launcher','airbase','sam','aaa','launcher'])place(f,k);}
      g.updateEconomy(.01);a.renderer.focusFaction(g.player,true);a.ui.update(true);window.eventsQA=[];g.on(e=>eventsQA.push(e));window.tickQA=(count)=>{a.paused=false;for(let i=0;i<count;i++){g.tick(1/30);a.renderer.update(1/30);a.renderer.draw();}a.paused=true;a.ui.update(true);};
      const target=g.alive(g.player.id,'city')[0],enemy=g.factions[1];g.launch(enemy.id,'ballistic',target);window.missileQA=g.missiles.at(-1);a.renderer.camera.focus(missileQA.x,missileQA.y-.72*missileQA.z,1.6,true);
    })()''')
    page.evaluate('tickQA(45);Reborn.app.renderer.camera.focus(missileQA.x,missileQA.y-.72*missileQA.z,1.65,true);Reborn.app.renderer.draw()');page.screenshot(path=str(OUT/'09-boost-phase.png'))
    check('Boost renders with attached body and accumulated exhaust positions',page.evaluate("missileQA.z>20&&!missileQA.separated&&missileQA.trail.length>4"))
    page.evaluate('tickQA(Math.ceil((missileQA.duration*.51-missileQA.age)*30));Reborn.app.renderer.camera.focus(missileQA.x,missileQA.y-.72*missileQA.z,1.65,true);Reborn.app.renderer.draw()');page.screenshot(path=str(OUT/'10-separated-warhead.png'))
    check('Warhead separation is rendered with independent falling booster',page.evaluate("missileQA.separated&&Reborn.app.game.boosters.some(b=>b.life>0)"))
    page.evaluate('tickQA(Math.ceil((missileQA.duration*.91-missileQA.age)*30));Reborn.app.renderer.focusFaction(Reborn.app.game.player,true);Reborn.app.renderer.draw()');page.screenshot(path=str(OUT/'11-terminal-defense.png'))
    check('Incoming warhead enters descending terminal phase',page.evaluate("Reborn.Trajectory.phase(missileQA)==='terminal'"))
    # Prepare a short, active local defense scene using valid land points.
    page.evaluate('''(()=>{const a=Reborn.app,g=a.game,f=g.player,target=g.alive(f.id,'city')[1],enemy=g.factions[1];
      const sam=g.operational(f.id,'sam')[0],aa=g.operational(f.id,'aaa')[0],radar=g.operational(f.id,'radar')[0];
      for(const e of [sam,aa,radar]){const p=Reborn.atlas.snap(f,.54,.50,10);e.x=p.x+ (e.kind==='sam'?0:12);e.y=p.y+(e.kind==='aaa'?18:0);e.defCD=0;}
      const base=g.operational(f.id,'launcher')[0];base.cooldowns.fill(0);g.launch(f.id,'heavy',g.alive(enemy.id,'city')[0]);
      g.launchAircraft(f.id,'patrol');g.launchAircraft(enemy.id,'strike',target);
      const launcher=g.operational(enemy.id,'launcher')[0];for(const type of ['cruise','drone','rain','hyper']){launcher.cooldowns.fill(0);const result=g.launch(enemy.id,type,{x:aa.x,y:aa.y});if(result.ok){const m=g.object(result.missile);m.age=m.duration*.64;Object.assign(m,Reborn.Trajectory.at(m,.64));m.prev={x:m.x,y:m.y,z:m.z};}}
      a.renderer.focusFaction(f,true);
    })()''')
    page.evaluate('tickQA(180)');page.screenshot(path=str(OUT/'12-live-field.png'))
    check('Live scene includes fighter and missile engine rendering without faults',page.evaluate("Reborn.app.game.aircraft.length>0&&Reborn.app.renderer.frame>300&&Reborn.app.faults.length===0"))
    page.evaluate('tickQA(300)');page.screenshot(path=str(OUT/'13-aftermath.png'))
    check('Battle produces real damage or interception events',page.evaluate("eventsQA.some(e=>['MISSILE_IMPACT','MISSILE_INTERCEPTED'].includes(e.type))"))
    check('Battle produces cannon or SAM launches',page.evaluate("eventsQA.some(e=>e.type==='INTERCEPTOR_LAUNCHED'&&['aaa','sam'].includes(e.payloadType))"))
    check('Missed projectiles self-destruct instead of being silently erased',page.evaluate("eventsQA.some(e=>e.type==='SELF_DESTRUCT')"))
    check('Rendered effect count respects configured quality cap',page.evaluate("Reborn.app.renderer.fx.length<=Reborn.CONFIG.quality[Reborn.app.settings.quality].particles"))
    page.evaluate('tickQA(1200)')
    check('Sixty-plus seconds of engine/render integration remains finite',page.evaluate("Reborn.app.game.time>60&&[...Reborn.app.game.missiles,...Reborn.app.game.interceptors,...Reborn.app.game.aircraft].every(e=>[e.x,e.y,e.z||0].every(Number.isFinite))"))
    page.set_viewport_size({'width':360,'height':800});page.wait_for_timeout(120)
    check('All ten mobile quick commands fit without horizontal scrolling',page.evaluate("(()=>{const dock=document.getElementById('quickDock'),r=dock.getBoundingClientRect();return dock.scrollWidth===dock.clientWidth&&[...dock.querySelectorAll('button')].every(b=>{const q=b.getBoundingClientRect();return q.x>=0&&q.right<=innerWidth&&q.top>=0&&q.bottom<=innerHeight;});})()"))
    page.evaluate('Reborn.app.ui.toast("test");Reborn.app.goMenu()');check('Returning to menu clears battlefield notifications',page.evaluate("document.getElementById('toasts').children.length===0"))
    check('No uncaught JavaScript error in full battle render scenario',not errors,errors)
    browser.close()
report={'version':'2.7.0-defense-visual-tuning','scope':'Seeded funded renderer-integration fixtures. Exact compiled HTML via set_content, Chromium headless. No audio files supplied; not a frame-rate benchmark.','passed':sum(c['ok'] for c in checks),'failed':sum(not c['ok'] for c in checks),'errors':errors,'results':checks}
(ROOT/'tests'/'visual-battle-results.json').write_text(json.dumps(report,indent=2));print(json.dumps({k:report[k] for k in ['passed','failed','errors']}));sys.exit(report['failed'])
