"""Build Mill Garden data from the buyer booklet and the existing Max palette."""
from pathlib import Path
from decimal import Decimal
import hashlib
import json
import re
import shutil
from pypdf import PdfReader

ROOT = Path(__file__).resolve().parents[1]
PDF = ROOT / 'sources/Mill-Garden-buyer-booklet.pdf'
if not PDF.exists():
    PDF = ROOT / 'input files/Mill_Garden_vevoi_fuzet (9) (1).pdf'
DATA = ROOT / 'data'
OUT = ROOT / 'output/apartment-masks'

def write(path, value):
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(value, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')

def build():
    reader = PdfReader(PDF)
    palette_path = ROOT / 'sources/mask-palette-v1.json'
    if not palette_path.exists():
        palette_path.parent.mkdir(parents=True, exist_ok=True)
        shutil.copy2(OUT / 'apartment-mask-colors.json', palette_path)
    palette = json.loads(palette_path.read_text(encoding='utf-8'))
    colors = {r['apartmentId']: r for r in palette['apartments']}
    schedule = {}
    for page_index in (4, 5):
        text = reader.pages[page_index].extract_text()
        headings = list(re.finditer(r'([1-4])\. (?:épület|ütem) —', text))
        for hi, heading in enumerate(headings):
            section = text[heading.end():headings[hi+1].start() if hi+1 < len(headings) else len(text)]
            pattern = r'(?m)^(\d+)\n(Fsz\.|[12]\. em\.|Tetőszint)\n([\d.]+)\n([\d.]+)\n([\d.]+|–)\n([\d.]+ M Ft|ELADVA)\n(IGEN|–)'
            for m in re.finditer(pattern, section):
                num, floor, area, terrace, garden, price, eligible = m.groups()
                building = heading.group(1)
                apartment_id = f'{building}-{int(num):02d}'
                schedule[apartment_id] = dict(building=building, apartmentNumber=int(num), floor=0 if floor=='Fsz.' else 1 if floor=='1. em.' else 2, floorLabel={'Fsz.':'Földszint','1. em.':'1. emelet','2. em.':'2. emelet','Tetőszint':'Tetőszint'}[floor], areaInterior=float(area), areaTerrace=float(terrace), areaGarden=None if garden=='–' else float(garden), price=None if price=='ELADVA' else int(Decimal(price.split()[0])*1000000), status='sold' if price=='ELADVA' else 'available', otthonStartPriceEligible=eligible=='IGEN', sourceSchedulePage=page_index+1)
    details = {}
    for page_index in range(7, 15):
        text = reader.pages[page_index].extract_text()
        headings = list(re.finditer(r'([1-4])\.\s*(?:épület|ütem)\s*/\s*(\d+)\.\s*lakás', text))
        for hi, heading in enumerate(headings):
            block = text[heading.end():headings[hi+1].start() if hi+1 < len(headings) else len(text)]
            apartment_id = f'{heading.group(1)}-{int(heading.group(2)):02d}'
            rooms = []
            for n, (name, area, finish) in enumerate(re.findall(r'([^\n]+)\n([\d.]+) m²\n([^\n]+)', block), 1):
                name = name.strip()
                rooms.append(dict(id=f'{apartment_id}-R{n:02d}', name=name, area=float(area), kind='exterior' if name in ('Terasz','Kert') else 'interior', finish=None if finish.strip()=='–' else finish.strip(), planNumber=None))
            details[apartment_id] = dict(roomList=rooms, sourceDetailPage=page_index+1)
    assert len(schedule)==len(details)==len(colors)==53
    assert set(schedule)==set(details)==set(colors)
    full = []
    staging = []
    per_floor = {}
    for apartment_id, fields in schedule.items():
        d = details[apartment_id]
        rooms = d['roomList']
        interior = round(sum(r['area'] for r in rooms if r['kind']=='interior'), 2)
        terrace = round(sum(r['area'] for r in rooms if r['name']=='Terasz'), 2)
        garden = round(sum(r['area'] for r in rooms if r['name']=='Kert'), 2)
        assert abs(interior-fields['areaInterior']) < .015, (apartment_id, interior)
        assert abs(terrace-fields['areaTerrace']) < .015, (apartment_id, terrace)
        assert abs(garden-(fields['areaGarden'] or 0)) < .015, (apartment_id, garden)
        b, floor = fields['building'], fields['floor']
        key = (b, floor)
        column = per_floor.get(key, 0)
        per_floor[key] = column + 1
        x = 33523 + ((int(b)-1)%2)*13000 + column*1100
        y = 12000 - ((int(b)-1)//2)*5500 - floor*1000
        layer = f'MG_MASKS_{b}_F{floor:02d}'
        bedrooms = sum(r['name']=='Szoba' for r in rooms)
        living = sum(r['name']=='Nappali' for r in rooms)
        r = dict(id=apartment_id, name=f'{b}. '+('ütem' if b=='4' else 'épület')+f' / {fields["apartmentNumber"]}. lakás', **fields, rooms=bedrooms+living, bedrooms=bedrooms if living else 0, layoutLabel=f'{bedrooms} hálószoba + nappali' if living else 'Egyszobás lakás', orientation=None, currency='HUF', priceIncludesVat=True, statusLabel='Eladva' if fields['status']=='sold' else 'Elérhető', apartmentType=None, floorplan=None, note='Előzetes adatok a 4. ütemhez.' if b=='4' else None, maskColor=colors[apartment_id]['hex'], box=dict(objectName=colors[apartment_id]['objectName'], layer=layer, parentLayer=f'MG_MASKS_{b}', stagingPositionCm=[x,y,0], dimensionsCm=palette['boxDimensionsCm'], mappingStatus='unmapped'), media=dict(floorplan=None, floorLayout=None, datasheet=dict(url='sources/Mill-Garden-buyer-booklet.pdf', page=d['sourceDetailPage'], label='Vevői füzet - lakásadatok')), source=dict(schedulePage=fields['sourceSchedulePage'], detailPage=d['sourceDetailPage']), roomList=rooms)
        full.append(r)
        staging.append(dict(id=apartment_id, maskColor=r['maskColor'], rgb=colors[apartment_id]['rgb'], building=b, floor=floor, floorLabel=fields['floorLabel'], **r['box']))
    project = dict(id='mill-garden',name='Mill Garden',city='Balatonszemes',locale='hu-HU',currency='HUF',areaUnit='m²',availabilityAsOf=None,priceAsOf='2026-07',priceDefinition='Gross apartment price including 5% VAT; parking excluded. Historical source, not live availability.',source=dict(path='sources/Mill-Garden-buyer-booklet.pdf',sha256=hashlib.sha256(PDF.read_bytes()).hexdigest(),schedulePages=[5,6]), missingAssets=['Apartment floorplan images','Building floor-layout images','Apartment image marker coordinates','Orbit mask renders'])
    write(DATA/'apartments.json',dict(schemaVersion='1.0',project=project,apartments=[{k:v for k,v in r.items() if k!='roomList'} for r in full],roomLayouts={}))
    write(DATA/'apartment-details.json',dict(schemaVersion='1.0',project=project,apartments=full,roomLayouts={}))
    write(DATA/'apartment-mask-colors.json',dict(schemaVersion='1.0',projectId='mill-garden',paletteVersion=1,encoding='RGB8',colorSpace='sRGB',backgroundColor='#000000',reservedColors=['#000000','#FFFFFF'],boxDimensionsCm=palette['boxDimensionsCm'],apartments=staging))
    (ROOT/'sources').mkdir(exist_ok=True)
    if PDF != ROOT/'sources/Mill-Garden-buyer-booklet.pdf':
        shutil.copy2(PDF,ROOT/'sources/Mill-Garden-buyer-booklet.pdf')
    rows=',\n'.join('    #("%s", "%s", %d, "%s", [%d,%d,%d])'%(r['id'],r['building'],r['floor'],r['layer'],*r['stagingPositionCm']) for r in staging)
    organize='''/* Organize existing Mill Garden boxes into building/floor rows. Explicit rerun repositions owned boxes; dimensions and colors are preserved. */
(
 local rows = #(\nROWS\n )
 local nodes=#()
 for row in rows do (
   local n=getNodeByName ("MG_MASK_"+row[1]) exact:true
   if n==undefined do throw ("Missing apartment box: "+row[1])
   if (getUserPropVal n "MillGardenMaskOwner" asString:true)!="mill-garden-mask-v1" do throw ("Unowned box: "+row[1])
   append nodes n
 )
 undo "Organize Mill Garden boxes by building and floor" on with animate off at time 0f (
   for i=1 to rows.count do (
     local row=rows[i]; local n=nodes[i]
     local parentLayer=LayerManager.getLayerFromName ("MG_MASKS_"+row[2])
     local floorLayer=LayerManager.getLayerFromName row[4]
     if floorLayer==undefined do floorLayer=LayerManager.newLayerFromName row[4]
     floorLayer.setParent parentLayer
     floorLayer.addNode n
     n.pos=row[5]*(units.decodeValue "1cm")
     setUserPropVal n "Floor" row[3]
     setUserPropVal n "BuildingOrPhase" row[2]
   )
 )
 redrawViews()
 nodes.count
)
'''.replace('ROWS',rows)
    tools=ROOT/'tools/3dsmax';tools.mkdir(parents=True,exist_ok=True)
    (tools/'OrganizeMillGardenApartmentBoxes.ms').write_text(organize,encoding='utf-8-sig')
    if not (tools/'MillGardenApartmentMaskBoxes.ms').exists():
        shutil.copy2(OUT/'MillGardenApartmentMaskBoxes.ms',tools/'MillGardenApartmentMaskBoxes.ms')
    report=dict(apartments=len(full),uniqueColors=len(set(r['maskColor'] for r in full)),roomAreaChecksPassed=53,buildingFloorCounts={f'{b}-F{f:02d}':c for (b,f),c in per_floor.items()},totalRoomEntries=sum(len(r['roomList']) for r in full),statusCounts={s:sum(r['status']==s for r in full) for s in ('available','sold')},missingFloorplanImages=53)
    write(ROOT/'validation/apartment-data-report.json',report)
    print(json.dumps(report,ensure_ascii=False))

if __name__=='__main__':
    build()
