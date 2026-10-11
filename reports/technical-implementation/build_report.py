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
FIG = ROOT / "diagrams"
FIG.mkdir(exist_ok=True)
FONT = "C:/Windows/Fonts/arial.ttf"
BOLD = "C:/Windows/Fonts/arialbd.ttf"
mxfile = ET.Element("mxfile", host="app.diagrams.net", type="device")


class Diagram:
    def __init__(self, name, width, height):
        self.name, self.w, self.h = name, width, height
        self.im = Image.new("RGB", (width * 2, height * 2), "white")
        self.d = ImageDraw.Draw(self.im)
        page = ET.SubElement(mxfile, "diagram", name=name, id=name)
        model = ET.SubElement(
            page,
            "mxGraphModel",
            page="1",
            pageWidth=str(width),
            pageHeight=str(height),
            grid="1",
            gridSize="10",
        )
        self.root = ET.SubElement(model, "root")
        ET.SubElement(self.root, "mxCell", id="0")
        ET.SubElement(self.root, "mxCell", id="1", parent="0")
        self.n = 1

    def text(self, text, x, y, size=24, bold=False, color="#17212B", align="center"):
        font = ImageFont.truetype(BOLD if bold else FONT, size * 2)
        lines = text.split("\n")
        step = size * 1.24
        for i, line in enumerate(lines):
            self.d.text(
                (x * 2, (y + i * step) * 2),
                line,
                font=font,
                fill=color,
                anchor="ma" if align == "center" else "la",
            )

    def box(self, key, text, x, y, w, h, fill="#EEF3F7", size=24, bold=False):
        self.d.rectangle(
            (x * 2, y * 2, (x + w) * 2, (y + h) * 2),
            fill=fill,
            outline="#566472",
            width=2,
        )
        lines = text.count("\n") + 1
        self.text(text, x + w / 2, y + (h - lines * size * 1.24) / 2, size, bold)
        cell = ET.SubElement(
            self.root,
            "mxCell",
            id=key,
            value=text,
            vertex="1",
            parent="1",
            style=f"rounded=0;whiteSpace=wrap;html=0;fillColor={fill};strokeColor=#566472;fontColor=#17212B;fontSize={size};fontFamily=Arial;fontStyle={1 if bold else 0};",
        )
        ET.SubElement(
            cell,
            "mxGeometry",
            x=str(x),
            y=str(y),
            width=str(w),
            height=str(h),
            attrib={"as": "geometry"},
        )

    def note(self, key, text, x, y, w, h, size=21):
        self.text(text, x + w / 2, y, size)
        cell = ET.SubElement(
            self.root,
            "mxCell",
            id=key,
            value=text,
            vertex="1",
            parent="1",
            style=f"text;html=0;whiteSpace=wrap;align=center;verticalAlign=top;fontSize={size};fontFamily=Arial;strokeColor=none;fillColor=none;",
        )
        ET.SubElement(
            cell,
            "mxGeometry",
            x=str(x),
            y=str(y),
            width=str(w),
            height=str(h),
            attrib={"as": "geometry"},
        )

    def edge(self, key, points, label="", label_at=None, source=None, target=None):
        p = [(int(x * 2), int(y * 2)) for x, y in points]
        self.d.line(p, fill="#566472", width=3)
        a, b = p[-2], p[-1]
        ang = math.atan2(b[1] - a[1], b[0] - a[0])
        self.d.polygon(
            [
                b,
                (b[0] - 17 * math.cos(ang - 0.45), b[1] - 17 * math.sin(ang - 0.45)),
                (b[0] - 17 * math.cos(ang + 0.45), b[1] - 17 * math.sin(ang + 0.45)),
            ],
            fill="#566472",
        )
        if label:
            lx, ly = label_at
            font = ImageFont.truetype(FONT, 40)
            bounds = self.d.textbbox((lx * 2, ly * 2), label, font=font, anchor="ma")
            self.d.rectangle(
                (bounds[0] - 6, bounds[1] - 3, bounds[2] + 6, bounds[3] + 3),
                fill="white",
            )
            self.d.text((lx * 2, ly * 2), label, font=font, fill="#17212B", anchor="ma")
        attrs = dict(
            id=key,
            value=label,
            edge="1",
            parent="1",
            style="edgeStyle=none;endArrow=block;html=0;fontSize=20;fontFamily=Arial;strokeColor=#566472;labelBackgroundColor=#FFFFFF;",
        )
        if source:
            attrs["source"] = source
        if target:
            attrs["target"] = target
        cell = ET.SubElement(self.root, "mxCell", **attrs)
        geo = ET.SubElement(cell, "mxGeometry", relative="1", attrib={"as": "geometry"})
        ET.SubElement(
            geo,
            "mxPoint",
            x=str(points[0][0]),
            y=str(points[0][1]),
            attrib={"as": "sourcePoint"},
        )
        ET.SubElement(
            geo,
            "mxPoint",
            x=str(points[-1][0]),
            y=str(points[-1][1]),
            attrib={"as": "targetPoint"},
        )
        if len(points) > 2:
            arr = ET.SubElement(geo, "Array", attrib={"as": "points"})
            for x, y in points[1:-1]:
                ET.SubElement(arr, "mxPoint", x=str(x), y=str(y))

    def save(self):
        self.im.save(FIG / (self.name + ".png"))


d = Diagram("architecture", 1000, 665)
d.box(
    "browser",
    "Laptop or phone browser\nReact and TypeScript",
    250,
    15,
    500,
    80,
    bold=True,
)
d.edge("http", [(500, 95), (500, 150)], "HTTP :3000", (635, 109))
d.box(
    "web",
    "Frontend container   Nginx :80\nCompiled app, photos and local map geometry",
    100,
    150,
    800,
    90,
)
d.edge("api", [(500, 240), (500, 300)], "Same-origin /api", (650, 257))
d.box(
    "app",
    "Backend container   Express :4000\nSessions, dining, social and discovery modules\nLocal MiniLM CPU inference and 30-second lifecycle worker",
    70,
    300,
    860,
    130,
    bold=True,
    size=23,
)
d.edge("sql", [(500, 430), (500, 490)], "Prisma and parameterised SQL", (690, 445))
d.box(
    "db",
    "Database container   PostgreSQL 16 and pgvector\nAccounts, seat allocations, Events, bookings and vectors\nPersistent named volume",
    70,
    490,
    860,
    120,
    size=23,
)
d.note(
    "boundary",
    "Three containers on one Compose host; only frontend port is published.",
    0,
    630,
    1000,
    30,
    21,
)
d.save()

d = Diagram("data-model", 1000, 790)
d.box("restaurant", "Restaurant\nPK id", 20, 20, 230, 90, bold=True)
d.box(
    "slot",
    "ReservationSlot\nPK id; FK restaurantId\nTable limit and seat pool",
    345,
    20,
    310,
    110,
    bold=True,
    size=22,
)
d.box(
    "allocation",
    "SlotAllocation\nPK id; FK slotId\nseats; owner",
    750,
    20,
    230,
    110,
    bold=True,
    size=21,
)
d.edge("rs", [(250, 65), (345, 65)], "1 : many", (299, 31))
d.edge("sa", [(655, 65), (750, 65)], "1 : many", (701, 31))
d.box(
    "group",
    "GroupDiningSession\nPK id; FK slotId, hostId\nEvent state and preferences",
    20,
    280,
    330,
    110,
    size=22,
)
d.box(
    "booking",
    "Booking\nPK id; FK slotId, userId\nOptional unique groupId",
    600,
    280,
    380,
    110,
    size=22,
)
d.edge("sg", [(405, 130), (405, 200), (185, 200), (185, 280)], "1 : many", (280, 170))
d.edge("sb", [(595, 130), (595, 200), (790, 200), (790, 280)], "1 : many", (712, 170))
d.edge("gb", [(350, 335), (600, 335)], "1 : 0..1", (475, 300))
d.box(
    "member",
    "GroupDiningMember\nPK (groupId, userId)\nOne seat per new member",
    20,
    500,
    330,
    110,
    size=22,
)
d.box(
    "user",
    "User\nPK id; unique email\nIdentity and private reliability",
    600,
    500,
    380,
    110,
    size=22,
)
d.edge("gm", [(185, 390), (185, 500)], "1 : many", (268, 432))
d.edge("um", [(600, 555), (350, 555)], "1 : many", (475, 520))
d.edge("ub", [(790, 500), (790, 390)], "1 : many", (888, 432))
d.note(
    "owners",
    "Allocation owns seats for exactly one Event OR ordinary booking.\nEach owner reference is unique; a shared booking uses its Event allocation.\nEach Event has one User as host. PK = primary key; FK = foreign key.",
    10,
    642,
    980,
    90,
    22,
)
d.note(
    "other",
    "Additional account relations include sessions, shortlist decisions and social records.",
    0,
    750,
    1000,
    30,
    21,
)
d.save()

# A compact state diagram leaves detailed cancellation and penalty rules in prose.
d = Diagram("lifecycle", 1000, 735)
d.note(
    "before",
    "Before Cutoff   One account = one diner; automatic confirmation.",
    0,
    10,
    1000,
    35,
    23,
)
d.box(
    "open",
    "OPEN\nBelow minimum\nBooking pending if present",
    30,
    90,
    320,
    110,
    bold=True,
    size=22,
)
d.box(
    "confirmed",
    "CONFIRMED\nMinimum met\nOne shared booking",
    650,
    90,
    320,
    110,
    fill="#E8F0EA",
    bold=True,
    size=22,
)
d.edge("qualify", [(350, 112), (650, 112)], "Minimum reached", (500, 72))
d.edge("reopen", [(650, 180), (350, 180)], "Below minimum before Cutoff", (500, 205))
d.note(
    "after",
    "Cutoff = 2 hours before dining\nUnused held seats are released.",
    200,
    260,
    600,
    65,
    23,
)
d.box(
    "decision",
    "PRICE_DECISION\nShort at Cutoff\nEach diner accepts or declines",
    30,
    365,
    380,
    110,
    fill="#F4EEE5",
    size=22,
)
d.box(
    "lastcall",
    "LAST_CALL\nLate loss below minimum\nInvite eligible nearby diners",
    590,
    365,
    380,
    110,
    fill="#F4EEE5",
    size=22,
)
d.edge("cutoff", [(190, 200), (190, 245), (18, 245), (18, 340), (190, 340), (190, 365)])
d.edge("lateleave", [(810, 200), (810, 365)], "After Cutoff", (882, 315))
d.edge(
    "refill",
    [(970, 420), (992, 420), (992, 45), (810, 45), (810, 90)],
    "Refill minimum",
    (870, 53),
)
d.box(
    "price",
    "FULL_PRICE\nRemaining diners continue\nBooking discount = 0",
    290,
    560,
    420,
    110,
    fill="#EEF1F4",
    size=22,
)
d.edge(
    "accept",
    [(220, 475), (220, 540), (290, 540), (290, 610)],
    "Accepted diners",
    (220, 495),
)
d.edge(
    "short",
    [(780, 475), (780, 540), (710, 540), (710, 610)],
    "Short at dining time",
    (780, 495),
)
d.note(
    "terminal",
    "Host cancellation or final Leave releases seats; no accepted diner means expiry.\nJoin and Leave remain available before dining where state and capacity permit.",
    0,
    685,
    1000,
    50,
    21,
)
d.save()

d = Diagram("semantic-search", 1000, 720)
d.box(
    "input",
    "For you popup   Restaurants only\nDining mood; optional cuisine, typed location and radius",
    80,
    10,
    840,
    80,
    bold=True,
    size=23,
)
d.edge("start", [(500, 90), (500, 125)])
d.box(
    "index",
    "Refresh changed description vectors\nContent hash includes the pinned model version",
    80,
    125,
    840,
    80,
    size=23,
)
d.edge("next", [(500, 205), (500, 240)])
d.box(
    "embed",
    "Embed the query using local quantised MiniLM\nMean pooling; normalised vector with 384 dimensions",
    80,
    240,
    840,
    80,
    size=23,
)
d.edge("filteredge", [(500, 320), (500, 355)])
d.box(
    "filter",
    "Hard filters before ranking\nCuisine, available inventory, prior decisions and radius",
    80,
    355,
    840,
    80,
    size=23,
)
d.edge("rankedge", [(500, 435), (500, 470)])
d.box(
    "rank",
    "pgvector cosine-distance ranking\nAt most 30 eligible restaurants; no cross-cuisine fallback",
    80,
    470,
    840,
    80,
    size=23,
)
d.edge("decideedge", [(500, 550), (500, 585)])
d.box(
    "decide",
    "Review cards   Save or skip with undo\nDecisions persist for the authenticated account",
    80,
    585,
    840,
    80,
    size=23,
)
d.note(
    "separate",
    "Booking and Event Join are separate actions with fresh inventory checks.",
    0,
    690,
    1000,
    30,
    21,
)
d.save()

d = Diagram("ci-delivery", 1000, 720)
d.note(
    "trigger",
    "Push to main, pull request to main or manual workflow dispatch",
    0,
    10,
    1000,
    30,
    23,
)
d.box(
    "quality",
    "Job 1   Code checks\nLocked dependencies, format, types, unit tests and build",
    70,
    70,
    860,
    85,
    bold=True,
    size=23,
)
d.edge("qualitypass", [(500, 155), (500, 195)], "Success", (585, 163))
d.box(
    "integration",
    "Job 2   Docker integration on GitHub runner\nFresh test database; auth, dining and real-model tests",
    70,
    195,
    860,
    85,
    bold=True,
    size=23,
)
d.edge(
    "mainonly",
    [(500, 280), (500, 350)],
    "Success; main only, not pull requests",
    (720, 302),
)
d.box(
    "delivery",
    "Job 3   Prepare release artifact\nTested source commit, checksum, evidence and deploy.ps1",
    70,
    350,
    860,
    85,
    bold=True,
    size=23,
)
d.edge("manual", [(500, 435), (500, 515)], "Manual deployment choice", (720, 464))
d.box(
    "deploy",
    "Laptop   Manual deployment\nValidate package; build services; check health and version\nRetain the existing application database volume",
    70,
    515,
    860,
    110,
    fill="#E8F0EA",
    size=23,
)
d.note(
    "bounds",
    "CI test data is separate from application data. Failed checks stop delivery.\nA successful push does not automatically update the laptop application.",
    0,
    658,
    1000,
    60,
    22,
)
d.save()
ET.indent(mxfile)
ET.ElementTree(mxfile).write(
    FIG / "eatigo-technical-diagrams.drawio", encoding="utf-8", xml_declaration=True
)

doc = Document()
sec = doc.sections[0]
sec.page_width = Inches(8.5)
sec.page_height = Inches(11)
sec.top_margin = Inches(0.75)
sec.bottom_margin = Inches(0.75)
sec.left_margin = Inches(0.8)
sec.right_margin = Inches(0.8)
sec.footer_distance = Inches(0.3)
normal = doc.styles["Normal"]
normal.font.name = "Arial"
normal.font.size = Pt(11)
normal.paragraph_format.line_spacing = 1.5
normal.paragraph_format.space_after = Pt(7)
for name, size in [
    ("Title", 22),
    ("Heading 1", 16),
    ("Heading 2", 12),
    ("Heading 3", 11),
]:
    s = doc.styles[name]
    s.font.name = "Arial"
    s.font.size = Pt(size)
    s.font.color.rgb = RGBColor(0, 0, 0)
    s.font.bold = True
    s.paragraph_format.space_before = Pt(15 if name != "Title" else 0)
    s.paragraph_format.space_after = Pt(7)
    s.paragraph_format.keep_with_next = True
    s.paragraph_format.line_spacing = 1.15
cap = doc.styles["Caption"]
cap.font.name = "Arial"
cap.font.size = Pt(10)
cap.font.italic = False
cap.font.color.rgb = RGBColor(0, 0, 0)
cap.paragraph_format.line_spacing = 1.15
cap.paragraph_format.space_after = Pt(10)
foot = sec.footer.paragraphs[0]
foot.alignment = WD_ALIGN_PARAGRAPH.RIGHT
foot.add_run("SC4025  |  ")
field = OxmlElement("w:fldSimple")
field.set(qn("w:instr"), "PAGE")
foot._p.append(field)
for r in foot.runs:
    r.font.size = Pt(9)
doc.core_properties.title = "Eatigo MVP and Technical Implementation"
doc.core_properties.subject = "SC4025 Product Engineer report section"
doc.core_properties.author = "Jacob Ong Jia Chun"
doc.core_properties.keywords = "Eatigo, Eatogether, SC4025, technical implementation"


def table(lines, caption):
    doc.add_paragraph(caption, "Caption").paragraph_format.keep_with_next = True
    rows = [
        [c.strip() for c in l.strip().strip("|").split("|")]
        for l in lines
        if not re.match(r"^\|[\s|:-]+\|$", l)
    ]
    n = len(rows[0])
    t = doc.add_table(rows=0, cols=n)
    t.alignment = WD_TABLE_ALIGNMENT.CENTER
    t.autofit = False
    widths = [1.65, 2.55, 2.7] if n == 3 else [6.9 / n] * n
    if "5.2 " in caption:
        widths = [2.25, 2.25, 2.4]
    if "5.4 " in caption:
        widths = [1.65, 2.9, 2.35]
    for col, w in zip(t.columns, widths):
        col.width = Inches(w)
    props = t._tbl.tblPr
    borders = OxmlElement("w:tblBorders")
    for side in ["top", "left", "bottom", "right", "insideH", "insideV"]:
        b = OxmlElement("w:" + side)
        b.set(qn("w:val"), "single")
        b.set(qn("w:sz"), "4")
        b.set(qn("w:color"), "D9D9D9")
        borders.append(b)
    props.append(borders)
    for i, row in enumerate(rows):
        cells = t.add_row().cells
        trpr = t.rows[-1]._tr.get_or_add_trPr()
        trpr.append(OxmlElement("w:cantSplit"))
        if i == 0:
            trpr.append(OxmlElement("w:tblHeader"))
        for cell, value, w in zip(cells, row, widths):
            cell.width = Inches(w)
            cell.vertical_alignment = WD_CELL_VERTICAL_ALIGNMENT.CENTER
            cell.text = value
            tcpr = cell._tc.get_or_add_tcPr()
            margins = OxmlElement("w:tcMar")
            for side in ["top", "left", "bottom", "right"]:
                x = OxmlElement("w:" + side)
                x.set(qn("w:w"), "90")
                x.set(qn("w:type"), "dxa")
                margins.append(x)
            tcpr.append(margins)
            if i == 0:
                shade = OxmlElement("w:shd")
                shade.set(qn("w:fill"), "E7EDF3")
                tcpr.append(shade)
            for p in cell.paragraphs:
                p.paragraph_format.line_spacing = 1.1
                p.paragraph_format.space_after = Pt(3)
                p.paragraph_format.space_before = Pt(3)
                if i == 0:
                    p.paragraph_format.keep_with_next = True
                for r in p.runs:
                    r.font.size = Pt(10)
                    r.bold = i == 0
    doc.add_paragraph().paragraph_format.space_after = Pt(0)


lines = (ROOT / "section-5.md").read_text(encoding="utf-8").splitlines()
i = 0
while i < len(lines):
    line = lines[i].strip()
    i += 1
    if not line:
        continue
    if line.startswith("@figure "):
        name, caption = [x.strip() for x in line[8:].split("|", 1)]
        p = doc.add_paragraph()
        p.paragraph_format.keep_with_next = True
        p.paragraph_format.line_spacing = 1
        p.alignment = WD_ALIGN_PARAGRAPH.CENTER
        pic = p.add_run().add_picture(str(FIG / (name + ".png")), width=Inches(6.75))
        pic._inline.docPr.set("descr", caption)
        doc.add_paragraph(caption, "Caption")
    elif line.startswith("@table "):
        data = []
        while i < len(lines) and lines[i].startswith("|"):
            data.append(lines[i])
            i += 1
        table(data, line[7:])
    elif line.startswith("# "):
        doc.add_paragraph(line[2:], "Title")
        p = doc.add_paragraph(
            "Eatigo and EatTogether  |  SC4025 Digital Product Management"
        )
        p.paragraph_format.space_after = Pt(15)
        for r in p.runs:
            r.font.size = Pt(10)
    elif line.startswith("## "):
        doc.add_paragraph(line[3:], "Heading 1")
    elif line.startswith("### "):
        doc.add_paragraph(line[4:], "Heading 2")
    else:
        doc.add_paragraph(line)
out = ROOT / "Eatigo_Technical_Implementation.docx"
# Remove decorative rules inherited from the base document's styles.
for border in list(doc.styles.element.iter(qn("w:pBdr"))):
    border.getparent().remove(border)
for border in list(doc.element.iter(qn("w:pBdr"))):
    border.getparent().remove(border)
doc.save(out)
print(out)
print(
    "Words:",
    sum(len(p.text.split()) for p in doc.paragraphs)
    + sum(len(c.text.split()) for t in doc.tables for row in t.rows for c in row.cells),
)
