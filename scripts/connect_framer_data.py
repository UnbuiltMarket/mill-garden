from pathlib import Path
ROOT=Path(__file__).resolve().parents[1]
path=ROOT/'framer/MillGardenOrbit.tsx'
source=path.read_text(encoding='utf-8-sig')
assert 'function MillGardenApartmentPanel' not in source, 'Already connected'
source=source.replace('    introFps?: number\n','    introFps?: number\n    showApartmentData?: boolean\n    apartmentDataUrl?: string\n    detailDataUrl?: string\n    maskPaletteUrl?: string\n',1)
source=source.replace('cameraStops = 8,','cameraStops = 4,',1)
source=source.replace('    const staticRenderer = useIsStaticRenderer()', '''    const { showApartmentData = true,
        apartmentDataUrl = "https://raw.githubusercontent.com/UnbuiltMarket/mill-garden/main/data/apartments.json",
        detailDataUrl = "https://raw.githubusercontent.com/UnbuiltMarket/mill-garden/main/data/apartment-details.json",
        maskPaletteUrl = "https://raw.githubusercontent.com/UnbuiltMarket/mill-garden/main/data/apartment-mask-colors.json" } = props
    const staticRenderer = useIsStaticRenderer()''',1)
anchor='''        </div>
    </div>
}
addPropertyControls(MillGardenOrbit,{'''
assert source.count(anchor)==1
source=source.replace(anchor,'''        </div>
        {showApartmentData && <MillGardenApartmentPanel apartmentDataUrl={apartmentDataUrl} detailDataUrl={detailDataUrl} maskPaletteUrl={maskPaletteUrl} enabled={near || staticRenderer} />}
    </div>
}
addPropertyControls(MillGardenOrbit,{
    showApartmentData:{type:ControlType.Boolean,title:"Apartment data",defaultValue:true},
    apartmentDataUrl:{type:ControlType.String,title:"Apartment JSON",defaultValue:"https://raw.githubusercontent.com/UnbuiltMarket/mill-garden/main/data/apartments.json",hidden:p=>!p.showApartmentData},
    detailDataUrl:{type:ControlType.String,title:"Details JSON",defaultValue:"https://raw.githubusercontent.com/UnbuiltMarket/mill-garden/main/data/apartment-details.json",hidden:p=>!p.showApartmentData},
    maskPaletteUrl:{type:ControlType.String,title:"Mask colors JSON",defaultValue:"https://raw.githubusercontent.com/UnbuiltMarket/mill-garden/main/data/apartment-mask-colors.json",hidden:p=>!p.showApartmentData},''',1)
source=source.replace('title:"Camera stops",defaultValue:8','title:"Camera stops",defaultValue:4')
source+='\n'+(ROOT/'framer/apartment-panel.fragment.tsx').read_text(encoding='utf-8')
path.write_text(source,encoding='utf-8')
print('Prepared Framer component with GitHub data loader and apartment panel.')
