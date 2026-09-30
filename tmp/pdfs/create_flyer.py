from reportlab.pdfgen import canvas
from reportlab.lib.colors import HexColor, Color
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
from reportlab.graphics.barcode.qr import QrCodeWidget
from reportlab.graphics.shapes import Drawing
from reportlab.graphics import renderPDF
from pypdf import PdfReader, PdfWriter
from pypdf.generic import RectangleObject
from pathlib import Path
import math
ROOT=Path(__file__).resolve().parents[2]
OUT=ROOT/'output/pdf'
M=72/25.4
W,H=105,148
INK='#143E3D'; MINT='#C2E8CF'; CREAM='#F6F5EB'; GREEN='#7EC5A0'; MUTED='#577470'; CORAL='#F39472'
for n,f in [('R','arial.ttf'),('B','arialbd.ttf')]:pdfmetrics.registerFont(TTFont(n,'C:/Windows/Fonts/'+f))
def color(c):return HexColor(c)
def rect(x,y,w,h,fill,r=0):
 c.setFillColor(color(fill));c.setStrokeColor(color(fill))
 if r:c.roundRect(x*M,(H-y-h)*M,w*M,h*M,r*M,stroke=0,fill=1)
 else:c.rect(x*M,(H-y-h)*M,w*M,h*M,stroke=0,fill=1)
def text(x,y,s,size=10,font='R',fill=INK):
 c.setFont(font,size);c.setFillColor(color(fill));c.drawString(x*M,(H-y)*M,s)
def line(x1,y1,x2,y2,fill=GREEN,width=1):
 c.setStrokeColor(color(fill));c.setLineWidth(width);c.line(x1*M,(H-y1)*M,x2*M,(H-y2)*M)
def ellipse(x,y,w,h,fill):
 c.setFillColor(color(fill));c.ellipse(x*M,(H-y-h)*M,(x+w)*M,(H-y)*M,fill=1,stroke=0)
def path(points,fill,stroke=None,width=1):
 p=c.beginPath();p.moveTo(points[0][0]*M,(H-points[0][1])*M)
 for x,y in points[1:]:p.lineTo(x*M,(H-y)*M)
 p.close();c.setFillColor(color(fill));c.setStrokeColor(color(stroke or fill));c.setLineWidth(width);c.drawPath(p,fill=1,stroke=bool(stroke))
def wave(x,y,w,col):
 p=c.beginPath();p.moveTo(x*M,(H-y)*M);p.curveTo((x+w*.33)*M,(H-y+2)*M,(x+w*.66)*M,(H-y-2)*M,(x+w)*M,(H-y)*M)
 c.setLineWidth(.8);c.setStrokeColor(color(col));c.drawPath(p)
def brand(dark=False):
 col=MINT if dark else INK
 for yy in [0,2,4]:wave(9,10+yy,8,col)
 text(20,14,'AquaManager',13,'B',col)
def leaf(x,y,dx,dy,fill):
 p=c.beginPath();p.moveTo(x*M,(H-y)*M)
 p.curveTo((x+dx-5)*M,(H-y-dy/2)*M,(x+dx-4)*M,(H-y-dy)*M,(x+dx)*M,(H-y-dy)*M)
 p.curveTo((x+dx+6)*M,(H-y-dy/2)*M,(x+4)*M,(H-y)*M,x*M,(H-y)*M)
 c.setFillColor(color(fill));c.drawPath(p,fill=1,stroke=0)
def fish(x,y,scale=1):
 ellipse(x,y,14*scale,6*scale,MINT)
 path([(x+13*scale,y+3*scale),(x+19*scale,y-.8*scale),(x+19*scale,y+6.8*scale)],MINT)
 ellipse(x+3*scale,y+2*scale,.8*scale,.8*scale,INK)
 line(x+6*scale,y+1*scale,x+5.6*scale,y+5*scale,GREEN,.5)
def shrimp(x,y):
 # Curved segmented body, rostrum, fan tail, legs and long antennae.
 for i,(dx,dy,rr) in enumerate([(0,0,2.8),(3,0,2.7),(5.7,1,2.5),(7.6,2.5,2.2),(8.5,4.2,1.7)]):
  ellipse(x+dx,y+dy,rr*2,rr*1.4,CORAL)
 path([(x+10,y+5),(x+14,y+5),(x+12,y+8)],CORAL)
 line(x+1,y+1,x-4,y-1,CORAL,.8)
 for k in range(4):line(x+2+k*1.8,y+3.3,x+k*1.7,y+6.3,CORAL,.65)
 line(x+1,y+1,x-6,y-4,CORAL,.6);line(x+1,y+1,x-5,y-2,CORAL,.6)
 ellipse(x+.4,y+.8,.8,.8,INK)
def aquarium():
 rect(9,78,87,39,'#215653',5)
 for x,yy,dx in [(17,114,1),(21,115,-2),(81,115,-1),(87,115,1)]:
  line(x,yy,x+dx,86,'#78AD84',1)
  for n in range(4):
   leaf(x+dx*n/4,yy-n*6,(-1 if n%2 else 1)*5,-9, '#74A781' if n%2 else '#94C9A0')
 ellipse(28,111,24,8,'#39746B');ellipse(59,113,18,6,'#39746B')
 fish(34,86,.85);fish(58,95,.65);shrimp(37,105)
 for x,y,r in [(72,83,1),(75,87,.65),(30,96,.6),(69,102,.8)]:
  c.setStrokeColor(color('#82B7A6'));c.setLineWidth(.6);c.circle(x*M,(H-y)*M,r*M,fill=0,stroke=1)
 wave(13,81,78,'#85B7A5')
 # A compact measurement tag connects the illustration to the product.
 rect(57,72,39,12,CREAM,3);text(61,77,'MON AQUARIUM',5.8,'B',MUTED);text(61,81.5,'pH  6,8     24 °C',8,'B',INK)
def qr(x,y,size=26):
 widget=QrCodeWidget('https://aquamanager.fr/',barLevel='M',barBorder=4)
 bx,by,bw,bh=widget.getBounds();d=Drawing(size*M,size*M,transform=[size*M/(bw-bx),0,0,size*M/(bh-by),0,0]);d.add(widget)
 renderPDF.draw(d,c,x*M,(H-y-size)*M)

INK='#233C43'; MINT='#65B97C'; CREAM='#FFFFFF'; GREEN='#65B97C'; MUTED='#637A80'
LOGO='G:/Mon Drive/XXX-Perso/Projet/AquaManager/Projet_final_brouillon/Capture d’écran 2026-01-27 213451.png'
def logo(x,y,w):
 # Place the supplied original inside a clipping frame, without redrawing it.
 source_w,source_h=568,379
 cropx,cropy,cropw,croph=108,115,347,111
 k=w/cropw;h=croph*k
 c.saveState();p=c.beginPath();p.rect(x*M,(H-y-h)*M,w*M,h*M);c.clipPath(p,stroke=0)
 c.drawImage(LOGO,(x-cropx*k)*M,(H-y-(source_h-cropy)*k)*M,width=source_w*k*M,height=source_h*k*M)
 c.restoreState()
def gradient(x,y,w,h,r=0):
 c.saveState();p=c.beginPath()
 if r:
  # Rounded clipping for the same button style as the website.
  p.roundRect(x*M,(H-y-h)*M,w*M,h*M,r*M)
 else:p.rect(x*M,(H-y-h)*M,w*M,h*M)
 c.clipPath(p,stroke=0)
 c.linearGradient(x*M,0,(x+w)*M,0,[color('#5AA6D5'),color('#6BB650')])
 c.restoreState()
def base():
 rect(-3,-3,111,154,'#FFFFFF')
 rect(-3,63,111,88,'#F0F8F7')
 gradient(-3,-3,111,5)
def dashboard():
 rect(10,77,87,40,'#DFEEEA',4)
 rect(9,75.5,87,40,'#FFFFFF',4)
 gradient(9,75.5,87,8,3)
 text(13,81,'Mon aquarium',8,'B','#FFFFFF')
 text(13,89,'MES DERNIÈRES MESURES',5.8,'B',MUTED)
 for x,title,v in [(13,'pH','6,8'),(39,'Température','24 °C'),(65,'Nitrates','10 mg/L')]:
  rect(x,91,23,12,'#F0F7FA',2)
  text(x+2,95,title,5.8,'R',MUTED);text(x+2,100,v,9,'B',INK)
 ellipse(13,107,3.5,3.5,'#E5F4E8')
 line(13.8,108.6,14.5,109.3,'#62A966',.7);line(14.5,109.3,15.7,107.9,'#62A966',.7)
 text(19,110,'Entretien planifié. Esprit tranquille.',7,'R',INK)
 text(71,114,'Aperçu illustratif',4.5,'R',MUTED)
def front():
 base();logo(24,8,57)
 text(9,34,'POISSONS  /  CREVETTES  /  PLANTES',7,'B','#579783')
 text(9,45,'Le suivi de votre',22,'B')
 text(9,55,'aquarium, simplifié.',22,'B')
 text(9,65,'Mesures, entretien, rappels :',10,'R')
 text(9,71,'tout votre suivi au même endroit.',10,'R')
 dashboard()
 gradient(9,123,87,11,3)
 text(14,130.1,'Créez votre compte gratuit',12,'B','#FFFFFF')
 text(9,143,'aquamanager.fr',13,'B')
 text(68,143,'QR code au verso',7,'R',MUTED)
def back():
 base();logo(9,8,43)
 text(9,34,'De bons réflexes,',19,'B')
 text(9,43,'un aquarium bien suivi.',19,'B')
 rows=[('1','Suivez vos paramètres.',['Enregistrez vos mesures d’eau','et consultez leur historique.']),('2','Organisez l’entretien.',['Planifiez vos tâches et choisissez','vos rappels par email.']),('3','Découvrez les espèces.',['Retrouvez les besoins des poissons','et des plantes dans leurs fiches.'])]
 for i,(num,title,body) in enumerate(rows):
  y=56+i*17
  ellipse(9,y-3.7,7,7,'#E0F1F7' if i!=1 else '#E5F3E7')
  text(11.3,y+1.3,num,9,'B','#5B9EBA' if i!=1 else '#64A55D')
  text(20,y,title,10.5,'B');text(20,y+5,body[0],8.5);text(20,y+9.5,body[1],8.5)
 text(9,108,'Avec Premium : un bilan IA lié à votre aquarium.',7.5,'R',MUTED)
 gradient(-3,114,111,2)
 rect(-3,116,111,35,'#FFFFFF')
 qr(7,118,27)
 text(39,124,'Essayez AquaManager',11,'B')
 text(39,130,'gratuitement.',11,'B','#64A954')
 text(39,136,'aquamanager.fr',10,'B')
 text(39,142,'Sur mobile et ordinateur.',7.5,'R',MUTED)
def make(name,bleed):
 global c
 b=3 if bleed else 0
 raw=ROOT/'tmp/pdfs'/name
 c=canvas.Canvas(str(raw),pagesize=((105+2*b)*M,(148+2*b)*M),pageCompression=1)
 c.setTitle('AquaManager - Flyer A6 recto verso');c.setAuthor('AquaManager');c.setSubject('Publicité AquaManager - aquamanager.fr')
 for draw in [front,back]:
  c.saveState();c.translate(b*M,b*M);draw();c.restoreState();c.showPage()
 c.save()
 reader=PdfReader(raw);writer=PdfWriter()
 for page in reader.pages:
  page.trimbox=RectangleObject([b*M,b*M,(b+105)*M,(b+148)*M]);page.bleedbox=page.mediabox
  writer.add_page(page)
 writer.add_metadata(reader.metadata)
 with (OUT/name).open('wb') as f:writer.write(f)
 for page in PdfReader(OUT/name).pages:assert 'aquamanager.fr' in page.extract_text()
 print(OUT/name)
make('AquaManager-flyer-A6-recto-verso.pdf',False)
make('AquaManager-flyer-A6-imprimeur-fond-perdu-3mm.pdf',True)
