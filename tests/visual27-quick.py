from pathlib import Path
from playwright.sync_api import sync_playwright
ROOT=Path(__file__).resolve().parents[1]
OUT=ROOT/'tests'/'screenshots-2_7';OUT.mkdir(exist_ok=True)
errors=[]
with sync_playwright() as p:
    b=p.chromium.launch(executable_path='/usr/bin/chromium',headless=True,args=['--no-sandbox','--disable-dev-shm-usage'])
    page=b.new_page(viewport={'width':1280,'height':820})
    page.on('pageerror',lambda e: errors.append(str(e)))
    page.route('https://fonts.googleapis.com/**',lambda r:r.abort());page.route('https://fonts.gstatic.com/**',lambda r:r.abort())
    page.set_content((ROOT/'index.html').read_text(),wait_until='domcontentloaded');page.wait_for_function('window.Reborn');page.evaluate('Reborn.app.assetsReady')
    page.evaluate('''(()=>{const a=Reborn.app,g=new Reborn.Simulation({style:'realistic',intel:false,prep:0,startMoney:80000,nation:'iran',slots:[{nation:'israel',role:'enemy'}]},727);a.adopt(g);a.paused=true;g.updateAI=()=>{};const f=g.player,enemy=g.factions[1];for(const key of Object.keys(Reborn.RESEARCH)){f.done[key]=true;enemy.done[key]=true;}for(const key of Object.keys(f.stock)){f.stock[key]=20;enemy.stock[key]=20;}const add=(owner,k,u,v)=>{const ff=g.faction(owner),pt=Reborn.atlas.snap(ff,u,v,5);return g.addEntity(owner,k,pt,{ready:true});};const sam=add(f.id,'sam',.50,.54),rad=add(f.id,'radar',.52,.52),launcher=add(enemy.id,'launcher',.52,.50);sam.defCD=0;launcher.cooldowns.fill(0);g.chance=()=>1;g.rng.next=()=>.5;const city=g.alive(f.id,'city')[0];const r=g.launch(enemy.id,'ballistic',city);window.m=g.object(r.missile);window.sam=sam;a.renderer.focusFaction(f,true);window.shot=null;for(let k=0;k<360&&!window.shot;k++){g.tick(1/30);a.renderer.update(1/30);window.shot=g.interceptors.find(i=>i.type==='sam'&&!i.dead)||null;}if(window.shot){for(let k=0;k<12;k++){g.tick(1/30);a.renderer.update(1/30);}a.renderer.camera.focus(shot.x,shot.y-shot.z*.72,1.85,true);a.renderer.draw();}})()''')
    has=page.evaluate('!!window.shot')
    if has:
        page.screenshot(path=str(OUT/'sam-smoke-midflight.png'))
        page.evaluate('''(()=>{const a=Reborn.app,g=a.game;for(let k=0;k<200&&!shot.dead;k++){g.tick(1/30);a.renderer.update(1/30);}if(!shot.dead){shot.life=0;g.updateInterceptors(1/30);a.renderer.update(1/30);}for(let k=0;k<30;k++)a.renderer.update(1/30);a.renderer.draw();})()''')
        page.screenshot(path=str(OUT/'sam-smoke-after-end.png'))
    points=page.evaluate("window.shot?((Reborn.app.renderer.samSmokeTrails.get(shot.id)||{points:[]}).points.length):0")
    before=page.evaluate('Reborn.app.renderer.samSmokeTrails.size')
    page.evaluate('for(let k=0;k<75;k++)Reborn.app.renderer.update(1/30)')
    after=page.evaluate('Reborn.app.renderer.samSmokeTrails.size')
    state=page.evaluate("window.shot?({dead:shot.dead,life:shot.life,trail:(Reborn.app.renderer.samSmokeTrails.get(shot.id)||null)}):null")
    data={'shot':has,'smokeTrailsBefore3s':before,'smokeTrailsAfter3s':after,'points':points,'state':state,'errors':errors}
    print(data)
    if not has or points<2 or before<1 or after!=0 or errors: raise SystemExit(1)
    b.close()
