#!/usr/bin/env python3
"""Optional authoring tool: rebuild embedded map previews and independent land masks.
Requirements: Pillow, NumPy, SciPy. Not required to play or run build.py.
Place map PNGs in music/, then run this tool, then python build.py.
Colors are used to distinguish blue water from land; review generated masks when
introducing dramatically different palettes or new coastlines.
"""
from pathlib import Path
import base64,io,json
try:
    from PIL import Image
    import numpy as np
    from scipy import ndimage
except ImportError as exc:
    raise SystemExit('Authoring only: install Pillow, numpy and scipy first.') from exc
ROOT=Path(__file__).resolve().parents[1]
FILES={'iran':'iran.png','russia':'Russia.png','china':'China.png','israel':'Israel.png','usa':'Usa.png','france':'France.png','uk':'England.png'}
data={}
for nation,name in FILES.items():
    path=ROOT/'music'/name
    if not path.is_file():raise SystemExit('Missing map: '+str(path))
    im=Image.open(path).convert('RGBA');a=np.array(im)
    dark=np.max(a[:,:,:3],axis=2)<32
    labels,_=ndimage.label(dark)
    outside=np.unique(np.r_[labels[0,:],labels[-1,:],labels[:,0],labels[:,-1]])
    a[np.isin(labels,outside[outside!=0]),3]=0
    im=Image.fromarray(a);box=im.getbbox()
    if box is None:raise SystemExit('Empty map: '+str(path))
    im=im.crop(box);im.save(path,optimize=True)
    thumb=im.copy();thumb.thumbnail((640,640),Image.Resampling.LANCZOS)
    buff=io.BytesIO();thumb.save(buff,format='WEBP',quality=78,method=6)
    dims=(max(1,round(im.width/max(im.size)*144)),max(1,round(im.height/max(im.size)*144)))
    small=np.array(im.resize(dims,Image.Resampling.LANCZOS));r=small[:,:,0].astype(float);g=small[:,:,1].astype(float);b=small[:,:,2].astype(float)
    water=(b>r*1.12)&(g>r*1.08)&(b>35)
    land=ndimage.binary_opening((small[:,:,3]>200)&~water&((r+g+b)>90),iterations=1)
    if land.sum()<100:raise SystemExit('Map palette produced too little land: '+name)
    packed=np.packbits(land.flatten().astype(np.uint8))
    data[nation]={'file':'music/'+name,'aspect':im.width/im.height,'width':dims[0],'height':dims[1],'mask':base64.b64encode(packed.tobytes()).decode(),'image':'data:image/webp;base64,'+base64.b64encode(buff.getvalue()).decode()}
    preview=Image.fromarray(np.where(land,255,0).astype(np.uint8))
    preview.save(ROOT/'tools'/('land-check-'+nation+'.png'))
    print(name,im.size,'valid land cells:',int(land.sum()))
(ROOT/'src'/'atlas-data.js').write_text('/* Project terrain art, embedded fallback, packed land masks. */\nconst ATLAS_DATA = '+json.dumps(data,separators=(',',':'))+';\n',encoding='utf-8')
print('Review tools/land-check-*.png; then run python build.py.')
