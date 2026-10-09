#!/usr/bin/env python3
"""Build the offline HTML from readable source files. Standard library only."""
from pathlib import Path
ROOT=Path(__file__).resolve().parent
FILES=['atlas-data.js','locale.js','config.js','icons.js','atlas.js','flight-physics.js','engine.js','commands.js','selftest.js','globe-land.js','globe.js','render.js','audio.js','ui.js','network.js','app.js']
html=(ROOT/'src/shell.html').read_text(encoding='utf-8')
css=(ROOT/'src/style.css').read_text(encoding='utf-8')
js='\n;\n'.join((ROOT/'src'/f).read_text(encoding='utf-8') for f in FILES)
html=html.replace('/*__STYLE__*/',css).replace('/*__SCRIPTS__*/',js)
(ROOT/'index.html').write_text(html,encoding='utf-8')
print('Built',ROOT/'index.html',len(html.encode('utf-8')),'bytes')
