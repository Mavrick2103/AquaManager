from pathlib import Path
p=Path('tmp/pdfs/create_flyer.py')
s=p.read_text(encoding='utf-8-sig')
start=s.index('def front():')
end=s.index('def make(',start)
s=s[:start]+'''
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
''' + s[end:]
p.write_text(s,encoding='utf-8')
