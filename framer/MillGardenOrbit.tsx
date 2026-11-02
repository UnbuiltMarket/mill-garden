
import * as React from "react"
import { addPropertyControls, ControlType, useIsStaticRenderer } from "framer"

interface MillGardenOrbitProps {
    style?: React.CSSProperties
    tallPhone?: boolean
    phoneHeight?: number
    frames?: string[]
    folderUrl?: string
    extension?: "jpg" | "avif" | "webp"
    prefix?: string
    frameCount?: number
    digits?: number
    firstNumber?: number
    title?: string
    caption?: string
    cameraStops?: number
    duration?: number
    introMode?: "none" | "video" | "frames"
    introVideo?: string
    introFrames?: string[]
    introFps?: number
    showApartmentData?: boolean
    apartmentDataUrl?: string
    detailDataUrl?: string
    maskPaletteUrl?: string
}
const normalizeImages = (values: unknown): string[] => Array.isArray(values) ? values.map((item: any) => typeof item === "string" ? item : item?.src || item?.url || "").filter(Boolean) : []
type Player = ReturnType<typeof createOrbitPlayer>

/**
 * Mill Garden's embedded orbit, reusing Admiral Park's buffered canvas player.
 * Optional opening sequence ends at the exact first orbit frame; SEQ_02 is omitted.
 * @framerSupportedLayoutWidth any
 * @framerSupportedLayoutHeight auto
 */
export default function MillGardenOrbit(props: MillGardenOrbitProps) {
    const {style, tallPhone = false, phoneHeight = 72, cameraStops = 4, duration = 1.5, introMode = "none", introVideo = "", introFps = 25} = props
    const { showApartmentData = true, apartmentDataUrl = "https://raw.githubusercontent.com/UnbuiltMarket/mill-garden/main/data/apartments.json", detailDataUrl = "https://raw.githubusercontent.com/UnbuiltMarket/mill-garden/main/data/apartment-details.json", maskPaletteUrl = "https://raw.githubusercontent.com/UnbuiltMarket/mill-garden/main/data/apartment-mask-colors.json" } = props
    const staticRenderer = useIsStaticRenderer()
    const retryOrbit = React.useRef<(() => void) | null>(null)
    const root = React.useRef<HTMLDivElement>(null)
    const canvas = React.useRef<HTMLCanvasElement>(null)
    const introCanvas = React.useRef<HTMLCanvasElement>(null)
    const video = React.useRef<HTMLVideoElement>(null)
    const player = React.useRef<Player | null>(null)
    const advanceIntro = React.useRef<(() => void) | null>(null)
    const [near, setNear] = React.useState(false)
    const [active, setActive] = React.useState(false)
    const [introDone, setIntroDone] = React.useState(false)
    const [snapshot, setSnapshot] = React.useState<OrbitSnapshot | null>(null)
    const [failure, setFailure] = React.useState("")
    const framesKey = JSON.stringify(props.frames || [])
    const introKey = JSON.stringify(props.introFrames || [])
    const urls = React.useMemo(() => {
        if (props.folderUrl?.trim()) {
            const base = props.folderUrl.trim().replace(/\/+$/, "")
            const count = Math.max(1, Math.min(1000, Math.round(props.frameCount || 80)))
            const start = Math.max(0, Math.round(props.firstNumber || 0))
            const digits = Math.max(1, Math.min(8, Math.round(props.digits || 4)))
            return Array.from({length:count}, (_, i) => base + "/" + (props.prefix || "orbit") + String(start + i).padStart(digits, "0") + "." + (props.extension || "jpg"))
        }
        return normalizeImages(props.frames)
    }, [framesKey, props.folderUrl, props.frameCount, props.firstNumber, props.digits, props.prefix, props.extension])
    const opening = React.useMemo(() => normalizeImages(props.introFrames), [introKey])
    const hasIntro = introMode === "video" ? !!introVideo : introMode === "frames" && opening.length > 0
    const stops = Math.max(1, Math.min(urls.length || 8, Math.round(cameraStops)))
    React.useEffect(() => {
        if (staticRenderer || !root.current) return
        const observer = new IntersectionObserver(entries => {
            if (entries.some(entry => entry.isIntersecting)) {setNear(true);observer.disconnect()}
        }, {rootMargin:"300px"})
        observer.observe(root.current)
        return () => observer.disconnect()
    }, [staticRenderer])
    React.useEffect(() => {
        if (staticRenderer || !near || !root.current || !canvas.current || !urls.length) return
        let disposed = false, introCancelled = false, switching = false, pendingRAF = 0
        const openingImages: HTMLImageElement[] = []
        const openingController = new AbortController()
        setActive(false);setIntroDone(false);setFailure("");setSnapshot(null)
        const p = createOrbitPlayer({root:root.current,canvas:canvas.current,urls,startFrame:0,checkpointCount:stops,bufferCheckpoints:2,decodeWidth:960,inspectionWidth:1920,snapDuration:duration,frameBlend:0,
            onUpdate:value => {if(!disposed){setSnapshot(value);if(value.state==="error")setFailure("A körpanoráma betöltése nem sikerült. Próbálja újra.")}}
        })
        player.current=p
        let prepared=p.prepare()
        prepared.catch(error => {if(!disposed)setFailure("A körpanoráma betöltése nem sikerült. Próbálja újra.")})
        async function showOrbit() {
            if(disposed || switching) return
            switching=true;introCancelled=true
            if(pendingRAF)cancelAnimationFrame(pendingRAF)
            try {
                await prepared
                if(disposed)return
                // The first parked frame is drawn before the opening layer is removed.
                await p.activate(0)
                if(disposed)return
                p.redraw()
                pendingRAF=requestAnimationFrame(()=>{if(!disposed){setIntroDone(true);setActive(true);video.current?.pause();openingImages.forEach(image=>{image.src=""});openingImages.length=0}})
            } catch {switching=false;if(!disposed)setFailure("A körpanoráma betöltése nem sikerült.")}
        }
        advanceIntro.current=()=>{video.current?.pause();void showOrbit()}
        retryOrbit.current=()=>{switching=false;setFailure("");prepared=p.retry().then(()=>{});prepared.catch(()=>{if(!disposed)setFailure("A képek továbbra sem érhetők el.")});void showOrbit()}
        const reduce=window.matchMedia("(prefers-reduced-motion: reduce)").matches
        if(!hasIntro || reduce)void showOrbit()
        else if(introMode==="video") {
            const element=video.current
            if(element) {
                const enter=()=>{if(!disposed&&!introCancelled)element.play().catch(()=>{if(!disposed)setFailure("A bevezető indításához koppintson a Lejátszás gombra.")})}
                const intersection=new IntersectionObserver(entries=>{if(entries.some(e=>e.isIntersecting)){enter();intersection.disconnect()}},{threshold:.2})
                if(root.current)intersection.observe(root.current)
                openingController.signal.addEventListener("abort",()=>intersection.disconnect(),{once:true})
            }
        } else {
            void (async()=>{
                try {
                    for(const url of opening) {
                        if(disposed||introCancelled)return
                        const image=new Image();image.decoding="async"
                        await new Promise<void>((resolve,reject)=>{image.onload=()=>resolve();image.onerror=()=>reject(new Error("Opening frame unavailable"));image.src=url})
                        openingImages.push(image)
                    }
                    if(disposed||introCancelled)return
                    const c=introCanvas.current, context=c?.getContext("2d")
                    if(!c||!context)return
                    let start=0
                    const fps=Math.max(1,Math.min(60,introFps))
                    function render(now:number) {
                        if(disposed||introCancelled||!c||!context)return
                        if(!start)start=now
                        const index=Math.min(openingImages.length-1,Math.floor((now-start)*fps/1000))
                        const image=openingImages[index], rect=c.getBoundingClientRect(), dpr=Math.min(devicePixelRatio||1,2)
                        c.width=Math.max(1,Math.round(rect.width*dpr));c.height=Math.max(1,Math.round(rect.height*dpr))
                        context.fillStyle="#f4f4f1";context.fillRect(0,0,c.width,c.height)
                        const scale=Math.max(c.width/image.naturalWidth,c.height/image.naturalHeight),w=image.naturalWidth*scale,h=image.naturalHeight*scale
                        context.drawImage(image,(c.width-w)/2,(c.height-h)/2,w,h)
                        if(index===openingImages.length-1)void showOrbit()
                        else pendingRAF=requestAnimationFrame(render)
                    }
                    pendingRAF=requestAnimationFrame(render)
                } catch {if(!disposed){setFailure("A bevezető nem tölthető be. A körpanoráma közvetlenül is megnyitható.")}}
            })()
        }
        return ()=>{disposed=true;introCancelled=true;openingController.abort();advanceIntro.current=null;retryOrbit.current=null;if(pendingRAF)cancelAnimationFrame(pendingRAF);video.current?.pause();openingImages.forEach(image=>{image.onload=null;image.onerror=null;image.src=""});p.destroy();if(player.current===p)player.current=null}
    }, [staticRenderer,near,urls,stops,duration,introMode,introVideo,introKey,introFps,hasIntro])
    const current = snapshot?.checkpoint !== undefined && snapshot.checkpoint >= 0 ? snapshot.checkpoint : Math.floor(((snapshot?.frame || 0) / Math.max(1,urls.length)) * stops) % stops
    const parked = active && snapshot?.state === "checkpoint"
    const loading = !active && (!hasIntro || introDone)
    const button: React.CSSProperties={border:"1px solid #d5dcde",borderRadius:999,background:"#fff",color:"#15242a",width:42,height:42,display:"inline-flex",alignItems:"center",justifyContent:"center",cursor:"pointer",fontFamily:"inherit",fontSize:18,flexShrink:0}
    const poster = urls[0] || ""
    return <div ref={root} tabIndex={0} role="region" aria-label="Mill Garden interaktív körpanoráma" style={{...style,width:style?.width||"100%",height:"auto",position:"relative",display:"flex",flexDirection:"column",overflow:"hidden",background:"transparent",borderRadius:28,fontFamily:"Inter, sans-serif",color:"#17252a",outlineOffset:-4}}>
        <div style={{position:"relative",width:"100%",height:tallPhone ? Math.max(40,Math.min(85,phoneHeight))+"svh" : undefined,maxHeight:tallPhone ? 680 : undefined,aspectRatio:tallPhone ? undefined : "16 / 9",flex:"0 0 auto",minHeight:tallPhone ? 300 : 0,overflow:"hidden",borderRadius:28,background:"#f4f4f1"}}>
            {poster&&<img src={poster} alt="A Mill Garden épületegyüttese, az első orbit nézőpontból" draggable={false} style={{position:"absolute",inset:0,width:"100%",height:"100%",objectFit:"cover",opacity:active?0:1}}/>}
            <canvas ref={canvas} aria-hidden="true" style={{position:"absolute",inset:0,width:"100%",height:"100%",display:"block",opacity:active?1:0,touchAction:"pan-y pinch-zoom"}}/>
            {hasIntro&&!introDone&&introMode==="video"&&<video ref={video} src={introVideo} autoPlay={near} muted playsInline preload="metadata" onEnded={()=>advanceIntro.current?.()} onError={()=>setFailure("A bevezető nem tölthető be. Nyissa meg közvetlenül a körpanorámát.")} style={{position:"absolute",inset:0,width:"100%",height:"100%",objectFit:"cover"}}/>}
            {hasIntro&&!introDone&&introMode==="frames"&&<canvas ref={introCanvas} aria-hidden="true" style={{position:"absolute",inset:0,width:"100%",height:"100%",display:"block"}}/>}
            {!staticRenderer&&hasIntro&&!introDone&&<div data-orbit-ignore style={{position:"absolute",right:16,bottom:16,display:"flex",gap:8}}>
                {introMode==="video"&&<button type="button" onClick={()=>{setFailure("");video.current?.play().catch(()=>setFailure("A videó nem indítható el."))}} style={{...button,width:"auto",fontSize:12,padding:"0 16px"}}>Lejátszás</button>}
                <button type="button" onClick={()=>advanceIntro.current?.()} style={{...button,width:"auto",fontSize:12,padding:"0 16px"}}>Körpanoráma megnyitása</button>
            </div>}
            {!staticRenderer&&loading&&!failure&&<div role="status" style={{position:"absolute",left:"50%",top:"50%",transform:"translate(-50%,-50%)",background:"rgba(255,255,255,.93)",padding:"12px 18px",borderRadius:999,fontSize:12,boxShadow:"0 2px 18px #17252a12"}}>Körpanoráma betöltése{snapshot?.total ? " · "+Math.round(snapshot.downloaded/snapshot.total*100)+"%" : "…"}</div>}
            {failure&&<div role="alert" data-orbit-ignore style={{position:"absolute",bottom:12,left:16,right:16,padding:14,background:"#fff",borderRadius:12,fontSize:12,display:"flex",alignItems:"center",gap:12,flexWrap:"wrap"}}>
                <span>{failure}</span><button type="button" style={{...button,width:"auto",fontSize:12,padding:"0 16px"}} onClick={()=>retryOrbit.current?.()}>Újrapróbálom</button>
            </div>}
        </div>
        <div data-orbit-ignore style={{padding:"16px 0px 20px",display:"flex",flexDirection:"column",alignItems:"center",gap:12,flexShrink:0}}>
            <div style={{display:"flex",alignItems:"center",justifyContent:"center",gap:4,flexWrap:"nowrap",width:"100%"}}>
                <button type="button" aria-label="Előző nézőpont" disabled={!parked} onClick={()=>player.current?.go(-1)} style={{...button,width:32,opacity:parked?1:.45}}>←</button>
                {Array.from({length:stops},(_,i)=><button type="button" key={i} aria-label={(i+1)+". nézőpont"} aria-pressed={current===i} disabled={!parked} onClick={()=>player.current?.setCheckpoint(i)} style={{...button,width:24,height:36,fontSize:11,borderColor:current===i?"#526f79":"transparent",background:current===i?"#526f79":"transparent",color:current===i?"white":"#526f79",opacity:active||staticRenderer?1:.45}}>{String(i+1).padStart(2,"0")}</button>)}
                <button type="button" aria-label="Következő nézőpont" disabled={!parked} onClick={()=>player.current?.go(1)} style={{...button,width:32,opacity:parked?1:.45}}>→</button>
                {active&&snapshot?.state==="paused"&&<button type="button" onClick={()=>player.current?.resume()} style={{...button,width:"auto",fontSize:12,padding:"0 16px"}}>Folytatás</button>}
            </div>
        </div>
        {showApartmentData && <MillGardenApartmentPanel apartmentDataUrl={apartmentDataUrl} detailDataUrl={detailDataUrl} maskPaletteUrl={maskPaletteUrl} enabled={near || staticRenderer} />}
    </div>
}
addPropertyControls(MillGardenOrbit,{
    showApartmentData:{type:ControlType.Boolean,title:"Apartment data",defaultValue:true},
    apartmentDataUrl:{type:ControlType.String,title:"Apartment JSON",defaultValue:"https://raw.githubusercontent.com/UnbuiltMarket/mill-garden/main/data/apartments.json",hidden:p=>!p.showApartmentData},
    detailDataUrl:{type:ControlType.String,title:"Details JSON",defaultValue:"https://raw.githubusercontent.com/UnbuiltMarket/mill-garden/main/data/apartment-details.json",hidden:p=>!p.showApartmentData},
    maskPaletteUrl:{type:ControlType.String,title:"Mask colors JSON",defaultValue:"https://raw.githubusercontent.com/UnbuiltMarket/mill-garden/main/data/apartment-mask-colors.json",hidden:p=>!p.showApartmentData},
    tallPhone:{type:ControlType.Boolean,title:"Tall phone view",defaultValue:false},
    phoneHeight:{type:ControlType.Number,title:"Phone image height",defaultValue:72,min:40,max:85,step:1,unit:"vh",hidden:p=>!p.tallPhone},
    title:{type:ControlType.String,title:"Heading",defaultValue:"",hidden:()=>true},
    caption:{type:ControlType.String,title:"Hint",defaultValue:"",hidden:()=>true},
    frames:{type:ControlType.Array,title:"Orbit frames",control:{type:ControlType.Image},maxCount:1000},
    folderUrl:{type:ControlType.String,title:"Frame folder",defaultValue:"",description:"Optional hosted folder. Overrides the imported frame list."},
    extension:{type:ControlType.Enum,title:"Image format",options:["jpg","avif","webp"],defaultValue:"jpg",hidden:p=>!p.folderUrl},
    prefix:{type:ControlType.String,title:"Filename prefix",defaultValue:"orbit",hidden:p=>!p.folderUrl},
    frameCount:{type:ControlType.Number,title:"Frame count",defaultValue:80,min:1,max:1000,step:1,hidden:p=>!p.folderUrl},
    digits:{type:ControlType.Number,title:"Number digits",defaultValue:4,min:1,max:8,step:1,hidden:p=>!p.folderUrl},
    firstNumber:{type:ControlType.Number,title:"First number",defaultValue:0,min:0,step:1,hidden:p=>!p.folderUrl},
    cameraStops:{type:ControlType.Number,title:"Camera stops",defaultValue:4,min:1,max:16,step:1},
    duration:{type:ControlType.Number,title:"Turn duration",defaultValue:1.5,min:.2,max:5,step:.1,unit:"s"},
    introMode:{type:ControlType.Enum,title:"Sequence 1",options:["none","video","frames"],optionTitles:["Orbit only","Video","Image sequence"],defaultValue:"none",description:"The final opening frame should match orbit0000. There is no sequence 2."},
    introVideo:{type:ControlType.File,title:"Opening video",allowedFileTypes:["mp4","webm"],hidden:p=>p.introMode!=="video"},
    introFrames:{type:ControlType.Array,title:"Opening frames",control:{type:ControlType.Image},maxCount:1000,hidden:p=>p.introMode!=="frames"},
    introFps:{type:ControlType.Number,title:"Opening FPS",defaultValue:25,min:1,max:60,step:1,hidden:p=>p.introMode!=="frames"}
})


// Reused from Admiral Park: buffered orbit engine; input scoped for embedded use.
type OrbitState =
    | "idle"
    | "loading"
    | "buffering"
    | "moving"
    | "settling"
    | "checkpoint"
    | "paused"
    | "error"

interface OrbitSnapshot {
    state: OrbitState
    frame: number
    checkpoint: number
    direction: number
    ready: number
    total: number
    decoded: number
    downloaded: number
    buffered: number
    bufferTotal: number
    requiredReady: number
    requiredTotal: number
    position: number
    target?: number
    userPaused: boolean
    suspended: boolean
    error?: string
}

interface OrbitRestoration {
    position: number
    target?: number
    paused?: boolean
    direction?: number
}

interface OrbitOptions {
    root: HTMLElement
    canvas: HTMLCanvasElement
    urls: string[]
    decodeWidth?: number
    inspectionWidth?: number
    checkpointCount?: number
    bufferCheckpoints?: number
    startFrame?: number
    snapDuration?: number
    frameBlend?: number
    focalX?: number
    focalY?: number
    /** Logical CSS dimensions before a surrounding scene transform. */
    renderBounds?: () => { width: number; height: number } | null
    /** Optional fixed pixel allocation while the logical scene changes shape. */
    backingSize?: () => { width: number; height: number } | null
    /** Map physical pointer coordinates into the transformed scene's logical space. */
    inputPoint?: (clientX: number, clientY: number) => { x: number; y: number }
    inputBounds?: () => {
        left: number
        top: number
        width: number
        height: number
    } | null
    /** Optional image rectangle in CSS pixels, independent of the full canvas backing size. */
    viewport?: (bounds: {
        width: number
        height: number
    }) => { x: number; y: number; width: number; height: number } | null
    onUpdate?: (snapshot: OrbitSnapshot) => void
}

interface OrbitBitmap {
    image: CanvasImageSource
    width: number
    height: number
    close: () => void
}

const orbitClamp = (value: number, minimum: number, maximum: number) =>
    Math.min(maximum, Math.max(minimum, value))
const orbitModulo = (value: number, size: number) =>
    ((value % size) + size) % size

/** Keep every compressed file, a bounded checkpoint window, and one optional sharp parked view. */
function createOrbitPlayer(options: OrbitOptions) {
    const { root, canvas } = options
    const urls = [...options.urls],
        total = urls.length
    const startFrame = Math.round(
        orbitClamp(
            Number.isFinite(options.startFrame) ? options.startFrame! : 0,
            0,
            Math.max(0, total - 1)
        )
    )
    const motionWidth = Math.round(
        orbitClamp(options.decodeWidth ?? 960, 240, 1920)
    )
    const inspectionWidth = Math.round(
        orbitClamp(options.inspectionWidth ?? 1920, motionWidth, 3840)
    )
    const checkpointCount = Math.round(
        orbitClamp(options.checkpointCount ?? 8, 1, Math.max(1, total))
    )
    const checkpoints = Array.from({ length: checkpointCount }, (_, index) =>
        Math.round((index * total) / checkpointCount)
    )
    const bufferCheckpoints = Math.round(
        orbitClamp(
            options.bufferCheckpoints ?? 2,
            1,
            Math.max(1, Math.floor(checkpointCount / 2))
        )
    )
    const snapDuration = orbitClamp(options.snapDuration ?? 1.5, 0.15, 10)
    const frameBlend = orbitClamp(options.frameBlend ?? 0, 0, 1)
    const focalX = orbitClamp(options.focalX ?? 0.5, 0, 1),
        focalY = orbitClamp(options.focalY ?? 0.5, 0, 1)
    const context = canvas.getContext("2d", { alpha: false })
    const cancellation = new AbortController()
    const blobs = new Map<number, Blob>(),
        frames = new Map<number, OrbitBitmap>()
    const fetching = new Set<number>(),
        decoding = new Set<number>()
    const fetchFailed = new Map<number, string>(),
        decodeFailed = new Map<number, string>(),
        refresh = new Set<number>()
    const reducedQuery =
        typeof matchMedia === "function"
            ? matchMedia("(prefers-reduced-motion: reduce)")
            : null
    const originalTouchAction = canvas.style.touchAction
    let destroyed = false,
        started = false,
        prepared = false,
        preparing = false,
        active = false,
        activation = 0,
        visible = true,
        automaticPause = false
    let state: OrbitState = "idle",
        position = startFrame,
        entryFrame = startFrame,
        direction = 1,
        error: string | undefined
    let raf = 0,
        lastInputAt = -Infinity,
        lastWheelAt = -Infinity,
        wheelLatched = false,
        pausedAt = 0,
        suppressClickUntil = 0
    let preparePromise: Promise<void> | null = null,
        prepareResolve: (() => void) | null = null
    let prepareReject: ((reason: Error) => void) | null = null
    let inspection: OrbitBitmap | null = null,
        inspectionFrame = -1,
        inspectionGeneration = 0,
        qualityStartedAt = 0,
        inspectionDecoding = false,
        inspectionWanted = false
    let nativeDecodes = 0,
        decodeGeneration = 0
    let lastPaint = "",
        lastNotification = ""
    let residentFramesDirty = true,
        requiredFramesDirty = true
    let residentFramesText = "",
        requiredFramesText = ""
    let drag: {
        id: number
        x: number
        y: number
        moved: boolean
        triggered: boolean
    } | null = null
    let touchDragging = false
    let suspended = false,
        suspendedAt = 0
    let settling: {
        start: number
        target: number
        time: number
        duration: number
    } | null = null
    let pendingMove: {
        start: number
        target: number
        indices: number[]
    } | null = null
    let desired = new Set<number>(),
        required = new Set<number>(),
        priority: number[] = []
    let preparationRequired: number[] = [],
        errorWasPaused = false
    const waiters: Array<{
        indices: number[]
        token: number
        allDownloads: boolean
        resolve: () => void
        reject: (reason: Error) => void
    }> = []
    const frameAt = () => (total ? orbitModulo(Math.round(position), total) : 0)
    const canRun = () =>
        active &&
        !suspended &&
        !destroyed &&
        visible &&
        !document.hidden &&
        state !== "error"
    const inputAvailable = () =>
        active &&
        prepared &&
        !suspended &&
        !destroyed &&
        visible &&
        !document.hidden
    const fullyReady = () => prepared
    const reduced = () => !!reducedQuery?.matches

    function checkpointAt() {
        if (state !== "checkpoint" || total === 0) return -1
        const withinRing = orbitModulo(position, total)
        return checkpoints.findIndex(
            (value) =>
                Math.abs(value - withinRing) < 0.0001 ||
                Math.abs(value + total - withinRing) < 0.0001
        )
    }

    function snapshot(): OrbitSnapshot {
        return {
            state,
            frame: frameAt(),
            checkpoint: checkpointAt(),
            direction,
            ready: blobs.size,
            total,
            decoded: frames.size + (inspection ? 1 : 0),
            downloaded: blobs.size,
            buffered: frames.size,
            bufferTotal: desired.size,
            requiredReady: [...required].filter((index) => frames.has(index))
                .length,
            requiredTotal: required.size,
            position,
            target: pendingMove?.target ?? settling?.target,
            userPaused: state === "paused" && !automaticPause,
            suspended,
            ...(error ? { error } : {}),
        }
    }

    function setData(name: string, text: string) {
        if (root.dataset[name] !== text) root.dataset[name] = text
    }

    function notify() {
        if (destroyed) return
        const value = snapshot()
        // These attributes are also consumed by picking and Framer overlays. Keep
        // them current without scheduling MutationObserver work for unchanged data.
        setData("orbitState", state)
        setData("orbitFrame", String(value.frame))
        setData("orbitCheckpoint", String(value.checkpoint))
        setData("orbitReady", String(value.ready))
        setData("orbitDecoded", String(value.decoded))
        setData("orbitDownloaded", String(value.downloaded))
        setData("orbitPosition", position.toFixed(4))
        setData("orbitMotionWidth", String(motionWidth))
        setData(
            "orbitTarget",
            (pendingMove?.target ?? settling?.target ?? position).toFixed(4)
        )
        setData("orbitFrameBlend", String(frameBlend))
        setData("orbitLocked", String(!!settling || !!pendingMove))
        setData("orbitSuspended", String(suspended))
        setData("orbitBuffered", String(value.buffered))
        setData("orbitBufferTotal", String(value.bufferTotal))
        setData("orbitRequiredReady", String(value.requiredReady))
        setData("orbitRequiredTotal", String(value.requiredTotal))
        setData("orbitDecoding", String(nativeDecodes))
        setData("orbitCacheLimit", String(desired.size))
        setData("orbitBufferCheckpoints", String(bufferCheckpoints))
        if (residentFramesDirty) {
            residentFramesText = [...frames.keys()]
                .sort((a, b) => a - b)
                .join(",")
            residentFramesDirty = false
        }
        if (requiredFramesDirty) {
            requiredFramesText = [...required].sort((a, b) => a - b).join(",")
            requiredFramesDirty = false
        }
        setData("orbitResidentFrames", residentFramesText)
        setData("orbitRequiredFrames", requiredFramesText)
        const signature = [
            state,
            value.frame,
            value.checkpoint,
            direction,
            value.ready,
            value.decoded,
            value.bufferTotal,
            value.requiredReady,
            value.requiredTotal,
            position.toFixed(4),
            value.target,
            value.userPaused,
            suspended,
            error,
        ].join("|")
        if (signature !== lastNotification) {
            lastNotification = signature
            options.onUpdate?.(value)
        }
    }

    async function decodeBlob(blob: Blob, width: number): Promise<OrbitBitmap> {
        let expired = false
        nativeDecodes++
        const operation = (async () => {
            if (typeof createImageBitmap === "function") {
                try {
                    const image = await createImageBitmap(blob, {
                        resizeWidth: width,
                        resizeQuality: "high",
                    })
                    return {
                        image,
                        width: image.width,
                        height: image.height,
                        close: () => image.close(),
                    }
                } catch {
                    /* A resized canvas also works in browsers without AVIF ImageBitmap decoding. */
                }
            }
            const image = new Image(),
                objectURL = URL.createObjectURL(blob)
            try {
                image.decoding = "async"
                image.src = objectURL
                await new Promise<void>((resolve, reject) => {
                    const timer = setTimeout(() => {
                        image.src = ""
                        reject(new Error("Image decoding timed out"))
                    }, 12000)
                    const abort = () => {
                        clearTimeout(timer)
                        image.src = ""
                        reject(new Error("Orbit disposed"))
                    }
                    cancellation.signal.addEventListener("abort", abort, {
                        once: true,
                    })
                    const done = () => {
                        clearTimeout(timer)
                        cancellation.signal.removeEventListener("abort", abort)
                    }
                    image.decode().then(
                        () => {
                            done()
                            resolve()
                        },
                        (reason) => {
                            done()
                            reject(reason)
                        }
                    )
                })
                const surface = document.createElement("canvas")
                surface.width = Math.min(width, image.naturalWidth)
                surface.height = Math.max(
                    1,
                    Math.round(
                        (image.naturalHeight * surface.width) /
                            image.naturalWidth
                    )
                )
                const drawing = surface.getContext("2d", { alpha: false })
                if (!drawing) throw new Error("Canvas decoding is unavailable")
                drawing.drawImage(image, 0, 0, surface.width, surface.height)
                return {
                    image: surface,
                    width: surface.width,
                    height: surface.height,
                    close: () => {
                        surface.width = surface.height = 0
                    },
                }
            } finally {
                image.src = ""
                URL.revokeObjectURL(objectURL)
            }
        })()
        return await new Promise<OrbitBitmap>((resolve, reject) => {
            const timer = setTimeout(() => {
                expired = true
                reject(new Error("Image decoding timed out"))
            }, 15000)
            operation
                .then(
                    (bitmap) => {
                        clearTimeout(timer)
                        if (expired || destroyed) {
                            bitmap.close()
                            if (!expired) reject(new Error("Orbit disposed"))
                        } else resolve(bitmap)
                    },
                    (reason) => {
                        clearTimeout(timer)
                        if (!expired) reject(reason)
                    }
                )
                .finally(() => {
                    // ImageBitmap decoding cannot be cancelled. A watchdog may report
                    // an error, but its native permit stays held until the work settles.
                    nativeDecodes--
                    if (!destroyed) resourcesChanged()
                })
        })
    }

    function indicesBetween(start: number, end: number) {
        const result = new Set<number>()
        for (
            let index = Math.floor(Math.min(start, end));
            index <= Math.ceil(Math.max(start, end)) && result.size < total;
            index++
        )
            result.add(orbitModulo(index, total))
        return [...result]
    }

    function windowIndices(center: number, radius: number) {
        let left = center,
            right = center
        for (let step = 0; step < radius; step++) {
            left = nextCheckpoint(left, -1)
            right = nextCheckpoint(right, 1)
        }
        return indicesBetween(left, right)
    }

    function nearestFirst(indices: number[], center: number) {
        const wrapped = orbitModulo(center, total)
        const distance = (index: number) =>
            Math.min(
                orbitModulo(index - wrapped, total),
                orbitModulo(wrapped - index, total)
            )
        return [...indices].sort(
            (a, b) =>
                distance(a) - distance(b) ||
                orbitModulo(a - wrapped, total) -
                    orbitModulo(b - wrapped, total)
        )
    }

    function setBuffer(
        wanted: number[],
        essential: number[],
        first = essential
    ) {
        desired = new Set(wanted)
        if (
            essential.length !== required.size ||
            essential.some((index) => !required.has(index))
        ) {
            required = new Set(essential)
            requiredFramesDirty = true
        }
        priority = [...new Set([...first, ...wanted])].filter((index) =>
            desired.has(index)
        )
        for (const [index, bitmap] of frames)
            if (!desired.has(index)) {
                bitmap.close()
                frames.delete(index)
                residentFramesDirty = true
            }
        resourcesChanged()
    }

    function setRestBuffer(center: number, initial = false) {
        const near = nearestFirst(windowIndices(center, 1), center)
        const wanted = nearestFirst(
            windowIndices(center, bufferCheckpoints),
            center
        )
        setBuffer(
            wanted,
            initial ? near : [orbitModulo(Math.round(center), total)],
            near
        )
    }

    function fail(index: number) {
        if (state !== "error") errorWasPaused = state === "paused"
        error =
            "Could not prepare orbit frame " + index + ". Retry to continue."
        state = "error"
        if (raf) cancelAnimationFrame(raf)
        raf = 0
    }

    function failedIndex(indices: number[]) {
        return indices.find(
            (index) => fetchFailed.has(index) || decodeFailed.has(index)
        )
    }
    function framesReady(indices: number[]) {
        return indices.every((index) => frames.has(index))
    }

    function finishPreparation() {
        if (destroyed || !preparing) return
        const failure = fetchFailed.size
            ? [...fetchFailed.keys()][0]
            : failedIndex(preparationRequired)
        if (failure !== undefined) {
            fail(failure)
            const reject = prepareReject
            prepareResolve = prepareReject = null
            reject?.(new Error(error))
        } else if (blobs.size === total && framesReady(preparationRequired)) {
            preparing = false
            prepared = true
            error = undefined
            const resolve = prepareResolve
            prepareResolve = prepareReject = null
            if (!active) state = "idle"
            resolve?.()
        }
    }

    function finishWaiters() {
        for (let index = waiters.length - 1; index >= 0; index--) {
            const waiter = waiters[index],
                failure = failedIndex(waiter.indices)
            if (waiter.token !== activation) {
                waiters.splice(index, 1)
                waiter.resolve()
            } else if (
                failure !== undefined ||
                (waiter.allDownloads && fetchFailed.size)
            ) {
                waiters.splice(index, 1)
                waiter.reject(
                    new Error(
                        "Could not prepare orbit frame " +
                            (failure ?? [...fetchFailed.keys()][0])
                    )
                )
            } else if (
                framesReady(waiter.indices) &&
                (!waiter.allDownloads || blobs.size === total)
            ) {
                waiters.splice(index, 1)
                waiter.resolve()
            }
        }
    }

    function waitForFrames(
        indices: number[],
        token: number,
        allDownloads = false
    ) {
        return new Promise<void>((resolve, reject) => {
            waiters.push({ indices, token, allDownloads, resolve, reject })
            resourcesChanged()
        })
    }

    function resourcesChanged() {
        if (destroyed) return
        finishPreparation()
        finishWaiters()
        if (prepared && pendingMove) {
            const failure = failedIndex(pendingMove.indices)
            if (failure !== undefined) fail(failure)
            else tryStartPending()
        }
        notify()
        pump()
    }

    async function fetchFrame(index: number) {
        fetching.add(index)
        const request = new AbortController(),
            cancel = () => request.abort()
        const timer = setTimeout(cancel, 10000)
        cancellation.signal.addEventListener("abort", cancel, { once: true })
        try {
            const response = await fetch(urls[index], {
                signal: request.signal,
                mode: "cors",
                credentials: "omit",
                cache: refresh.has(index) ? "reload" : "force-cache",
            })
            if (!response.ok) throw new Error("HTTP " + response.status)
            const blob = await response.blob()
            if (!destroyed) {
                blobs.set(index, blob)
                refresh.delete(index)
            }
        } catch (reason) {
            if (!destroyed) fetchFailed.set(index, String(reason))
        } finally {
            clearTimeout(timer)
            cancellation.signal.removeEventListener("abort", cancel)
            fetching.delete(index)
            if (!destroyed) resourcesChanged()
        }
    }

    async function decodeFrame(index: number) {
        const generation = decodeGeneration
        decoding.add(index)
        try {
            const bitmap = await decodeBlob(blobs.get(index)!, motionWidth)
            if (
                destroyed ||
                generation !== decodeGeneration ||
                !desired.has(index)
            )
                bitmap.close()
            else {
                if (!frames.has(index)) residentFramesDirty = true
                frames.get(index)?.close()
                frames.set(index, bitmap)
            }
        } catch (reason) {
            if (!destroyed && generation === decodeGeneration)
                decodeFailed.set(index, String(reason))
        } finally {
            decoding.delete(index)
            if (!destroyed) resourcesChanged()
        }
    }

    function pump() {
        if (destroyed || !started) return
        const all = nearestFirst(
            urls.map((_, index) => index),
            position
        )
        const downloads = [...new Set([...required, ...priority, ...all])]
        for (const index of downloads) {
            if (fetching.size >= 4) break
            if (
                !blobs.has(index) &&
                !fetching.has(index) &&
                !fetchFailed.has(index)
            )
                void fetchFrame(index)
        }
        if (inspectionWanted) void prepareInspection()
        const allowed = prepared ? priority : preparationRequired
        for (const index of allowed) {
            if (
                nativeDecodes >= 2 ||
                decoding.size + (inspectionDecoding ? 1 : 0) >= 2
            )
                break
            if (
                desired.has(index) &&
                blobs.has(index) &&
                !frames.has(index) &&
                !decoding.has(index) &&
                !decodeFailed.has(index)
            )
                void decodeFrame(index)
        }
        notify()
    }

    /** Download the complete compressed orbit without allocating decoded frames. */
    function prefetch(): void {
        if (destroyed || started || !total) return
        started = true
        pump()
    }

    function prepare(): Promise<void> {
        if (destroyed) return Promise.reject(new Error("Orbit disposed"))
        if (prepared) return Promise.resolve()
        if (preparePromise) return preparePromise
        if (!total || !context) {
            state = "error"
            error = !total
                ? "No orbit frames were provided."
                : "Canvas rendering is unavailable."
            notify()
            return Promise.reject(new Error(error))
        }
        started = preparing = true
        state = "loading"
        error = undefined
        preparePromise = new Promise<void>((resolve, reject) => {
            prepareResolve = resolve
            prepareReject = reject
        })
        preparationRequired = nearestFirst(
            windowIndices(startFrame, 1),
            startFrame
        )
        setRestBuffer(startFrame, true)
        return preparePromise
    }

    function dropInspection() {
        inspectionGeneration++
        inspectionWanted = false
        inspection?.close()
        inspection = null
        inspectionFrame = -1
        qualityStartedAt = 0
        lastPaint = ""
    }

    async function prepareInspection() {
        const frame = frameAt(),
            blob = blobs.get(frame)
        const parked =
            state === "checkpoint" ||
            state === "buffering" ||
            (state === "paused" && !!pendingMove)
        if (
            !blob ||
            destroyed ||
            !active ||
            !parked ||
            inspectionWidth <= motionWidth ||
            inspectionFrame === frame
        ) {
            inspectionWanted = false
            return
        }
        inspectionWanted = true
        if (inspectionDecoding || decoding.size >= 2 || nativeDecodes >= 2)
            return
        inspectionWanted = false
        const generation = ++inspectionGeneration
        inspectionDecoding = true
        try {
            const bitmap = await decodeBlob(blob, inspectionWidth)
            const stillParked =
                state === "checkpoint" ||
                state === "buffering" ||
                (state === "paused" && !!pendingMove)
            if (
                destroyed ||
                generation !== inspectionGeneration ||
                !active ||
                !stillParked ||
                frameAt() !== frame
            )
                bitmap.close()
            else {
                inspection?.close()
                inspection = bitmap
                inspectionFrame = frame
                qualityStartedAt = performance.now()
                lastPaint = ""
                notify()
                requestPaint()
            }
        } catch {
            /* Inspection quality is optional; the ready motion image remains selectable. */
        } finally {
            inspectionDecoding = false
            if (
                !destroyed &&
                generation !== inspectionGeneration &&
                active &&
                state === "checkpoint" &&
                inspectionFrame !== frameAt()
            )
                inspectionWanted = true
            if (!destroyed) resourcesChanged()
        }
    }

    function drawImage(
        bitmap: OrbitBitmap,
        viewport?: { x: number; y: number; width: number; height: number },
        logicalRatio?: number
    ) {
        if (!context) return
        const target = viewport ?? {
            x: 0,
            y: 0,
            width: canvas.width,
            height: canvas.height,
        }
        if (logicalRatio) {
            let width = bitmap.width,
                height = bitmap.height
            if (width / height > logicalRatio) width = height * logicalRatio
            else height = width / logicalRatio
            context.drawImage(
                bitmap.image,
                (bitmap.width - width) * focalX,
                (bitmap.height - height) * focalY,
                width,
                height,
                target.x,
                target.y,
                target.width,
                target.height
            )
            return
        }
        const scale = Math.max(
            target.width / bitmap.width,
            target.height / bitmap.height
        )
        const width = bitmap.width * scale,
            height = bitmap.height * scale
        context.drawImage(
            bitmap.image,
            target.x + (target.width - width) * focalX,
            target.y + (target.height - height) * focalY,
            width,
            height
        )
    }

    function paint(now: number) {
        const frame = frameAt()
        let from = frame,
            to = frame,
            frameMix = 0
        if (frameBlend > 0 && !reduced()) {
            const lower = Math.floor(position),
                fraction = position - lower
            // Blend only around the boundary between the two nearest samples.
            // Width zero is a hard nearest-frame cut; width one is linear interpolation.
            frameMix = orbitClamp(
                (fraction - (1 - frameBlend) / 2) / frameBlend,
                0,
                1
            )
            from = orbitModulo(lower, total)
            to = orbitModulo(lower + 1, total)
            if (frameMix === 1) {
                from = to
                frameMix = 0
            }
            if (frameMix === 0) to = from
        }
        const bitmap = frames.get(from),
            next = frameMix > 0 ? frames.get(to) : undefined
        if (!context || !bitmap || !active || destroyed) return
        const requestedBounds = options.renderBounds?.()
        const bounds =
            requestedBounds &&
            [requestedBounds.width, requestedBounds.height].every(
                Number.isFinite
            ) &&
            requestedBounds.width > 0 &&
            requestedBounds.height > 0
                ? requestedBounds
                : canvas.getBoundingClientRect()
        if (bounds.width <= 0 || bounds.height <= 0) return
        const requestedViewport = options.viewport?.({
            width: bounds.width,
            height: bounds.height,
        })
        const viewport =
            requestedViewport &&
            [
                requestedViewport.x,
                requestedViewport.y,
                requestedViewport.width,
                requestedViewport.height,
            ].every(Number.isFinite) &&
            requestedViewport.width > 0 &&
            requestedViewport.height > 0
                ? requestedViewport
                : null
        const useful =
            inspection && inspectionFrame === frame ? inspection : bitmap
        const usefulDPR = Math.min(
            useful.width / bounds.width,
            useful.height / bounds.height
        )
        const dpr = viewport
            ? Math.min(window.devicePixelRatio || 1, 2)
            : Math.min(window.devicePixelRatio || 1, 2, usefulDPR)
        const requestedBacking = options.backingSize?.()
        const backing =
            requestedBacking &&
            [requestedBacking.width, requestedBacking.height].every(
                Number.isFinite
            ) &&
            requestedBacking.width > 0 &&
            requestedBacking.height > 0
                ? requestedBacking
                : null
        const width = Math.max(
                1,
                Math.round(backing?.width ?? bounds.width * dpr)
            ),
            height = Math.max(
                1,
                Math.round(backing?.height ?? bounds.height * dpr)
            )
        if (canvas.width !== width || canvas.height !== height) {
            canvas.width = width
            canvas.height = height
            lastPaint = ""
        }
        const destination = viewport
            ? {
                  x: (viewport.x * width) / bounds.width,
                  y: (viewport.y * height) / bounds.height,
                  width: (viewport.width * width) / bounds.width,
                  height: (viewport.height * height) / bounds.height,
              }
            : undefined
        const mix =
            inspection && inspectionFrame === frame
                ? reduced()
                    ? 1
                    : orbitClamp((now - qualityStartedAt) / 120, 0, 1)
                : 0
        const logicalRatio = backing
            ? viewport
                ? viewport.width / viewport.height
                : bounds.width / bounds.height
            : undefined
        const signature = [
            from,
            to,
            frameMix.toFixed(4),
            width,
            height,
            inspectionFrame,
            mix.toFixed(4),
            logicalRatio ?? "",
            viewport ? 1 : 0,
            destination?.x ?? 0,
            destination?.y ?? 0,
            destination?.width ?? width,
            destination?.height ?? height,
        ].join("|")
        if (signature === lastPaint) return
        context.globalAlpha = 1
        if (destination) {
            context.fillStyle = "#f4f4f1"
            context.fillRect(0, 0, width, height)
            context.save()
            context.beginPath()
            context.rect(
                destination.x,
                destination.y,
                destination.width,
                destination.height
            )
            context.clip()
        }
        drawImage(bitmap, destination, logicalRatio)
        if (next) {
            context.globalAlpha = frameMix
            drawImage(next, destination, logicalRatio)
            context.globalAlpha = 1
        }
        if (inspection && mix > 0 && inspectionFrame === frame) {
            context.globalAlpha = mix
            drawImage(inspection, destination, logicalRatio)
            context.globalAlpha = 1
        }
        if (destination) context.restore()
        setData("orbitFrameFrom", String(from))
        setData("orbitFrameTo", String(to))
        setData("orbitFrameMix", frameMix.toFixed(4))
        lastPaint = signature
    }

    function requestPaint() {
        if (!raf && canRun() && state !== "paused")
            raf = requestAnimationFrame(tick)
    }

    function nextCheckpoint(from: number, heading: number) {
        const cycle = Math.floor(from / total),
            candidates: number[] = []
        for (let offset = -1; offset <= 1; offset++)
            for (const checkpoint of checkpoints)
                candidates.push((cycle + offset) * total + checkpoint)
        if (heading > 0)
            return Math.min(
                ...candidates.filter((value) => value > from + 0.0001)
            )
        return Math.max(...candidates.filter((value) => value < from - 0.0001))
    }

    function arrive(target: number) {
        position = target
        settling = null
        pendingMove = null
        pausedAt = 0
        state = "checkpoint"
        setRestBuffer(target)
        paint(performance.now())
        notify()
        void prepareInspection()
    }

    function startSettle(target = nextCheckpoint(position, direction)) {
        if (!canRun() || !fullyReady()) return
        if (Math.abs(target - position) < 0.0001) {
            arrive(target)
            return
        }
        direction = Math.sign(target - position)
        pausedAt = 0
        const indices = reduced()
            ? [...new Set([frameAt(), orbitModulo(Math.round(target), total)])]
            : indicesBetween(position, target)
        const adjacent =
            Math.abs(target - nextCheckpoint(position, direction)) < 0.0001
        // An adjacent target's window already contains the whole committed arc.
        // A distant numbered jump pins only its route, never route + outer window.
        const wanted = adjacent
            ? windowIndices(target, bufferCheckpoints)
            : indices
        pendingMove = { start: position, target, indices }
        state = "buffering"
        setBuffer(wanted, indices, [
            ...indices,
            ...nearestFirst(wanted, target),
        ])
    }

    function tryStartPending() {
        if (
            !pendingMove ||
            !canRun() ||
            state === "paused" ||
            blobs.size !== total ||
            !framesReady(pendingMove.indices)
        )
            return
        const pending = pendingMove
        if (failedIndex(pending.indices) !== undefined) return
        pendingMove = null
        dropInspection()
        pausedAt = 0
        if (reduced()) {
            arrive(pending.target)
            return
        }
        settling = {
            start: pending.start,
            target: pending.target,
            time: performance.now(),
            duration: snapDuration * 1000,
        }
        state = "settling"
        notify()
        requestPaint()
    }

    function tick(now: number) {
        raf = 0
        if (!canRun() || state === "paused") return
        if (settling) {
            const motion = settling,
                t = orbitClamp((now - motion.time) / motion.duration, 0, 1)
            const smooth = t * t * (3 - 2 * t)
            position = motion.start + (motion.target - motion.start) * smooth
            if (t >= 1) {
                arrive(motion.target)
            }
        }
        paint(now)
        notify()
        const qualityActive =
            inspection &&
            inspectionFrame === frameAt() &&
            now - qualityStartedAt < 120
        if (settling || qualityActive) requestPaint()
    }

    function releaseDrag() {
        if (!drag) return
        if (drag.moved) suppressClickUntil = performance.now() + 400
        const pointer = drag.id
        drag = null
        touchDragging = false
        try {
            if (root.hasPointerCapture(pointer))
                root.releasePointerCapture(pointer)
        } catch {
            /* Detached elements have no capture. */
        }
    }

    function ignored(target: EventTarget | null) {
        let element = target instanceof Element ? target : null
        if (!element) return true
        // Framer may place a transparent sibling above this component. Stop at the
        // shared container: its role/overflow belongs to the page, not a control.
        while (element && element !== root && !element.contains(root)) {
            if (
                element.matches(
                    "nav,header,a,button,input,textarea,select,option,[contenteditable]:not([contenteditable='false']),[role='button'],[role='link'],[data-orbit-ignore]"
                )
            )
                return true
            element = element.parentElement
        }
        return false
    }

    function insideViewer(x: number, y: number) {
        const box = options.inputBounds?.() || root.getBoundingClientRect()
        return (
            box.width > 0 &&
            box.height > 0 &&
            x >= box.left &&
            x <= box.left + box.width &&
            y >= box.top &&
            y <= box.top + box.height
        )
    }

    function inputPoint(clientX: number, clientY: number) {
        const point = options.inputPoint?.(clientX, clientY)
        return point && Number.isFinite(point.x) && Number.isFinite(point.y)
            ? point
            : { x: clientX, y: clientY }
    }

    function coveredTrialControl(x: number, y: number) {
        return Array.from(
            root.querySelectorAll<HTMLElement>(
                "[data-homepage-controls] button, button[data-apartment-open], button[data-orbit-detail-link], button[data-orbit-fullscreen-open], button[data-orbit-fullscreen-close], [data-orbit-filters], [data-orbit-filters] button, [data-orbit-price-popover], [data-orbit-area-popover]"
            )
        ).some((control) => {
            if (
                (control as HTMLButtonElement).disabled ||
                control.getAttribute("aria-disabled") === "true" ||
                control.closest("[inert], [hidden], [aria-hidden='true']")
            )
                return false
            const style = getComputedStyle(control)
            if (style.pointerEvents === "none") return false
            for (
                let element: HTMLElement | null = control;
                element;
                element = element.parentElement
            ) {
                const css =
                    element === control ? style : getComputedStyle(element)
                if (
                    css.display === "none" ||
                    css.visibility === "hidden" ||
                    css.visibility === "collapse" ||
                    Number(css.opacity) === 0
                )
                    return false
                if (element === root) break
            }
            const box = control.getBoundingClientRect()
            return (
                box.width > 0 &&
                box.height > 0 &&
                x >= box.left &&
                x <= box.right &&
                y >= box.top &&
                y <= box.bottom
            )
        })
    }

    function nestedScroll(
        target: EventTarget | null,
        deltaX: number,
        deltaY: number
    ) {
        let element = target instanceof Element ? target : null
        while (element && element !== root && !element.contains(root)) {
            const style = getComputedStyle(element),
                horizontal = Math.abs(deltaX) > Math.abs(deltaY)
            if (
                horizontal &&
                /auto|scroll/.test(style.overflowX) &&
                element.scrollWidth > element.clientWidth + 1
            ) {
                if (
                    deltaX < 0
                        ? element.scrollLeft > 0
                        : element.scrollLeft <
                          element.scrollWidth - element.clientWidth - 1
                )
                    return true
            }
            if (
                !horizontal &&
                /auto|scroll/.test(style.overflowY) &&
                element.scrollHeight > element.clientHeight + 1
            ) {
                if (
                    deltaY < 0
                        ? element.scrollTop > 0
                        : element.scrollTop <
                          element.scrollHeight - element.clientHeight - 1
                )
                    return true
            }
            element = element.parentElement
        }
        return false
    }

    function suspendedInput(event: Event, x?: number, y?: number) {
        if (
            !suspended ||
            !active ||
            destroyed ||
            !visible ||
            ignored(event.target)
        )
            return false
        if (x !== undefined && y !== undefined && !insideViewer(x, y))
            return false
        if (event.cancelable) event.preventDefault()
        return true
    }

    function setSuspended(value: boolean) {
        if (destroyed || suspended === value) return
        const now = performance.now()
        suspended = value
        releaseDrag()
        // Forget the old gesture and consume its immediate inertial tail after rotation.
        lastWheelAt = lastInputAt = now
        wheelLatched = true
        suppressClickUntil = now + 400
        if (suspended) {
            suspendedAt = now
            if (raf) cancelAnimationFrame(raf)
            raf = 0
        } else {
            // The committed arc resumes from the same point. A manual pause owns its
            // own timestamp and remains paused until the visitor explicitly resumes.
            if (settling && state !== "paused")
                settling.time += now - suspendedAt
            suspendedAt = 0
            if (
                !visible ||
                document.hidden ||
                (state === "paused" && automaticPause)
            )
                visibilityChanged()
            if (pendingMove) tryStartPending()
            requestPaint()
        }
        notify()
    }

    function onWheel(event: WheelEvent) {
        // Embedded section: ordinary vertical wheel scrolling belongs to the page.
        if (!event.shiftKey && Math.abs(event.deltaY) >= Math.abs(event.deltaX)) return;
        if (
            !event.ctrlKey &&
            !event.metaKey &&
            suspendedInput(event, event.clientX, event.clientY)
        )
            return
        if (
            !inputAvailable() ||
            event.defaultPrevented ||
            event.ctrlKey ||
            event.metaKey ||
            !insideViewer(event.clientX, event.clientY) ||
            coveredTrialControl(event.clientX, event.clientY) ||
            ignored(event.target)
        )
            return
        if (nestedScroll(event.target, event.deltaX, event.deltaY)) return
        const scale =
            event.deltaMode === 1
                ? 16
                : event.deltaMode === 2
                  ? Math.max(1, root.clientHeight)
                  : 1
        const raw =
            (Math.abs(event.deltaX) > Math.abs(event.deltaY)
                ? event.deltaX
                : event.deltaY) * scale
        if (Math.abs(raw) < 0.2) return
        event.preventDefault()
        const now = performance.now(),
            freshGesture = now - lastWheelAt >= 180
        lastWheelAt = lastInputAt = now
        if (freshGesture) wheelLatched = false
        const consumed = wheelLatched
        wheelLatched = true
        // Refresh the latch even for ignored input: a long trackpad tail must not
        // become a second move merely because the camera arrived during that tail.
        if (
            consumed ||
            state !== "checkpoint" ||
            settling ||
            pendingMove ||
            drag
        )
            return
        go(Math.sign(raw))
    }

    function onPointerDown(event: PointerEvent) {
        if (event.pointerType === "touch") return
        if (suspendedInput(event, event.clientX, event.clientY)) return
        if (!event.isPrimary) {
            if (drag) releaseDrag()
            return
        }
        if (
            !inputAvailable() ||
            event.defaultPrevented ||
            event.button !== 0 ||
            !insideViewer(event.clientX, event.clientY) ||
            coveredTrialControl(event.clientX, event.clientY) ||
            ignored(event.target)
        )
            return
        if (
            nestedScroll(event.target, 1, 0) ||
            nestedScroll(event.target, 0, 1)
        )
            return
        const point = inputPoint(event.clientX, event.clientY)
        drag = {
            id: event.pointerId,
            x: point.x,
            y: point.y,
            moved: false,
            triggered: state !== "checkpoint" || !!settling || !!pendingMove,
        }
        try {
            root.setPointerCapture(event.pointerId)
        } catch {
            /* Mouse events can still finish through the window listener. */
        }
    }

    function onPointerMove(event: PointerEvent) {
        if (
            !drag ||
            touchDragging ||
            drag.id !== event.pointerId ||
            !inputAvailable()
        )
            return
        const dx = inputPoint(event.clientX, event.clientY).x - drag.x
        if (Math.abs(dx) < 8 && !drag.moved) return
        if (event.cancelable) event.preventDefault()
        drag.moved = true
        lastInputAt = performance.now()
        if (drag.triggered) return
        drag.triggered = true
        go(dx < 0 ? 1 : -1)
    }

    function onPointerUp(event: PointerEvent) {
        if (!drag || touchDragging || drag.id !== event.pointerId) return
        if (drag.moved) lastInputAt = performance.now()
        releaseDrag()
    }

    function onPointerCancel(event: PointerEvent) {
        if (!drag || touchDragging || drag.id !== event.pointerId) return
        releaseDrag()
    }

    function onClick(event: MouseEvent) {
        if (suspendedInput(event, event.clientX, event.clientY)) {
            event.stopPropagation()
            return
        }
        if (coveredTrialControl(event.clientX, event.clientY)) return
        // A drag must not accidentally activate a picking listener attached by the wrapper.
        const now = performance.now()
        if (
            (now < suppressClickUntil ||
                (now - lastInputAt < 120 && state !== "checkpoint")) &&
            insideViewer(event.clientX, event.clientY) &&
            !ignored(event.target)
        ) {
            event.preventDefault()
            event.stopPropagation()
        }
    }

    function onTouchStart(event: TouchEvent) {
        if (suspended) {
            releaseDrag()
            return
        }
        if (event.touches.length !== 1) {
            if (touchDragging) releaseDrag()
            return
        }
        const touch = event.touches[0]
        if (
            !inputAvailable() ||
            event.defaultPrevented ||
            !insideViewer(touch.clientX, touch.clientY) ||
            coveredTrialControl(touch.clientX, touch.clientY) ||
            ignored(event.target)
        )
            return
        if (
            nestedScroll(event.target, 1, 0) ||
            nestedScroll(event.target, 0, 1)
        )
            return
        const point = inputPoint(touch.clientX, touch.clientY)
        drag = {
            id: touch.identifier,
            x: point.x,
            y: point.y,
            moved: false,
            triggered: state !== "checkpoint" || !!settling || !!pendingMove,
        }
        touchDragging = true
    }

    function onTouchMove(event: TouchEvent) {
        if (suspended && event.touches.length === 1) {
            const point = event.touches[0]
            suspendedInput(event, point.clientX, point.clientY)
            return
        }
        if (
            !touchDragging ||
            !drag ||
            !inputAvailable() ||
            event.touches.length !== 1
        )
            return
        const touch = event.touches[0]
        const point = inputPoint(touch.clientX, touch.clientY)
        const dx = point.x - drag.x,
            dy = point.y - drag.y
        // Preserve native vertical page scrolling; only a horizontal swipe rotates.
        if (!drag.moved && Math.max(Math.abs(dx), Math.abs(dy)) < 12) return
        if (!drag.moved && Math.abs(dy) > Math.abs(dx)) { releaseDrag(); return }
        if (event.cancelable) event.preventDefault()
        drag.moved = true
        lastInputAt = performance.now()
        if (drag.triggered) return
        const delta = Math.abs(dx) >= Math.abs(dy) ? -dx : -dy
        drag.triggered = true
        go(Math.sign(delta))
    }

    function onTouchEnd(event: TouchEvent) {
        if (!touchDragging || !drag || event.touches.length) return
        if (drag.moved) lastInputAt = performance.now()
        releaseDrag()
    }

    function onTouchCancel() {
        if (!touchDragging || !drag) return
        releaseDrag()
    }

    function go(heading: number) {
        if (
            !canRun() ||
            !fullyReady() ||
            !heading ||
            settling ||
            pendingMove ||
            state !== "checkpoint"
        )
            return
        automaticPause = false
        direction = heading > 0 ? 1 : -1
        if (drag) drag.triggered = true
        startSettle(nextCheckpoint(position, direction))
    }

    function setCheckpoint(index: number) {
        if (
            !canRun() ||
            !fullyReady() ||
            settling ||
            pendingMove ||
            state !== "checkpoint"
        )
            return
        const desired =
            checkpoints[orbitModulo(Math.round(index), checkpointCount)]
        const current = orbitModulo(position, total)
        let distance =
            orbitModulo(desired - current + total / 2, total) - total / 2
        if (Math.abs(distance + total / 2) < 0.0001)
            distance = (direction * total) / 2
        automaticPause = false
        if (drag) drag.triggered = true
        startSettle(position + distance)
    }

    function pauseInternal(automatic: boolean) {
        if (!active || destroyed || state === "error" || state === "loading")
            return
        automaticPause = automatic
        releaseDrag()
        if (state !== "paused")
            pausedAt = suspended ? suspendedAt : performance.now()
        if (raf) cancelAnimationFrame(raf)
        raf = 0
        state = "paused"
        notify()
    }

    function resume() {
        if (
            !active ||
            suspended ||
            destroyed ||
            !fullyReady() ||
            !visible ||
            document.hidden ||
            state === "error"
        )
            return
        automaticPause = false
        if (pendingMove) {
            pausedAt = 0
            state = "buffering"
            resourcesChanged()
            return
        }
        if (settling) {
            if (reduced()) {
                arrive(settling.target)
                return
            }
            if (pausedAt) settling.time += performance.now() - pausedAt
            pausedAt = 0
            state = "settling"
            notify()
            requestPaint()
            return
        }
        const current = orbitModulo(position, total),
            checkpoint = checkpoints.find(
                (value) => Math.abs(value - current) < 0.0001
            )
        if (
            checkpoint !== undefined ||
            Math.abs(current - entryFrame) < 0.0001
        ) {
            state = "checkpoint"
            paint(performance.now())
            notify()
            if (!inspection) void prepareInspection()
            requestPaint()
        } else {
            state = "moving"
            startSettle()
        }
    }

    function visibilityChanged() {
        if (!active || suspended) return
        if ((!visible || document.hidden) && state !== "paused")
            pauseInternal(true)
        else if (visible && !document.hidden && automaticPause) resume()
    }

    function onKeyDown(event: KeyboardEvent) {
        if (!root.contains(document.activeElement)) return;
        if (
            !event.ctrlKey &&
            !event.metaKey &&
            !event.altKey &&
            [
                "ArrowRight",
                "ArrowDown",
                "PageDown",
                "ArrowLeft",
                "ArrowUp",
                "PageUp",
                " ",
                "Spacebar",
                "Home",
                "End",
            ].includes(event.key) &&
            suspendedInput(event)
        )
            return
        if (
            !inputAvailable() ||
            event.defaultPrevented ||
            event.ctrlKey ||
            event.metaKey ||
            event.altKey ||
            ignored(event.target)
        )
            return
        const heading = ["ArrowRight", "ArrowDown", "PageDown"].includes(
            event.key
        )
            ? 1
            : ["ArrowLeft", "ArrowUp", "PageUp"].includes(event.key)
              ? -1
              : event.key === " " || event.key === "Spacebar"
                ? event.shiftKey
                    ? -1
                    : 1
                : 0
        if (heading) {
            event.preventDefault()
            if (!event.repeat) go(heading)
        }
    }

    function onEscape(event: KeyboardEvent) {
        if (!root.contains(document.activeElement)) return;
        if (
            event.key === "Escape" &&
            !event.defaultPrevented &&
            !ignored(event.target) &&
            active &&
            visible &&
            !document.hidden
        )
            pauseInternal(false)
    }

    async function activate(
        frame = startFrame,
        restoration?: OrbitRestoration
    ) {
        const token = ++activation
        await prepare()
        if (destroyed || token !== activation) return
        active = false
        automaticPause = false
        position = Number.isFinite(restoration?.position)
            ? restoration!.position
            : orbitModulo(
                  Math.round(Number.isFinite(frame) ? frame : startFrame),
                  total
              )
        entryFrame = orbitModulo(Math.round(position), total)
        direction =
            restoration?.direction && Number.isFinite(restoration.direction)
                ? Math.sign(restoration.direction)
                : 1
        settling = null
        pendingMove = null
        pausedAt = 0
        dropInspection()
        state = "loading"
        const target =
            Number.isFinite(restoration?.target) &&
            Math.abs(restoration!.target! - position) > 0.0001
                ? restoration!.target!
                : undefined
        const initial =
            target === undefined
                ? nearestFirst(windowIndices(position, 1), position)
                : indicesBetween(position, target)
        if (target === undefined) setRestBuffer(position, true)
        else {
            direction = Math.sign(target - position)
            pendingMove = { start: position, target, indices: initial }
            const wanted = [
                ...new Set([
                    ...windowIndices(target, bufferCheckpoints),
                    ...initial,
                ]),
            ]
            setBuffer(wanted, initial, [
                ...initial,
                ...nearestFirst(wanted, target),
            ])
        }
        try {
            await waitForFrames(initial, token)
        } catch (reason) {
            if (!destroyed && token === activation) {
                fail(failedIndex(initial) ?? frameAt())
                notify()
            }
            throw reason
        }
        if (destroyed || token !== activation) return
        active = true
        canvas.style.touchAction = "pan-y pinch-zoom"
        // Do not interpret the approach's remaining wheel momentum as an orbit move.
        lastWheelAt = performance.now()
        wheelLatched = true
        state = restoration?.paused
            ? "paused"
            : target === undefined
              ? "checkpoint"
              : "buffering"
        if (state === "paused")
            pausedAt = suspended ? suspendedAt : performance.now()
        // A custom entry frame is parked exactly; the eight selectable cameras stay fixed.
        if (target === undefined) setRestBuffer(position)
        paint(performance.now())
        notify()
        void prepareInspection()
        if (!suspended && (!visible || document.hidden)) pauseInternal(true)
        else if (target !== undefined) resourcesChanged()
    }

    /** Retain compressed downloads while optionally releasing all parked/motion bitmaps. */
    function deactivate(releaseDecoded = false) {
        activation++
        active = false
        automaticPause = false
        releaseDrag()
        settling = null
        pendingMove = null
        pausedAt = 0
        if (raf) cancelAnimationFrame(raf)
        raf = 0
        dropInspection()
        canvas.style.touchAction = originalTouchAction
        error = undefined
        if (releaseDecoded) {
            // The opening sequence must not share memory with an invisible orbit
            // window. Late native decodes keep their permits, then close instead
            // of entering a later preparation that happens to want the same IDs.
            decodeGeneration++
            prepared = preparing = false
            desired.clear()
            required.clear()
            priority = []
            preparationRequired = []
            residentFramesDirty = requiredFramesDirty = true
            frames.forEach((bitmap) => bitmap.close())
            frames.clear()
            const resolve = prepareResolve
            prepareResolve = prepareReject = null
            preparePromise = null
            // Old activation waiters observe the incremented activation token.
            // Finish abandoned warm-up promises without an unhandled rejection.
            resolve?.()
            state = "idle"
            finishWaiters()
            notify()
            pump()
            return
        }
        state = prepared ? "idle" : preparing ? "loading" : "idle"
        if ((prepared || preparing) && !destroyed)
            setRestBuffer(startFrame, true)
        else {
            finishWaiters()
            notify()
        }
    }

    async function retry() {
        if (destroyed) return
        const token = activation,
            wasActive = active,
            remainPaused = errorWasPaused
        // A decoder failure may be an invalid cached response. Refresh only those
        // sources; successful downloads and resident bitmaps remain untouched.
        for (const index of decodeFailed.keys()) {
            blobs.delete(index)
            refresh.add(index)
        }
        fetchFailed.clear()
        decodeFailed.clear()
        error = undefined
        errorWasPaused = false
        if (!prepared) {
            preparePromise = null
            await prepare()
        } else {
            state = wasActive
                ? pendingMove
                    ? remainPaused
                        ? "paused"
                        : "buffering"
                    : "paused"
                : "loading"
            try {
                await waitForFrames([...required], token, true)
            } catch (reason) {
                if (!destroyed && token === activation) {
                    fail(failedIndex([...required]) ?? frameAt())
                    notify()
                }
                throw reason
            }
        }
        if (destroyed || token !== activation || !wasActive) return
        if (remainPaused) {
            state = "paused"
            notify()
        } else if (pendingMove) {
            state = "buffering"
            resourcesChanged()
        } else {
            state = "paused"
            resume()
        }
    }

    const resizeObserver =
        typeof ResizeObserver === "function"
            ? new ResizeObserver(() => {
                  lastPaint = ""
                  if (active && (state === "paused" || suspended))
                      paint(performance.now())
                  else requestPaint()
              })
            : null
    resizeObserver?.observe(canvas)
    const intersectionObserver =
        typeof IntersectionObserver === "function"
            ? new IntersectionObserver((entries) => {
                  const entry = entries.find((value) => value.target === root)
                  if (entry) {
                      visible =
                          entry.isIntersecting && entry.intersectionRatio > 0
                      visibilityChanged()
                  }
              })
            : null
    intersectionObserver?.observe(root)
    const resize = () => {
        lastPaint = ""
        if (active && (state === "paused" || suspended))
            paint(performance.now())
        else requestPaint()
    }
    const reducedChanged = () => {
        if (
            !suspended &&
            reduced() &&
            active &&
            fullyReady() &&
            (state === "moving" || state === "settling")
        )
            arrive(settling?.target ?? nextCheckpoint(position, direction))
    }
    window.addEventListener("wheel", onWheel, { passive: false, capture: true })
    window.addEventListener("pointerdown", onPointerDown, true)
    window.addEventListener("pointermove", onPointerMove, {
        passive: false,
        capture: true,
    })
    window.addEventListener("pointerup", onPointerUp, true)
    window.addEventListener("pointercancel", onPointerCancel, true)
    window.addEventListener("touchstart", onTouchStart, {
        passive: true,
        capture: true,
    })
    window.addEventListener("touchmove", onTouchMove, {
        passive: false,
        capture: true,
    })
    window.addEventListener("touchend", onTouchEnd, true)
    window.addEventListener("touchcancel", onTouchCancel, true)
    window.addEventListener("click", onClick, true)
    window.addEventListener("keydown", onKeyDown, true)
    window.addEventListener("resize", resize)
    window.addEventListener("keydown", onEscape)
    document.addEventListener("visibilitychange", visibilityChanged)
    reducedQuery?.addEventListener?.("change", reducedChanged)
    notify()

    return {
        prefetch,
        prepare,
        activate,
        deactivate,
        go,
        setCheckpoint,
        pause: () => pauseInternal(false),
        resume,
        retry,
        snapshot,
        setSuspended,
        redraw: () => paint(performance.now()),
        destroy() {
            if (destroyed) return
            destroyed = true
            deactivate()
            cancellation.abort()
            const reject = prepareReject
            prepareResolve = prepareReject = null
            reject?.(new Error("Orbit disposed"))
            waiters.splice(0).forEach((waiter) => waiter.resolve())
            frames.forEach((bitmap) => bitmap.close())
            frames.clear()
            blobs.clear()
            resizeObserver?.disconnect()
            intersectionObserver?.disconnect()
            window.removeEventListener("wheel", onWheel, true)
            window.removeEventListener("pointerdown", onPointerDown, true)
            window.removeEventListener("pointermove", onPointerMove, true)
            window.removeEventListener("pointerup", onPointerUp, true)
            window.removeEventListener("pointercancel", onPointerCancel, true)
            window.removeEventListener("click", onClick, true)
            window.removeEventListener("touchstart", onTouchStart, true)
            window.removeEventListener("touchmove", onTouchMove, true)
            window.removeEventListener("touchend", onTouchEnd, true)
            window.removeEventListener("touchcancel", onTouchCancel, true)
            window.removeEventListener("keydown", onKeyDown, true)
            window.removeEventListener("resize", resize)
            window.removeEventListener("keydown", onEscape)
            document.removeEventListener("visibilitychange", visibilityChanged)
            reducedQuery?.removeEventListener?.("change", reducedChanged)
        },
    }
}

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
