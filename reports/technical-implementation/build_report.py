from pathlib import Path
import re
import math
import xml.etree.ElementTree as ET
from PIL import Image, ImageDraw, ImageFont
from docx import Document
from docx.shared import Inches, Pt, RGBColor
from docx.oxml import OxmlElement
from docx.oxml.ns import qn
from docx.enum.text import WD_ALIGN_PARAGRAPH
from docx.enum.table import WD_TABLE_ALIGNMENT, WD_CELL_VERTICAL_ALIGNMENT

ROOT = Path(__file__).resolve().parent
FIG = ROOT / 'diagrams'
FIG.mkdir(exist_ok=True)
FONT = 'C:/Windows/Fonts/arial.ttf'
BOLD = 'C:/Windows/Fonts/arialbd.ttf'
mxfile = ET.Element('mxfile', host='app.diagrams.net', type='device')

class Diagram:
    def __init__(self, name, width, height):
        self.name, self.w, self.h = name, width, height
        self.im = Image.new('RGB', (width * 2, height * 2), 'white')
        self.d = ImageDraw.Draw(self.im)
        page = ET.SubElement(mxfile, 'diagram', name=name, id=name)
        model = ET.SubElement(page, 'mxGraphModel', page='1', pageWidth=str(width), pageHeight=str(height), grid='1', gridSize='10')
        self.root = ET.SubElement(model, 'root')
        ET.SubElement(self.root, 'mxCell', id='0')
        ET.SubElement(self.root, 'mxCell', id='1', parent='0')
        self.n = 1

    def text(self, text, x, y, size=24, bold=False, color='#17212B', align='center'):
        font = ImageFont.truetype(BOLD if bold else FONT, size * 2)
        lines = text.split('\n')
        step = size * 1.24
        for i, line in enumerate(lines):
            self.d.text((x * 2, (y + i * step) * 2), line, font=font, fill=color, anchor='ma' if align == 'center' else 'la')

    def box(self, key, text, x, y, w, h, fill='#EEF3F7', size=24, bold=False):
        self.d.rectangle((x*2,y*2,(x+w)*2,(y+h)*2), fill=fill, outline='#566472', width=2)
        lines=text.count('\n')+1
        self.text(text,x+w/2,y+(h-lines*size*1.24)/2,size,bold)
        cell=ET.SubElement(self.root,'mxCell',id=key,value=text,vertex='1',parent='1',style=f'rounded=0;whiteSpace=wrap;html=0;fillColor={fill};strokeColor=#566472;fontColor=#17212B;fontSize={size};fontFamily=Arial;fontStyle={1 if bold else 0};')
        ET.SubElement(cell,'mxGeometry',x=str(x),y=str(y),width=str(w),height=str(h),attrib={'as':'geometry'})

    def note(self,key,text,x,y,w,h,size=21):
        self.text(text,x+w/2,y,size)
        cell=ET.SubElement(self.root,'mxCell',id=key,value=text,vertex='1',parent='1',style=f'text;html=0;whiteSpace=wrap;align=center;verticalAlign=top;fontSize={size};fontFamily=Arial;strokeColor=none;fillColor=none;')
        ET.SubElement(cell,'mxGeometry',x=str(x),y=str(y),width=str(w),height=str(h),attrib={'as':'geometry'})

    def edge(self,key,points,label='',label_at=None,source=None,target=None):
        p=[(int(x*2),int(y*2)) for x,y in points]
        self.d.line(p,fill='#566472',width=3)
        a,b=p[-2],p[-1]
        ang=math.atan2(b[1]-a[1],b[0]-a[0])
        self.d.polygon([b,(b[0]-17*math.cos(ang-.45),b[1]-17*math.sin(ang-.45)),(b[0]-17*math.cos(ang+.45),b[1]-17*math.sin(ang+.45))],fill='#566472')
        if label:
            lx,ly=label_at
            font=ImageFont.truetype(FONT,40)
            bounds=self.d.textbbox((lx*2,ly*2),label,font=font,anchor='ma')
            self.d.rectangle((bounds[0]-6,bounds[1]-3,bounds[2]+6,bounds[3]+3),fill='white')
            self.d.text((lx*2,ly*2),label,font=font,fill='#17212B',anchor='ma')
        attrs=dict(id=key,value=label,edge='1',parent='1',style='edgeStyle=none;endArrow=block;html=0;fontSize=20;fontFamily=Arial;strokeColor=#566472;labelBackgroundColor=#FFFFFF;')
        if source: attrs['source']=source
        if target: attrs['target']=target
        cell=ET.SubElement(self.root,'mxCell',**attrs)
        geo=ET.SubElement(cell,'mxGeometry',relative='1',attrib={'as':'geometry'})
        ET.SubElement(geo,'mxPoint',x=str(points[0][0]),y=str(points[0][1]),attrib={'as':'sourcePoint'})
        ET.SubElement(geo,'mxPoint',x=str(points[-1][0]),y=str(points[-1][1]),attrib={'as':'targetPoint'})
        if len(points)>2:
            arr=ET.SubElement(geo,'Array',attrib={'as':'points'})
            for x,y in points[1:-1]: ET.SubElement(arr,'mxPoint',x=str(x),y=str(y))

    def save(self): self.im.save(FIG/(self.name+'.png'))

d=Diagram('architecture',1000,690)
d.box('browser','Laptop or phone browser\nReact application',275,15,450,95,bold=True)
d.edge('http',[(500,110),(500,175)],'HTTP :3000',(625,130))
d.box('web','Frontend container\nNginx :80\nCompiled JS, CSS, photos and GeoJSON',145,175,710,120)
d.edge('api',[(500,295),(500,355)],'/api requests',(625,312))
d.box('app','Backend container   Express :4000\nAuthentication  |  Dining  |  Discovery',145,355,710,100,bold=True)
d.edge('sql',[(325,455),(325,520)])
d.edge('model',[(690,455),(690,520)])
d.box('db','Database container\nPostgreSQL + pgvector\nPersistent named volume',120,520,410,120)
d.box('embedding','Within backend process\nLocal MiniLM model\nCPU inference',590,520,350,120)
d.note('boundary','Three services on one Docker Compose host; only frontend port is published.',0,660,1000,30,20)
d.save()

d=Diagram('data-model',1000,825)
d.box('restaurant','Restaurant\nPK id',20,20,250,90,bold=True)
d.box('slot','ReservationSlot\nPK id; FK restaurantId',375,20,270,90,bold=True)
d.box('allocation','SlotAllocation\nPK and FK slotId',750,20,230,90,bold=True,size=22)
d.edge('rs',[(270,65),(375,65)],'1 to many',(320,28))
d.edge('sa',[(645,65),(750,65)],'1 to 0..1',(700,28))
d.box('group','GroupDiningSession\nPK id; FK slotId, hostId\nstatus; capacity',20,270,310,120,size=23)
d.box('booking','Booking\nPK id; FK slotId, userId\nOptional unique groupId',570,270,410,120,size=23)
d.edge('sg',[(425,110),(425,175),(175,175),(175,270)],'1 to many',(300,145))
d.edge('sb',[(600,110),(600,175),(800,175),(800,270)],'1 to many',(710,145))
d.edge('gb',[(330,330),(570,330)],'1 to 0..1',(450,292))
d.box('member','GroupDiningMember\nPK and FK\n(groupId, userId)',20,510,310,120,size=23)
d.box('user','User\nPK id; unique email',570,510,410,120,bold=True,size=24)
d.edge('gm',[(175,390),(175,510)],'1 to many',(255,440))
d.edge('um',[(570,565),(330,565)],'1 to many',(450,530))
d.edge('ub',[(800,510),(800,390)],'1 to many',(890,440))
d.note('hosts','Each group also has one User as host through hostId.\nAllocation has exactly one owner: a group OR an ordinary booking.\nA confirmed group retains its group-owned allocation.',15,662,970,88,23)
d.note('other','Additional user relations: User 1 to many Session; User 1 to many DiscoveryDecision.\nPK = primary key; FK = foreign key. Arrows show selected core relationships.',15,765,970,55,21)
d.save()

d=Diagram('lifecycle',1000,660)
d.box('open','OPEN\nSeats remain',70,80,300,100,bold=True)
d.box('full','FULL\nCapacity reached',630,80,300,100,bold=True)
d.edge('join',[(370,105),(630,105)],'Last seat joined',(500,68))
d.edge('leave',[(630,158),(370,158)],'Member leaves',(500,173))
d.box('confirmed','CONFIRMED\nOne shared booking\nMembership frozen',350,310,300,115,fill='#E8F0EA',bold=True)
d.edge('oc',[(220,180),(220,285),(385,285),(385,310)])
d.edge('fc',[(780,180),(780,285),(615,285),(615,310)])
d.note('confirmrule','Host confirms once minimum party size is met',190,237,620,30,23)
d.box('cancelled','From OPEN, FULL or CONFIRMED\nHost cancels before slot starts\nCANCELLED: allocation released',20,505,465,125,fill='#F4EDEC',size=22)
d.box('expired','From OPEN or FULL\nSlot starts; next request processes expiry\nEXPIRED: allocation released',515,505,465,125,fill='#F2F2F2',size=22)
d.note('othertransitions','Cancellation and expiry transitions',180,455,640,35,23)
d.note('initial','Creation adds the host and holds an available slot.',0,10,1000,35,23)
d.save()

d=Diagram('semantic-search',1000,735)
d.box('input','Dining preference + Restaurant or Eatogether mode\nOptional typed location and radius',90,15,820,80,bold=True)
d.edge('start',[(500,95),(500,130)])
d.box('index','Update changed venue and group embeddings\nHash includes description and model version',90,130,820,80)
d.edge('next',[(500,210),(500,245)])
d.box('embed','Embed query locally with MiniLM\nNormalised 384-dimensional vector',90,245,820,80)
d.edge('filteredge',[(500,325),(500,360)])
d.box('filter','Filter candidates\nAvailability, membership, prior decisions and radius',90,360,820,80)
d.edge('rankedge',[(500,440),(500,475)])
d.box('rank','PostgreSQL cosine-distance ranking\nEligible records only; at most 30 results',90,475,820,80)
d.edge('decideedge',[(500,555),(500,590)])
d.box('decide','Review cards and save or skip\nDecisions persist per account; undo supported',90,590,820,80)
d.note('separate','Booking or joining is separate and rechecks current availability.',0,697,1000,30,23)
d.save()
ET.indent(mxfile)
ET.ElementTree(mxfile).write(FIG/'eatigo-technical-diagrams.drawio',encoding='utf-8',xml_declaration=True)

doc=Document()
sec=doc.sections[0]
sec.page_width=Inches(8.5); sec.page_height=Inches(11)
sec.top_margin=Inches(.75); sec.bottom_margin=Inches(.75)
sec.left_margin=Inches(.8); sec.right_margin=Inches(.8)
sec.footer_distance=Inches(.3)
normal=doc.styles['Normal']
normal.font.name='Arial'; normal.font.size=Pt(11)
normal.paragraph_format.line_spacing=1.5
normal.paragraph_format.space_after=Pt(7)
for name,size in [('Title',22),('Heading 1',16),('Heading 2',12),('Heading 3',11)]:
    s=doc.styles[name]; s.font.name='Arial'; s.font.size=Pt(size); s.font.color.rgb=RGBColor(0,0,0)
    s.font.bold=True
    s.paragraph_format.space_before=Pt(15 if name!='Title' else 0)
    s.paragraph_format.space_after=Pt(7)
    s.paragraph_format.keep_with_next=True
    s.paragraph_format.line_spacing=1.15
cap=doc.styles['Caption']; cap.font.name='Arial'; cap.font.size=Pt(10); cap.font.italic=False; cap.font.color.rgb=RGBColor(0,0,0)
cap.paragraph_format.line_spacing=1.15; cap.paragraph_format.space_after=Pt(10)
foot=sec.footer.paragraphs[0]; foot.alignment=WD_ALIGN_PARAGRAPH.RIGHT
foot.add_run('SC4025  |  ')
field=OxmlElement('w:fldSimple'); field.set(qn('w:instr'),'PAGE'); foot._p.append(field)
for r in foot.runs: r.font.size=Pt(9)
doc.core_properties.title='Eatigo MVP and Technical Implementation'
doc.core_properties.subject='SC4025 Product Engineer report section'
doc.core_properties.author='Jacob Ong Jia Chun'
doc.core_properties.keywords='Eatigo, Eatogether, SC4025, technical implementation'

def table(lines,caption):
    doc.add_paragraph(caption,'Caption').paragraph_format.keep_with_next=True
    rows=[[c.strip() for c in l.strip().strip('|').split('|')] for l in lines if not re.match(r'^\|[\s|:-]+\|$',l)]
    n=len(rows[0]); t=doc.add_table(rows=0,cols=n); t.alignment=WD_TABLE_ALIGNMENT.CENTER; t.autofit=False
    widths=[1.65,2.55,2.7] if n==3 else [6.9/n]*n
    if '5.2 ' in caption: widths=[2.25,2.25,2.4]
    if '5.4 ' in caption: widths=[1.65,2.9,2.35]
    for col,w in zip(t.columns,widths): col.width=Inches(w)
    props=t._tbl.tblPr
    borders=OxmlElement('w:tblBorders')
    for side in ['top','left','bottom','right','insideH','insideV']:
        b=OxmlElement('w:'+side); b.set(qn('w:val'),'single'); b.set(qn('w:sz'),'4'); b.set(qn('w:color'),'D9D9D9'); borders.append(b)
    props.append(borders)
    for i,row in enumerate(rows):
        cells=t.add_row().cells
        trpr=t.rows[-1]._tr.get_or_add_trPr(); trpr.append(OxmlElement('w:cantSplit'))
        if i==0: trpr.append(OxmlElement('w:tblHeader'))
        for cell,value,w in zip(cells,row,widths):
            cell.width=Inches(w); cell.vertical_alignment=WD_CELL_VERTICAL_ALIGNMENT.CENTER
            cell.text=value
            tcpr=cell._tc.get_or_add_tcPr()
            margins=OxmlElement('w:tcMar')
            for side in ['top','left','bottom','right']:
                x=OxmlElement('w:'+side);x.set(qn('w:w'),'90');x.set(qn('w:type'),'dxa');margins.append(x)
            tcpr.append(margins)
            if i==0:
                shade=OxmlElement('w:shd');shade.set(qn('w:fill'),'E7EDF3');tcpr.append(shade)
            for p in cell.paragraphs:
                p.paragraph_format.line_spacing=1.1;p.paragraph_format.space_after=Pt(3);p.paragraph_format.space_before=Pt(3)
                if i==0: p.paragraph_format.keep_with_next=True
                for r in p.runs: r.font.size=Pt(10);r.bold=(i==0)
    doc.add_paragraph().paragraph_format.space_after=Pt(0)

lines=(ROOT/'section-5.md').read_text(encoding='utf-8').splitlines()
i=0
while i<len(lines):
    line=lines[i].strip();i+=1
    if not line:continue
    if line.startswith('@figure '):
        name,caption=[x.strip() for x in line[8:].split('|',1)]
        p=doc.add_paragraph();p.paragraph_format.keep_with_next=True;p.paragraph_format.line_spacing=1;p.alignment=WD_ALIGN_PARAGRAPH.CENTER
        pic=p.add_run().add_picture(str(FIG/(name+'.png')),width=Inches(6.75))
        pic._inline.docPr.set('descr',caption)
        doc.add_paragraph(caption,'Caption')
    elif line.startswith('@table '):
        data=[]
        while i<len(lines) and lines[i].startswith('|'):data.append(lines[i]);i+=1
        table(data,line[7:])
    elif line.startswith('# '):
        doc.add_paragraph(line[2:],'Title')
        p=doc.add_paragraph('Eatigo and Eatogether  |  SC4025 Digital Product Management')
        p.paragraph_format.space_after=Pt(15)
        for r in p.runs:r.font.size=Pt(10)
    elif line.startswith('## '):doc.add_paragraph(line[3:],'Heading 1')
    elif line.startswith('### '):doc.add_paragraph(line[4:],'Heading 2')
    else:doc.add_paragraph(line)
out=ROOT/'Eatigo_Technical_Implementation.docx'
# Remove decorative rules inherited from the base document's styles.
for border in list(doc.styles.element.iter(qn('w:pBdr'))):
    border.getparent().remove(border)
for border in list(doc.element.iter(qn('w:pBdr'))):
    border.getparent().remove(border)
doc.save(out)
print(out)
print('Words:',sum(len(p.text.split()) for p in doc.paragraphs)+sum(len(c.text.split()) for t in doc.tables for row in t.rows for c in row.cells))
