"""Chromium CDP touch emulation. Test-only, not a runtime dependency."""
from pathlib import Path
from playwright.sync_api import sync_playwright
import json
ROOT=Path(__file__).resolve().parents[1];results=[];errors=[]
with sync_playwright() as p:
    browser=p.chromium.launch(executable_path='/usr/bin/chromium',headless=True,args=['--no-sandbox'])
    ctx=browser.new_context(viewport={'width':390,'height':844},is_mobile=True,has_touch=True,device_scale_factor=1)
    ctx.route('https://fonts.googleapis.com/**',lambda route:route.abort());ctx.route('https://fonts.gstatic.com/**',lambda route:route.abort())
    page=ctx.new_page();page.on('pageerror',lambda e:errors.append(str(e)))
    page.set_content((ROOT/'index.html').read_text(),wait_until='domcontentloaded')
    page.wait_for_timeout(700)
    page.evaluate('Reborn.app.newGame({nation:"iran",style:"arcade",intel:false,prep:180,slots:[{nation:"israel",role:"enemy"}]})')
    page.wait_for_timeout(400)
    page.evaluate('Reborn.app.paused=true;Reborn.app.renderer.camera.focus(0,0,.6,true)')
    def tap(selector):
        e=page.locator(selector);e.scroll_into_view_if_needed();b=e.bounding_box();page.touchscreen.tap(b['x']+b['width']/2,b['y']+b['height']/2)
    tap('[data-panel="build"]');page.wait_for_timeout(220)
    tap('#drawer [data-act="build"][data-kind="oilrig"]');page.wait_for_timeout(220)
    point=page.evaluate('(()=>{const a=Reborn.app,g=a.game,p=Reborn.atlas.findSpace(g.player,g.alive("f0"),g.rng,"oilrig");a.renderer.camera.focus(p.x,p.y,.7,true);return a.renderer.camera.project(p)})()')
    page.touchscreen.tap(point['x'],point['y']);page.wait_for_timeout(100)
    results.append({'name':'Touch construction: drawer selection plus canvas tap builds one site','ok':page.evaluate('Reborn.app.game.alive("f0","oilrig").length===1')})
    page.evaluate('Reborn.app.ui.cancelMode()')
    session=ctx.new_cdp_session(page)
    zoom=page.evaluate('Reborn.app.renderer.camera.tz')
    session.send('Input.dispatchTouchEvent',{'type':'touchStart','touchPoints':[{'id':0,'x':145,'y':390},{'id':1,'x':245,'y':390}]})
    for i in range(1,7):
        session.send('Input.dispatchTouchEvent',{'type':'touchMove','touchPoints':[{'id':0,'x':145-8*i,'y':390},{'id':1,'x':245+8*i,'y':390}]})
    session.send('Input.dispatchTouchEvent',{'type':'touchEnd','touchPoints':[]});page.wait_for_timeout(300)
    results.append({'name':'Two-finger pinch changes camera zoom without accidental construction','ok':page.evaluate('Reborn.app.renderer.camera.tz')>zoom and page.evaluate('Reborn.app.game.alive("f0","oilrig").length===1')})
    x=page.evaluate('Reborn.app.renderer.camera.tx')
    session.send('Input.dispatchTouchEvent',{'type':'touchStart','touchPoints':[{'id':0,'x':160,'y':440}]})
    session.send('Input.dispatchTouchEvent',{'type':'touchMove','touchPoints':[{'id':0,'x':210,'y':465}]})
    session.send('Input.dispatchTouchEvent',{'type':'touchEnd','touchPoints':[]});page.wait_for_timeout(150)
    results.append({'name':'One-finger drag pans the map and releases all pointer state','ok':page.evaluate('Reborn.app.renderer.camera.tx')!=x and page.evaluate('Reborn.app.pointers.size===0&&!Reborn.app.drag')})
    results.append({'name':'Touch session has no uncaught JavaScript error','ok':not errors,'detail':errors})
    report={'version':'2.2.0-stage1','method':'Chromium mobile/touch emulation through CDP. Built HTML injected. Not a physical-device test.','results':results,'passed':sum(r['ok'] for r in results),'failed':sum(not r['ok'] for r in results)}
    (ROOT/'tests/touch-results.json').write_text(json.dumps(report,indent=2))
    print(json.dumps(report,indent=2))
    browser.close()
    if report['failed']:raise SystemExit(1)
