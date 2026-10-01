from pathlib import Path
from reportlab.pdfgen import canvas
from reportlab.lib.colors import HexColor
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
from reportlab.graphics.barcode.qr import QrCodeWidget
from reportlab.graphics.shapes import Drawing
from reportlab.graphics import renderPDF
from pypdf import PdfReader, PdfWriter
from pypdf.generic import RectangleObject
from PIL import Image

ROOT = Path(__file__).resolve().parents[2]
OUT = ROOT / 'output/pdf'
ASSET = ROOT / 'output/imagegen/aquamanager-aquascape-v2.png'
M = 72 / 25.4
H = 148
DARK = '#102C29'
CREAM = '#F5F5E9'
LIME = '#D6EF91'
MUTED = '#556C61'
for name, file in [('Regular','arial.ttf'), ('Bold','arialbd.ttf'), ('Serif','georgia.ttf')]:
    pdfmetrics.registerFont(TTFont(name, 'C:/Windows/Fonts/' + file))

def box(x,y,w,h,color,r=0):
    c.setFillColor(HexColor(color))
    if r: c.roundRect(x*M,(H-y-h)*M,w*M,h*M,r*M,stroke=0,fill=1)
    else: c.rect(x*M,(H-y-h)*M,w*M,h*M,stroke=0,fill=1)

def text(x,y,s,size=10,font='Regular',color=DARK):
    c.setFillColor(HexColor(color)); c.setFont(font,size)
    c.drawString(x*M,(H-y)*M,s)

def line(x,y,x2,y2,color,width=.5):
    c.setStrokeColor(HexColor(color)); c.setLineWidth(width)
    c.line(x*M,(H-y)*M,x2*M,(H-y2)*M)

def brand(dark=False):
    text(8,15,'AquaManager',13,'Bold',CREAM if dark else DARK)
    text(8,20,'LE COMPAGNON DE VOTRE AQUARIUM',5.6,'Regular',LIME if dark else MUTED)

def photograph():
    iw,ih=Image.open(ASSET).size
    scale=max(111*M/iw,154*M/ih)
    c.saveState()
    p=c.beginPath(); p.rect(-3*M,-3*M,111*M,154*M); c.clipPath(p,stroke=0)
    c.drawImage(str(ASSET),(105*M-iw*scale)/2,(148*M-ih*scale)/2,width=iw*scale,height=ih*scale)
    c.restoreState()
    # Transparent layout scrim keeps the print typography readable.
    c.saveState(); c.setFillColor(HexColor(DARK)); c.setFillAlpha(.40)
    c.rect(-3*M,-3*M,111*M,154*M,stroke=0,fill=1); c.restoreState()

def front():
    photograph(); brand(True)
    text(8,37,'Moins d’oubli.',25,'Bold',CREAM)
    text(8,49,'Plus de vie.',29,'Serif',LIME)
    text(8,61,'Votre aquarium mérite',10,'Regular',CREAM)
    text(8,66,'un suivi aussi vivant que lui.',10,'Regular',CREAM)
    box(-3,121,111,30,DARK)
    text(8,129,'MESURES  /  ENTRETIEN  /  RAPPELS',6.3,'Bold',LIME)
    text(8,139,'Commencez gratuitement.',11,'Bold',CREAM)
    text(8,144,'aquamanager.fr',8,'Regular',CREAM)
    # Small editorial arrow points toward the reverse side.
    line(88,139,96,139,LIME,1.1)
    line(93,136,96,139,LIME,1.1)
    line(93,142,96,139,LIME,1.1)

def qr(x,y,size):
    widget=QrCodeWidget('https://aquamanager.fr/',barLevel='M',barBorder=4)
    a,b,w,h=widget.getBounds()
    d=Drawing(size*M,size*M,transform=[size*M/(w-a),0,0,size*M/(h-b),0,0]); d.add(widget)
    renderPDF.draw(d,c,x*M,(H-y-size)*M)

def back():
    box(-3,-3,111,154,CREAM); brand()
    text(8,34,'Profitez de votre bac.',18,'Bold')
    text(8,44,'Simplifiez son suivi.',18,'Serif')
    rows=[
        ('01','Gardez le fil de vos mesures.','pH, température, nitrates… Retrouvez','vos relevés et leur historique.'),
        ('02','Prenez soin de votre aquarium.','Planifiez vos entretiens et choisissez','vos rappels par email.'),
        ('03','Apprenez à connaître vos espèces.','Consultez les fiches poissons et plantes','pour mieux comprendre leurs besoins.')
    ]
    for i,(n,title,a,b) in enumerate(rows):
        y=59+i*20
        text(8,y,n,10,'Serif',MUTED)
        text(20,y,title,9,'Bold')
        text(20,y+5.5,a,8,'Regular',MUTED)
        text(20,y+10,b,8,'Regular',MUTED)
        if i<2: line(20,y+14,97,y+14,'#D2DCC9',.45)
    box(-3,117,111,34,DARK)
    box(7,120,25,25,'#FFFFFF',1)
    qr(7,120,25)
    text(37,126,'Votre premier aquarium',10,'Bold',CREAM)
    text(37,131,'vous attend.',10,'Bold',CREAM)
    text(37,137,'Créez votre compte gratuit.',8,'Regular',LIME)
    text(37,141,'aquamanager.fr',8,'Bold',CREAM)
    text(37,144.5,'Sur mobile et ordinateur',6,'Regular','#BACCC1')

def make(name,bleed):
    global c
    b=3 if bleed else 0
    raw=ROOT/'tmp/pdfs'/name
    c=canvas.Canvas(str(raw),pagesize=((105+2*b)*M,(148+2*b)*M))
    c.setTitle('AquaManager - Flyer A6 - Nature'); c.setAuthor('AquaManager')
    for draw in [front,back]:
        c.saveState(); c.translate(b*M,b*M); draw(); c.restoreState(); c.showPage()
    c.save()
    reader=PdfReader(raw); writer=PdfWriter()
    for p in reader.pages:
        p.trimbox=RectangleObject([b*M,b*M,(105+b)*M,(148+b)*M])
        p.bleedbox=p.mediabox
        writer.add_page(p)
    writer.add_metadata(reader.metadata)
    with (OUT/name).open('wb') as f: writer.write(f)
    print(OUT/name)

make('AquaManager-flyer-A6-v2-nature.pdf',False)
make('AquaManager-flyer-A6-v2-nature-fond-perdu-3mm.pdf',True)
