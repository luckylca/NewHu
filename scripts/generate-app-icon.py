"""Render the code-owned NewHu page/N mark. Requires Pillow; no remote assets."""
from pathlib import Path
from PIL import Image, ImageDraw

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / 'assets/images'
BLUE = '#246BFE'
# Folded reading ribbon; all foreground geometry fits the adaptive safe circle.
POLYGONS = [([(316, 700), (316, 324), (408, 324), (616, 560), (616, 324), (708, 324), (708, 700), (616, 700), (408, 464), (408, 700)], '#FFFFFF'),
            ([(408, 324), (616, 560), (616, 700), (408, 464)], '#BDE9FF')]
svg = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1024 1024">\n<rect width="1024" height="1024" fill="'+BLUE+'"/>\n<g transform="translate(-179.2 -179.2) scale(1.35)">\n'
for points, color in POLYGONS:
    svg += '<polygon points="'+' '.join(f'{x},{y}' for x,y in points)+'" fill="'+color+'"/>\n'
(OUT / 'icon.svg').write_text(svg+'</g>\n</svg>\n')

def render(size, background=None, monochrome=False, scale=1):
    factor = 4
    canvas = Image.new('RGBA', (size*factor, size*factor), background or (0,0,0,0))
    draw = ImageDraw.Draw(canvas)
    for points, color in POLYGONS:
        draw.polygon([((512+(x-512)*scale)*size*factor/1024, (512+(y-512)*scale)*size*factor/1024) for x,y in points], fill='#FFFFFF' if monochrome else color)
    return canvas.resize((size,size), Image.Resampling.LANCZOS)

render(1024, BLUE, scale=1.35).convert('RGB').save(OUT/'icon.png')
render(1024).save(OUT/'android-icon-foreground.png')
Image.new('RGB',(1024,1024),BLUE).save(OUT/'android-icon-background.png')
render(1024, monochrome=True).save(OUT/'android-icon-monochrome.png')
render(64, BLUE, scale=1.6).save(OUT/'favicon.png')
# Existing native project is ignored by Git; update it for local Gradle builds too.
res = ROOT/'android/app/src/main/res'
if res.exists():
    for density, factor in [('mdpi',1),('hdpi',1.5),('xhdpi',2),('xxhdpi',3),('xxxhdpi',4)]:
        folder = res/f'mipmap-{density}'
        folder.mkdir(exist_ok=True)
        render(int(108*factor)).save(folder/'ic_launcher_foreground.webp',lossless=True)
        render(int(108*factor),monochrome=True).save(folder/'ic_launcher_monochrome.webp',lossless=True)
        Image.new('RGB',(int(108*factor),int(108*factor)),BLUE).save(folder/'ic_launcher_background.webp',lossless=True)
        icon=render(int(48*factor),BLUE,scale=1.35)
        icon.save(folder/'ic_launcher.webp',lossless=True)
        icon.save(folder/'ic_launcher_round.webp',lossless=True)
    colors=res/'values/colors.xml'
    colors.write_text(colors.read_text().replace('#E6F4FE',BLUE))
