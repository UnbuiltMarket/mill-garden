interface MGApartment {
    id: string; name: string; building: string; floor: number; floorLabel: string;
    areaInterior: number; areaTerrace: number | null; areaGarden: number | null;
    price: number | null; status: string; rooms: number | null; maskColor: string;
    roomList?: {id: string; name: string; area: number; kind: string}[]
}
interface MGDataset { apartments: MGApartment[]; priceAsOf: string | null }
function parseMillGardenApartments(value: unknown): MGDataset {
    const data = value as any
    if (!data || data.project?.id !== "mill-garden" || !Array.isArray(data.apartments) || !data.apartments.length || data.apartments.length > 1000) throw new Error("Invalid Mill Garden data")
    const ids = new Set<string>()
    const number = (v: unknown, optional = false): number | null => {
        if (optional && (v === null || v === undefined)) return null
        if (typeof v !== "number" || !Number.isFinite(v) || v < 0) throw new Error("Invalid apartment number")
        return v
    }
    const text = (v: unknown) => typeof v === "string" ? v.trim().slice(0,160) : ""
    const apartments = data.apartments.map((r: any): MGApartment => {
        const id = text(r?.id)
        if (!r || !/^[A-Za-z0-9._-]+$/.test(id) || ids.has(id)) throw new Error("Invalid or duplicate apartment ID")
        ids.add(id)
        const floor = number(r.floor)!
        if (!Number.isSafeInteger(floor) || !text(r.building) || !/^#[0-9a-f]{6}$/i.test(r.maskColor)) throw new Error("Invalid floor or color")
        if (!["available","sold","reserved","under_negotiation","unknown"].includes(r.status)) throw new Error("Invalid status")
        const roomList = Array.isArray(r.roomList) ? r.roomList.map((room: any, i: number) => ({id:text(room.id)||id+"-"+i,name:text(room.name),area:number(room.area)!,kind:room.kind==="exterior"?"exterior":"interior"})) : undefined
        return {id,name:text(r.name)||id,building:text(r.building),floor,floorLabel:text(r.floorLabel),areaInterior:number(r.areaInterior)!,areaTerrace:number(r.areaTerrace,true),areaGarden:number(r.areaGarden,true),price:number(r.price,true),status:r.status,rooms:number(r.rooms,true),maskColor:r.maskColor.toUpperCase(),...(roomList?{roomList}:{})}
    })
    return {apartments,priceAsOf:text(data.project.priceAsOf)||null}
}
function joinMillGardenPalette(data: MGDataset, value: unknown): MGDataset {
    const p = value as any
    if (!p || p.projectId!=="mill-garden" || !Array.isArray(p.apartments)) throw new Error("Invalid mask palette")
    const colors = new Map<string,string>(), used = new Set<string>()
    for (const r of p.apartments) {
        if (!r || typeof r.id!=="string" || colors.has(r.id) || !/^#[0-9a-f]{6}$/i.test(r.maskColor)) throw new Error("Invalid mask entry")
        const color = r.maskColor.toUpperCase()
        if (used.has(color) || ["#000000","#FFFFFF"].includes(color)) throw new Error("Duplicate or reserved mask color")
        colors.set(r.id,color); used.add(color)
    }
    if (colors.size!==data.apartments.length) throw new Error("Palette count mismatch")
    for (const r of data.apartments) if (colors.get(r.id)!==r.maskColor) throw new Error("Palette color mismatch")
    return data
}
async function fetchMillGardenJson(url: string, signal: AbortSignal): Promise<unknown> {
    const parsed = new URL(url)
    if (parsed.protocol!=="https:" && !(parsed.protocol==="http:" && ["localhost","127.0.0.1"].includes(parsed.hostname))) throw new Error("HTTPS data URL required")
    const response = await fetch(parsed.href,{signal,mode:"cors",credentials:"omit",cache:"no-cache",headers:{Accept:"application/json"}})
    if (!response.ok) throw new Error("Apartment request failed: "+response.status)
    return response.json()
}
function useMillGardenJson<T>(key: string, enabled: boolean, load: (signal: AbortSignal)=>Promise<T>) {
    const loader = React.useRef(load); loader.current=load
    const [attempt,setAttempt]=React.useState(0)
    const [state,setState]=React.useState<{key:string;data:T|null;status:"loading"|"ready"|"error";error:boolean}>({key:"",data:null,status:"loading",error:false})
    React.useEffect(()=>{
        if (!enabled) return
        let disposed=false,pending=false,controller:AbortController|null=null,timer:ReturnType<typeof setTimeout>|undefined
        async function refresh() {
            if (disposed||pending) return
            pending=true;controller=new AbortController()
            timer=setTimeout(()=>controller?.abort(),15000)
            setState(p=>p.key===key&&p.data?p:{key,data:null,status:"loading",error:false})
            try {const data=await loader.current(controller.signal);if(!disposed)setState({key,data,status:"ready",error:false})}
            catch {if(!disposed)setState(p=>({key,data:p.key===key?p.data:null,status:"error",error:true}))}
            finally {clearTimeout(timer);pending=false}
        }
        const refreshVisible=()=>{if(!document.hidden)void refresh()}
        void refresh()
        const interval=setInterval(refreshVisible,300000)
        window.addEventListener("focus",refreshVisible);document.addEventListener("visibilitychange",refreshVisible)
        return ()=>{disposed=true;controller?.abort();clearTimeout(timer);clearInterval(interval);window.removeEventListener("focus",refreshVisible);document.removeEventListener("visibilitychange",refreshVisible)}
    },[key,enabled,attempt])
    return {...(state.key===key?state:{key,data:null,status:"loading" as const,error:false}),retry:()=>setAttempt(n=>n+1)}
}
function MillGardenApartmentPanel({apartmentDataUrl,detailDataUrl,maskPaletteUrl,enabled}:{apartmentDataUrl:string;detailDataUrl:string;maskPaletteUrl:string;enabled:boolean}) {
    const [building,setBuilding]=React.useState(""),[floor,setFloor]=React.useState(""),[selectedId,setSelectedId]=React.useState(""),[roomsOpen,setRoomsOpen]=React.useState(false)
    const uid=React.useId()
    const key=JSON.stringify([apartmentDataUrl.trim(),maskPaletteUrl.trim()])
    const catalog=useMillGardenJson<MGDataset>(key,enabled,async signal=>{
        const [data,palette]=await Promise.all([fetchMillGardenJson(apartmentDataUrl.trim(),signal),fetchMillGardenJson(maskPaletteUrl.trim(),signal)])
        return joinMillGardenPalette(parseMillGardenApartments(data),palette)
    })
    const all=catalog.data?.apartments||[]
    const buildings=[...new Set(all.map(a=>a.building))].sort((a,b)=>a.localeCompare(b,"hu",{numeric:true}))
    const b=buildings.includes(building)?building:""
    const inBuilding=all.filter(a=>!b||a.building===b)
    const floors=[...new Set(inBuilding.map(a=>a.floor))].sort((a,b)=>a-b)
    const f=floors.some(n=>String(n)===floor)?floor:""
    const filtered=inBuilding.filter(a=>f===""||String(a.floor)===f)
    const apartment=filtered.find(a=>a.id===selectedId)||filtered[0]||null
    const details=useMillGardenJson<MGDataset>(detailDataUrl.trim(),enabled&&roomsOpen&&!!apartment,async signal=>parseMillGardenApartments(await fetchMillGardenJson(detailDataUrl.trim(),signal)))
    const detail=details.data?.apartments.find(a=>a.id===apartment?.id)
    const rooms=detail&&detail.maskColor===apartment?.maskColor?detail.roomList:undefined
    const area=(n:number|null)=>n===null?"—":new Intl.NumberFormat("hu-HU",{maximumFractionDigits:2}).format(n)+" m²"
    const statuses:Record<string,string>={available:"Elérhető",sold:"Eladva",reserved:"Foglalt",under_negotiation:"Tárgyalás alatt",unknown:"Érdeklődjön"}
    const field:React.CSSProperties={display:"flex",flexDirection:"column",gap:7,minWidth:145,flex:"1 1 145px",fontSize:12,color:"#526f79"}
    const select:React.CSSProperties={width:"100%",minHeight:42,border:"1px solid #d5dcde",borderRadius:12,background:"#fff",color:"#17252a",padding:"9px 12px",font:"inherit",boxSizing:"border-box"}
    const action:React.CSSProperties={border:"1px solid #d5dcde",borderRadius:12,background:"#fff",color:"#526f79",padding:"10px 16px",font:"inherit",fontSize:12,cursor:"pointer"}
    const reset=()=>{setSelectedId("");setRoomsOpen(false)}
    return <section data-orbit-ignore data-mill-garden-apartments data-load-state={catalog.status} aria-label="Mill Garden lakásválasztó" style={{padding:"20px 24px 24px",marginBottom:8,border:"1px solid #e1e7e7",borderRadius:24,background:"#f8faf9",display:"flex",flexDirection:"column",gap:18}}>
        <div style={{display:"flex",flexWrap:"wrap",gap:14}}>
            <label htmlFor={uid+"-building"} style={field}>Épület / ütem<select id={uid+"-building"} value={b} disabled={!all.length} onChange={e=>{setBuilding(e.target.value);setFloor("");reset()}} style={select}><option value="">Összes épület</option>{buildings.map(n=><option key={n} value={n}>{n}. {n==="4"?"ütem":"épület"}</option>)}</select></label>
            <label htmlFor={uid+"-floor"} style={field}>Szint<select id={uid+"-floor"} value={f} disabled={!all.length} onChange={e=>{setFloor(e.target.value);reset()}} style={select}><option value="">Összes szint</option>{floors.map(n=><option key={n} value={n}>{b?inBuilding.find(a=>a.floor===n)?.floorLabel:n===0?"Földszint":n===1?"1. emelet":"2. emelet / tetőszint"}</option>)}</select></label>
            <label htmlFor={uid+"-apartment"} style={{...field,flex:"2 1 220px"}}>Lakás<select id={uid+"-apartment"} value={apartment?.id||""} disabled={!filtered.length} onChange={e=>{setSelectedId(e.target.value);setRoomsOpen(false)}} style={select}>{!filtered.length&&<option value="">Lakás kiválasztása</option>}{filtered.map(a=><option key={a.id} value={a.id}>{a.name} · {area(a.areaInterior)} · {statuses[a.status]}</option>)}</select></label>
        </div>
        {!catalog.data&&!catalog.error&&<p role="status" style={{margin:0,fontSize:12,color:"#526f79"}}>{enabled?"Lakásadatok betöltése…":"Lakásadatok az élő előnézetben érhetők el."}</p>}
        {catalog.error&&<div role="alert" style={{display:"flex",gap:12,alignItems:"center",flexWrap:"wrap",fontSize:12}}><span>{catalog.data?"A lakásadatok frissítése nem sikerült.":"A lakásadatok nem tölthetők be."}</span><button type="button" style={action} onClick={catalog.retry}>Újrapróbálom</button></div>}
        {apartment&&<article data-apartment-id={apartment.id} data-mask-color={apartment.maskColor} style={{display:"flex",flexDirection:"column",gap:14}}>
            <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",gap:16,flexWrap:"wrap"}}><div style={{display:"flex",alignItems:"center",gap:10}}><span aria-hidden="true" style={{width:14,height:14,borderRadius:4,background:apartment.maskColor,border:"1px solid #17252a22",flexShrink:0}}/><h3 style={{fontSize:18,fontWeight:500,margin:0}}>{apartment.name}</h3></div><span style={{fontSize:12,color:"#526f79"}}>{statuses[apartment.status]}</span></div>
            <dl style={{display:"flex",gap:"16px 30px",flexWrap:"wrap",margin:0}}>{[["Lakótér",area(apartment.areaInterior)],["Terasz",area(apartment.areaTerrace)],["Kert",area(apartment.areaGarden)],["Szobák",apartment.rooms??"—"],["Bruttó ár",apartment.price===null?"Érdeklődjön":new Intl.NumberFormat("hu-HU",{style:"currency",currency:"HUF",maximumFractionDigits:0}).format(apartment.price)]].map(([label,value])=><div key={String(label)}><dt style={{fontSize:11,color:"#526f79",marginBottom:5}}>{label}</dt><dd style={{margin:0,fontSize:16}}>{value}</dd></div>)}</dl>
            <div><button type="button" style={action} aria-expanded={roomsOpen} aria-controls={uid+"-rooms"} onClick={()=>setRoomsOpen(v=>!v)}>{roomsOpen?"Helyiségek bezárása":"Helyiségek és területek"}</button></div>
            {roomsOpen&&<div id={uid+"-rooms"}>{details.status==="loading"&&!rooms&&<p role="status" style={{fontSize:12}}>Helyiségek betöltése…</p>}{(details.error||details.status==="ready"&&!rooms)&&<div role="alert" style={{fontSize:12,display:"flex",gap:12,alignItems:"center",flexWrap:"wrap"}}><span>A helyiségadatok nem tölthetők be.</span><button type="button" style={action} onClick={details.retry}>Újrapróbálom</button></div>}{rooms&&<dl style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(160px,1fr))",gap:"12px 24px",margin:0}}>{rooms.map(r=><div key={r.id}><dt style={{fontSize:12,color:"#526f79"}}>{r.name}</dt><dd style={{fontSize:14,margin:"4px 0 0"}}>{area(r.area)}</dd></div>)}</dl>}</div>}
            {catalog.data?.priceAsOf&&<p style={{fontSize:11,color:"#526f79",margin:0}}>Árak és státuszok forrása: {catalog.data.priceAsOf==="2026-07"?"2026. júliusi tájékoztató":catalog.data.priceAsOf}. Az aktuális elérhetőségről érdeklődjön.</p>}
        </article>}
    </section>
}
