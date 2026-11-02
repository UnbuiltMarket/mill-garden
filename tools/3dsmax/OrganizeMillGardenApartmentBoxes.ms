/* Organize existing Mill Garden boxes into building/floor rows. Explicit rerun repositions owned boxes; dimensions and colors are preserved. */
(
 local rows = #(
    #("1-01", "1", 0, "MG_MASKS_1_F00", [33523,12000,0]),
    #("1-02", "1", 0, "MG_MASKS_1_F00", [34623,12000,0]),
    #("1-03", "1", 0, "MG_MASKS_1_F00", [35723,12000,0]),
    #("1-04", "1", 0, "MG_MASKS_1_F00", [36823,12000,0]),
    #("1-05", "1", 0, "MG_MASKS_1_F00", [37923,12000,0]),
    #("1-06", "1", 0, "MG_MASKS_1_F00", [39023,12000,0]),
    #("1-07", "1", 0, "MG_MASKS_1_F00", [40123,12000,0]),
    #("1-08", "1", 0, "MG_MASKS_1_F00", [41223,12000,0]),
    #("1-09", "1", 0, "MG_MASKS_1_F00", [42323,12000,0]),
    #("1-10", "1", 0, "MG_MASKS_1_F00", [43423,12000,0]),
    #("1-11", "1", 1, "MG_MASKS_1_F01", [33523,11000,0]),
    #("1-12", "1", 1, "MG_MASKS_1_F01", [34623,11000,0]),
    #("1-13", "1", 1, "MG_MASKS_1_F01", [35723,11000,0]),
    #("1-14", "1", 1, "MG_MASKS_1_F01", [36823,11000,0]),
    #("1-15", "1", 1, "MG_MASKS_1_F01", [37923,11000,0]),
    #("1-16", "1", 1, "MG_MASKS_1_F01", [39023,11000,0]),
    #("1-17", "1", 1, "MG_MASKS_1_F01", [40123,11000,0]),
    #("1-18", "1", 1, "MG_MASKS_1_F01", [41223,11000,0]),
    #("1-19", "1", 2, "MG_MASKS_1_F02", [33523,10000,0]),
    #("2-01", "2", 0, "MG_MASKS_2_F00", [46523,12000,0]),
    #("2-02", "2", 0, "MG_MASKS_2_F00", [47623,12000,0]),
    #("2-03", "2", 0, "MG_MASKS_2_F00", [48723,12000,0]),
    #("2-04", "2", 0, "MG_MASKS_2_F00", [49823,12000,0]),
    #("2-05", "2", 1, "MG_MASKS_2_F01", [46523,11000,0]),
    #("2-06", "2", 1, "MG_MASKS_2_F01", [47623,11000,0]),
    #("2-07", "2", 1, "MG_MASKS_2_F01", [48723,11000,0]),
    #("2-08", "2", 2, "MG_MASKS_2_F02", [46523,10000,0]),
    #("3-01", "3", 0, "MG_MASKS_3_F00", [33523,6500,0]),
    #("3-02", "3", 0, "MG_MASKS_3_F00", [34623,6500,0]),
    #("3-03", "3", 0, "MG_MASKS_3_F00", [35723,6500,0]),
    #("3-04", "3", 0, "MG_MASKS_3_F00", [36823,6500,0]),
    #("3-05", "3", 0, "MG_MASKS_3_F00", [37923,6500,0]),
    #("3-06", "3", 0, "MG_MASKS_3_F00", [39023,6500,0]),
    #("3-07", "3", 1, "MG_MASKS_3_F01", [33523,5500,0]),
    #("3-08", "3", 1, "MG_MASKS_3_F01", [34623,5500,0]),
    #("3-09", "3", 1, "MG_MASKS_3_F01", [35723,5500,0]),
    #("3-10", "3", 1, "MG_MASKS_3_F01", [36823,5500,0]),
    #("3-11", "3", 2, "MG_MASKS_3_F02", [33523,4500,0]),
    #("3-12", "3", 2, "MG_MASKS_3_F02", [34623,4500,0]),
    #("4-01", "4", 0, "MG_MASKS_4_F00", [46523,6500,0]),
    #("4-02", "4", 0, "MG_MASKS_4_F00", [47623,6500,0]),
    #("4-03", "4", 0, "MG_MASKS_4_F00", [48723,6500,0]),
    #("4-04", "4", 0, "MG_MASKS_4_F00", [49823,6500,0]),
    #("4-05", "4", 0, "MG_MASKS_4_F00", [50923,6500,0]),
    #("4-06", "4", 0, "MG_MASKS_4_F00", [52023,6500,0]),
    #("4-07", "4", 0, "MG_MASKS_4_F00", [53123,6500,0]),
    #("4-08", "4", 1, "MG_MASKS_4_F01", [46523,5500,0]),
    #("4-09", "4", 1, "MG_MASKS_4_F01", [47623,5500,0]),
    #("4-10", "4", 1, "MG_MASKS_4_F01", [48723,5500,0]),
    #("4-11", "4", 1, "MG_MASKS_4_F01", [49823,5500,0]),
    #("4-12", "4", 1, "MG_MASKS_4_F01", [50923,5500,0]),
    #("4-13", "4", 1, "MG_MASKS_4_F01", [52023,5500,0]),
    #("4-14", "4", 2, "MG_MASKS_4_F02", [46523,4500,0])
 )
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
