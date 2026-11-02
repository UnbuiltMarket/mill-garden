/*
    Mill Garden apartment mask boxes - palette version 1.
    Generated from the canonical apartment ID / mask-color mapping.

    New boxes: height 315 cm, length 500 cm, width 1000 cm.
    The flat nine-column grid is a staging palette, NOT apartment placement.
    Move / reshape the boxes to your apartments after creating them.

    Re-running updates owned object colors and metadata only. Existing
    geometry, transforms, names, parenting, materials and visibility remain.
    The script does not change scene units, render settings or cameras.

    Set global MillGardenMaskBoxes_AutoRun = false before fileIn for tooling.
    Run MillGardenCreateApartmentMaskBoxes selectCreated:true to select only
    newly created objects. Normal execution preserves the current selection.
*/

global MillGardenMaskBoxes_AutoRun
global MillGardenCreateApartmentMaskBoxes

fn MillGardenCreateApartmentMaskBoxes selectCreated:false =
(
    local paletteVersion = 1
    local ownerTag = "mill-garden-mask-v1"
    local rows = #(
        #("1-01", 240, 48, 48, "#F03030", "1"),
        #("1-02", 48, 240, 240, "#30F0F0", "1"),
        #("1-03", 48, 48, 112, "#303070", "1"),
        #("1-04", 112, 240, 48, "#70F030", "1"),
        #("1-05", 240, 112, 240, "#F070F0", "1"),
        #("1-06", 112, 48, 240, "#7030F0", "1"),
        #("1-07", 176, 240, 176, "#B0F0B0", "1"),
        #("1-08", 240, 176, 48, "#F0B030", "1"),
        #("1-09", 48, 176, 112, "#30B070", "1"),
        #("1-10", 112, 112, 48, "#707030", "1"),
        #("1-11", 48, 112, 176, "#3070B0", "1"),
        #("1-12", 112, 176, 176, "#70B0B0", "1"),
        #("1-13", 176, 48, 112, "#B03070", "1"),
        #("1-14", 176, 112, 176, "#B070B0", "1"),
        #("1-15", 176, 176, 112, "#B0B070", "1"),
        #("1-16", 176, 176, 240, "#B0B0F0", "1"),
        #("1-17", 240, 48, 176, "#F030B0", "1"),
        #("1-18", 240, 112, 112, "#F07070", "1"),
        #("1-19", 240, 176, 176, "#F0B0B0", "1"),
        #("2-01", 240, 240, 112, "#F0F070", "2"),
        #("2-02", 240, 240, 240, "#F0F0F0", "2"),
        #("2-03", 48, 48, 176, "#3030B0", "2"),
        #("2-04", 48, 48, 240, "#3030F0", "2"),
        #("2-05", 48, 112, 48, "#307030", "2"),
        #("2-06", 48, 112, 112, "#307070", "2"),
        #("2-07", 48, 112, 240, "#3070F0", "2"),
        #("2-08", 48, 176, 48, "#30B030", "2"),
        #("3-01", 48, 176, 176, "#30B0B0", "3"),
        #("3-02", 48, 176, 240, "#30B0F0", "3"),
        #("3-03", 48, 240, 48, "#30F030", "3"),
        #("3-04", 48, 240, 112, "#30F070", "3"),
        #("3-05", 48, 240, 176, "#30F0B0", "3"),
        #("3-06", 112, 48, 48, "#703030", "3"),
        #("3-07", 112, 48, 112, "#703070", "3"),
        #("3-08", 112, 48, 176, "#7030B0", "3"),
        #("3-09", 112, 112, 112, "#707070", "3"),
        #("3-10", 112, 112, 176, "#7070B0", "3"),
        #("3-11", 112, 112, 240, "#7070F0", "3"),
        #("3-12", 112, 176, 48, "#70B030", "3"),
        #("4-01", 112, 176, 112, "#70B070", "4"),
        #("4-02", 112, 176, 240, "#70B0F0", "4"),
        #("4-03", 112, 240, 112, "#70F070", "4"),
        #("4-04", 112, 240, 176, "#70F0B0", "4"),
        #("4-05", 112, 240, 240, "#70F0F0", "4"),
        #("4-06", 176, 48, 48, "#B03030", "4"),
        #("4-07", 176, 48, 176, "#B030B0", "4"),
        #("4-08", 176, 48, 240, "#B030F0", "4"),
        #("4-09", 176, 112, 48, "#B07030", "4"),
        #("4-10", 176, 112, 112, "#B07070", "4"),
        #("4-11", 176, 112, 240, "#B070F0", "4"),
        #("4-12", 176, 176, 48, "#B0B030", "4"),
        #("4-13", 176, 176, 176, "#B0B0B0", "4"),
        #("4-14", 176, 240, 48, "#B0F030", "4")
    )

    local boxHeight = units.decodeValue "315cm"
    local boxLength = units.decodeValue "500cm"
    local boxWidth = units.decodeValue "1000cm"
    local gap = units.decodeValue "100cm"
    local gridColumns = 9
    local gridOrigin = [33523, 12000, 0] * (units.decodeValue "1cm")

    local apartmentIds = #()
    local maskHexes = #()
    local allNodes = #()
    local createdNodes = #()
    local sceneNodes = objects as array

    -- Validate the complete palette and scene before making any changes.
    if rows.count != 53 do throw "MillGarden masks: the palette must contain exactly 53 apartments."

    for row in rows do
    (
        if row.count != 6 do throw "MillGarden masks: malformed palette row."
        if (findItem apartmentIds row[1]) != 0 do throw ("MillGarden masks: duplicate palette apartment " + row[1])
        if (findItem maskHexes row[5]) != 0 do throw ("MillGarden masks: duplicate palette color " + row[5])
        if (findItem #("1", "2", "3", "4") row[6]) == 0 do throw ("MillGarden masks: unknown building for " + row[1])
        for channelIndex = 2 to 4 do
        (
            local channelValue = row[channelIndex]
            if channelValue < 0 or channelValue > 255 or channelValue != (channelValue as integer) do
                throw ("MillGarden masks: invalid RGB channel for " + row[1])
        )
        if row[2] == 0 and row[3] == 0 and row[4] == 0 do
            throw ("MillGarden masks: black is reserved for background, not " + row[1])
        append apartmentIds row[1]
        append maskHexes row[5]
        append allNodes undefined
    )

    for sceneNode in sceneNodes do
    (
        if (getUserPropVal sceneNode "MillGardenMaskOwner" asString:true) == ownerTag do
        (
            local existingId = getUserPropVal sceneNode "ApartmentId" asString:true
            local rowIndex = findItem apartmentIds existingId
            if rowIndex == 0 do
                throw ("MillGarden masks: owned object has an unknown or missing ApartmentId: " + sceneNode.name)
            if allNodes[rowIndex] != undefined do
                throw ("MillGarden masks: multiple owned objects use ApartmentId " + existingId + ". Resolve the duplicate before running again.")
            allNodes[rowIndex] = sceneNode
        )
    )

    for rowIndex = 1 to rows.count do
    (
        local reservedName = "MG_MASK_" + rows[rowIndex][1]
        for sceneNode in sceneNodes where (toLower sceneNode.name) == (toLower reservedName) do
        (
            if sceneNode != allNodes[rowIndex] do
                throw ("MillGarden masks: reserved object name already belongs to another object: " + reservedName)
        )
    )

    undo "MillGarden apartment mask boxes" on
    (
        with redraw off
        (
            with animate off
            (
                for rowIndex = 1 to rows.count do
                (
                    local row = rows[rowIndex]
                    local maskNode = allNodes[rowIndex]

                    if maskNode == undefined do
                    (
                        local layerName = "MG_MASKS_" + row[6]
                        local maskLayer = LayerManager.getLayerFromName layerName
                        if maskLayer == undefined do maskLayer = LayerManager.newLayerFromName layerName

                        local gridColumn = mod (rowIndex - 1) gridColumns
                        local gridRow = floor ((rowIndex - 1) / (gridColumns as float))
                        local stagingPosition = gridOrigin + [gridColumn * (boxWidth + gap), -gridRow * (boxLength + gap), 0]

                        maskNode = box name:("MG_MASK_" + row[1]) height:boxHeight length:boxLength width:boxWidth pos:stagingPosition
                        maskLayer.addNode maskNode
                        allNodes[rowIndex] = maskNode
                        append createdNodes maskNode
                    )

                    maskNode.colorByLayer = false
                    maskNode.wirecolor = color row[2] row[3] row[4]
                    setUserPropVal maskNode "MillGardenMaskOwner" ownerTag
                    setUserPropVal maskNode "ApartmentId" row[1]
                    setUserPropVal maskNode "BuildingOrPhase" row[6]
                    setUserPropVal maskNode "MaskHex" row[5]
                    setUserPropVal maskNode "MaskPaletteVersion" paletteVersion
                )

                if selectCreated and createdNodes.count > 0 do select createdNodes
            )
        )
    )

    format "MillGarden masks: % apartments; % boxes created; % existing objects refreshed.\n" rows.count createdNodes.count (rows.count - createdNodes.count)
    format "New boxes are on MG_MASKS_1 / MG_MASKS_2 / MG_MASKS_3 / MG_MASKS_4 in a flat staging grid.\n"
    allNodes
)

if MillGardenMaskBoxes_AutoRun != false do MillGardenCreateApartmentMaskBoxes()
