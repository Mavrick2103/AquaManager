from pathlib import Path

# Reuse the page sizing, typography, QR and print-box helpers.
source = Path(__file__).with_name('create_flyer_v2.py').read_text(encoding='utf-8')
source = source.replace('Flyer A6 - Nature', 'Flyer A6 - Bleu et vert')
exec(compile(source[:source.index("make('AquaManager-flyer")], __file__, 'exec'))

BLUE = '#009FE3'
GREEN = '#39B54A'
INK = '#233C43'
GRAY = '#60747B'
LOGO = ROOT / 'tmp/pdfs/logo-original.png'
LOGO.write_bytes(PdfReader(OUT/'AquaManager-flyer-A6-recto-verso.pdf').pages[0].images[0].data)

def gradient(x,y,w,h):
    c.saveState()
    p=c.beginPath(); p.rect(x*M,(H-y-h)*M,w*M,h*M); c.clipPath(p,stroke=0)
    c.linearGradient(x*M,0,(x+w)*M,0,[HexColor(BLUE),HexColor(GREEN)])
    c.restoreState()

def logo(x,y,w):
    k=w/347; h=111*k
    c.saveState()
    p=c.beginPath(); p.rect(x*M,(H-y-h)*M,w*M,h*M); c.clipPath(p,stroke=0)
    c.drawImage(str(LOGO),(x-108*k)*M,(H-y-(379-115)*k)*M,width=568*k*M,height=379*k*M)
    c.restoreState()

def base():
    box(-3,-3,111,154,'#FFFFFF')
    gradient(-3,-3,111,5)

def photo(x,y,w,h):
    iw,ih=Image.open(ASSET).size
    scale=max(w*M/iw,h*M/ih)
    c.saveState()
    p=c.beginPath(); p.roundRect(x*M,(H-y-h)*M,w*M,h*M,3*M); c.clipPath(p,stroke=0)
    c.drawImage(str(ASSET),x*M+(w*M-iw*scale)/2,(H-y-h)*M+(h*M-ih*scale)*.43,width=iw*scale,height=ih*scale)
    c.restoreState()

def front():
    base(); logo(8,9,46)
    text(8,33,'VOTRE PASSION, BIEN ACCOMPAGNÉE.',6.8,'Bold',GRAY)
    text(8,45,'Moins d’oubli.',25,'Bold',BLUE)
    text(8,56,'Plus de vie.',25,'Bold',GREEN)
    text(8,66,'Tout le suivi de votre aquarium,',9.5,'Regular',INK)
    text(8,71,'simplement.',9.5,'Regular',INK)
    photo(8,77,89,34)
    text(8,118,'MESURES  /  ENTRETIEN  /  RAPPELS',7,'Bold',BLUE)
    gradient(8,124,89,13)
    text(13,132.5,'Commencez gratuitement',12,'Bold','#FFFFFF')
    text(8,144,'aquamanager.fr',9,'Bold',INK)
    text(72,144,'QR code au verso',6.5,'Regular',GRAY)

def back():
    base(); logo(8,9,39)
    text(8,34,'Un aquarium bien suivi,',17,'Bold',BLUE)
    text(8,43,'au quotidien.',20,'Bold',GREEN)
    rows=[
        ('01','Suivez vos paramètres.','pH, température, nitrates… Retrouvez','vos mesures et leur historique.'),
        ('02','Simplifiez l’entretien.','Planifiez vos tâches et choisissez','vos rappels par email.'),
        ('03','Découvrez vos espèces.','Consultez les fiches poissons et plantes','pour mieux comprendre leurs besoins.')
    ]
    for i,(n,title,a,b) in enumerate(rows):
        y=57+i*20
        col=GREEN if i==1 else BLUE
        text(8,y,n,12,'Bold',col)
        text(20,y,title,10.5,'Bold',INK)
        text(20,y+5.5,a,8,'Regular',GRAY)
        text(20,y+10,b,8,'Regular',GRAY)
        if i<2: line(20,y+14,97,y+14,'#DBEAF0',.5)
    box(-3,116,111,35,'#EFF9FF')
    gradient(-3,115,111,1)
    box(7,120,25,25,'#FFFFFF',1)
    qr(7,120,25)
    text(37,126,'À vous de plonger !',12,'Bold',BLUE)
    text(37,132,'Créez votre compte gratuit.',8.5,'Bold',INK)
    text(37,138,'aquamanager.fr',9.5,'Bold',GREEN)
    text(37,144,'Sur mobile et ordinateur',7,'Regular',GRAY)

make('AquaManager-flyer-A6-v3-bleu-vert.pdf',False)
make('AquaManager-flyer-A6-v3-bleu-vert-fond-perdu-3mm.pdf',True)
