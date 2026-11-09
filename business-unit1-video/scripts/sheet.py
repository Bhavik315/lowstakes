import sys, json
from PIL import Image, ImageDraw
order = list(json.load(open('src/content/timeline.json'))['scenes'].keys())
fs = [f"out/stills/{k}@0.93.png" for k in order]
out = sys.argv[1]; start = int(sys.argv[2]); n = int(sys.argv[3])
fs = fs[start:start+n]
ims = [Image.open(f) for f in fs]
w, h = ims[0].size
cols = 2
grid = Image.new('RGB', (w*cols, h*((len(ims)+cols-1)//cols)), 'white')
d = ImageDraw.Draw(grid)
for i, (f, im) in enumerate(zip(fs, ims)):
    x, y = (i % cols)*w, (i//cols)*h
    grid.paste(im, (x, y))
    d.text((x+8, y+8), f.split('/')[-1], fill='red')
    d.line([(x, y+h-1), (x+w, y+h-1)], fill='white')
    d.line([(x+w-1, y), (x+w-1, y+h)], fill='white')
    # caption-safe line at y=940/1080
    d.line([(x, y+int(h*940/1080)), (x+w, y+int(h*940/1080))], fill=(255,0,0))
grid.save(out)
