"""Chromium UI/renderer checks with REAL serialized server snapshot fixtures.
No WebSocket is used here: this complements, not replaces, network-test.cjs.
"""
import asyncio,json,subprocess
from pathlib import Path
from playwright.async_api import async_playwright
ROOT=Path(__file__).resolve().parents[1]
OUT=ROOT/'tests/screenshots-2_2';OUT.mkdir(exist_ok=True)
fixture=json.loads(subprocess.check_output(['node',str(ROOT/'tests/make-snapshot-fixture.cjs')]))
checks=[];errors=[]
def check(name,value):
 checks.append({'name':name,'ok':bool(value)});print(('PASS ' if value else 'FAIL ')+name,flush=True)
async def main():
 async with async_playwright() as pw:
  b=await pw.chromium.launch(executable_path='/usr/bin/chromium',headless=True,args=['--no-sandbox','--disable-dev-shm-usage'])
  context=await b.new_context(viewport={'width':1440,'height':900})
  await context.route('https://fonts.googleapis.com/**',lambda r:r.abort());await context.route('https://fonts.gstatic.com/**',lambda r:r.abort())
  page=await context.new_page();page.on('pageerror',lambda e:errors.append(str(e)))
  await page.set_content((ROOT/'index.html').read_text(),wait_until='domcontentloaded');await page.wait_for_function('window.Reborn');await page.wait_for_timeout(700)
  # Track click routing only; real sound sample decoding is checked separately.
  await page.evaluate("(()=>{const a=Reborn.app,original=a.audio.play.bind(a.audio);window.clickCalls=[];a.audio.play=(type,...args)=>{if(type==='click')clickCalls.push(type);return original(type,...args)};})()")
  await page.click('.offline-entry');check('Actual menu button triggers exactly one click cue',await page.evaluate('clickCalls.length===1'))
  await page.click('#dialogFooter [data-act=closeDialog]');await page.evaluate("Reborn.app.newGame({nation:'iran',style:'arcade',intel:false,prep:0,slots:[{nation:'israel',role:'enemy'}]})")
  await page.wait_for_timeout(400);n=await page.evaluate('clickCalls.length');await page.mouse.click(650,550);await page.keyboard.press('8');await page.keyboard.press('Escape');check('Canvas and hotkeys do not produce button-click sounds',await page.evaluate(f'clickCalls.length==={n}'))
  check('Spaces contain bounded procedural stars',await page.evaluate('Reborn.app.renderer.stars.length===360'))
  # A snapshot belonging to Player 2 must drive all owner-sensitive panels.
  await page.evaluate("p=>{const n=Reborn.app.network;n.connected=true;n.room={code:'ABC123'};n.receive(p,true);}",fixture['publicViews'][1])
  check('Player 2 snapshot gives control of Player 2, not host',await page.evaluate("Reborn.app.game.player.id==='f1'&&Reborn.app.game.player.nation==='israel'"))
  check('Opponent is marked as enemy in Player 2 view',await page.evaluate("Reborn.app.game.faction('f0').role==='enemy'"))
  await page.wait_for_timeout(200);time0=await page.evaluate('Reborn.app.game.time');await page.wait_for_timeout(600);time1=await page.evaluate('Reborn.app.game.time');check('Client cannot advance gameplay when server snapshots stop',abs(time1-time0)<.14)
  await page.evaluate("Reborn.app.ui.panelOpen('arsenal')");await page.wait_for_timeout(350)
  check('Player 2 sees its own factory rather than host factory',await page.evaluate("[...document.querySelectorAll('.production-site [data-act=produce]')].every(e=>Reborn.app.game.object(e.dataset.id)?.owner==='f1')"))
  await page.evaluate("(()=>{const n=Reborn.app.network;window.sentCommands=[];n.command=async(type,args)=>{sentCommands.push({type,args});return{ok:true}};})()")
  before=await page.evaluate('Reborn.app.game.player.stock.ballistic');await page.click('[data-act=produce][data-count="1"]');check('Online production sends command, never gives local ammunition',await page.evaluate(f"sentCommands.at(-1).type==='produce'&&Reborn.app.game.player.stock.ballistic==={before}"))
  await page.evaluate('Reborn.app.ui.closeDrawer()');await page.keyboard.press('8');await page.wait_for_timeout(350);check('Online player has the same launch button picker',await page.locator('#weaponPicker').is_visible())
  await page.keyboard.press('Escape');await page.keyboard.press('p');await page.wait_for_timeout(250);check('Online pause menu explains that match clock remains shared',await page.evaluate("document.getElementById('dialogContent').textContent.includes(tr('onlinePauseHint'))"));await page.click('#dialogFooter [data-act=closeDialog]')
  await page.evaluate('p=>Reborn.app.network.receive(p,false)',fixture['privateView']);await page.wait_for_timeout(400)
  check('Masked remote missile can be rendered without private source/target',await page.evaluate("Reborn.app.game.missiles.filter(m=>m.remoteTrack).every(m=>Number.isFinite(m.x)&&!('sx'in m)&&!('tx'in m))") and not errors)
  await page.screenshot(path=str(OUT/'09-player-two-view.png'))
  old=await page.evaluate('Reborn.app.network.revision');await page.evaluate('p=>Reborn.app.network.receive(p,false)',fixture['publicViews'][1]);check('Stale snapshots are rejected',await page.evaluate(f'Reborn.app.network.revision==={old}'))
  await page.evaluate("p=>Reborn.app.network.receive({...p,room:'FFFFFF',revision:9999},false)",fixture['privateView']);check('Foreign room snapshots cannot replace the current match',await page.evaluate(f'Reborn.app.network.revision==={old}'))
  await page.evaluate("Reborn.app.network.connected=false;Reborn.app.network.status()");check('Disconnect banner appears and local presentation freezes',await page.evaluate("!document.getElementById('networkStatus').classList.contains('hidden')&&Reborn.app.actualSpeed()===0"))
  await page.evaluate("r=>{const n=Reborn.app.network;n.active=false;n.connected=true;n.room=r;n.playerId='p1';n.lobby();}",fixture['room']);await page.wait_for_timeout(350)
  check('Room lobby displays two seats and six-character invite code',await page.locator('.room-player').count()==2 and await page.evaluate("document.querySelector('.room-code').textContent.includes('ABC123')"))
  check('Host start stays disabled until BOTH seats are ready',await page.locator('[data-act=netStart]').is_disabled())
  await page.screenshot(path=str(OUT/'10-room-lobby-fixture.png'))
  await page.set_viewport_size({'width':360,'height':800});await page.wait_for_timeout(350);check('Room lobby fits 360px viewport without horizontal overflow',await page.evaluate('document.documentElement.scrollWidth===innerWidth && document.getElementById("dialogContent").scrollWidth<=document.getElementById("dialogContent").clientWidth+1'))
  await page.screenshot(path=str(OUT/'mobile-360-room-fixture.png'))
  await page.evaluate("p=>{const a=Reborn.app;a.network.reset();a.goMenu();a.network.receive({...p,revision:9999},false);}",fixture['privateView']);check('Late snapshots cannot restart gameplay after leaving a room',await page.evaluate("!Reborn.app.network.active&&Reborn.app.screen==='menu'"))
  check('No unhandled errors in offline buttons, Player 2 view and room UI',not errors)
  await b.close()
 report={'suite':'Browser client 2.2: UI + server snapshot fixture, NOT real Socket.IO','passed':sum(c['ok'] for c in checks),'failed':sum(not c['ok'] for c in checks),'errors':errors,'results':checks}
 (ROOT/'tests/client22-results.json').write_text(json.dumps(report,indent=2));print(json.dumps({'passed':report['passed'],'failed':report['failed'],'errors':errors}));return report['failed']
if __name__=='__main__':raise SystemExit(asyncio.run(main()))
