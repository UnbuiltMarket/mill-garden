/* Viewport labels for the building/floor staging rows. Excluded from rendering. */
(
 local cm=units.decodeValue "1cm"
 local labelsLayer=LayerManager.getLayerFromName "MG_MAPPING_LABELS"
 if labelsLayer==undefined do labelsLayer=LayerManager.newLayerFromName "MG_MAPPING_LABELS"
 local counts=#(#(10,8,1),#(4,3,1),#(6,4,2),#(7,6,1))
 undo "Label Mill Garden apartment staging rows" on with animate off at time 0f (
  for b=1 to 4 do (
   local x=33523+(mod (b-1) 2)*13000
   local y=12000-(floor ((b-1)/2.0))*5500
   local name="MG_LABEL_BUILDING_"+(b as string)
   local n=getNodeByName name exact:true
   if n==undefined do n=text name:name
   n.text=(if b==4 then "PHASE 4" else "BUILDING "+(b as string))
   n.size=230*cm
   n.pos=[x-500,y+1100,0]*cm
   n.renderable=false
   n.wirecolor=white
   labelsLayer.addNode n
   for f=0 to 2 do (
    local labelName="MG_LABEL_"+(b as string)+"_F"+(f as string)
    local t=getNodeByName labelName exact:true
    if t==undefined do t=text name:labelName
    local floorText=case f of (0:"GROUND FLOOR";1:"1ST FLOOR";2:(if b==4 then "ROOF LEVEL" else "2ND FLOOR"))
    t.text=floorText+" - "+(counts[b][f+1] as string)+" apartments"
    t.size=110*cm
    t.pos=[x-500,y-f*1000+400,0]*cm
    t.renderable=false
    t.wirecolor=white
    labelsLayer.addNode t
   )
  )
 )
 redrawViews()
 true
)
