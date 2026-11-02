# Mill Garden apartment picker data

Data and 3ds Max tools for the 53-apartment Mill Garden orbit picker. The JSON structure follows Admiral Park, with stable apartment IDs such as `1-01` and one unique RGB mask color per apartment.

## Files

- `data/apartments.json`: building/phase, floor, interior/terrace/garden areas, room count, source prices and availability, media references, mask color and box mapping.
- `data/apartment-details.json`: the same apartments plus 406 room entries and their floor areas and finishes.
- `data/apartment-mask-colors.json`: RGB/hex palette, object names, floor layers and staging positions.
- `data/orbit-sequence.json`: local frame hashes and the current Framer asset references.
- `tools/3dsmax/MillGardenApartmentMaskBoxes.ms`: create missing boxes without resetting existing geometry or transforms.
- `tools/3dsmax/OrganizeMillGardenApartmentBoxes.ms`: explicitly reposition the owned boxes into building/floor rows. Run only when you want to reset their staging positions.
- `sources/`: buyer booklet and the original frozen color palette.
- `validation/apartment-data-report.json`: apartment counts and room-area validation results.

## Scene arrangement

Viewed from above: building 1 at upper left, building 2 at upper right, building 3 at lower left and phase 4 at lower right. Within each section, rows run from ground floor to first floor to second floor/roof level. Apartment numbers increase left to right.

Floor layers `MG_MASKS_1_F00` through `MG_MASKS_4_F02` sit under their building layers. Object names and colors remain stable when the boxes are moved or reshaped. Each box begins at 1000 x 500 x 315 cm. These are mapping placeholders, not measured apartment envelopes.

## Source and missing assets

Areas, floors, room lists, source prices and source availability come from `sources/Mill-Garden-buyer-booklet.pdf`. Its price schedule is dated July 2026. These records are not a live availability feed. Phase 4 is preliminary. The Otthon Start field records only the booklet's price-eligibility indication, not buyer eligibility.

Floorplan images, floor-layout images, orientation, apartment type classification and plan-marker coordinates are not supplied and remain null/empty. The PDF links lead to the relevant room-data pages; they are not floorplan image substitutes. Seven sold apartments are retained with null prices.

## Orbit images

The current Framer component `MillGardenOrbit.tsx` uses 80 uploaded Framer image assets, with four checkpoints at frames 0, 20, 40 and 60. It is not configured to read images or apartment JSON from this Git repository. The original JPEGs are stored at `data/Orbit SEQ/V01/orbit0000.jpg` through `orbit0079.jpg`. `data/orbit-sequence.json` records each local SHA-256 and the corresponding Framer asset reference; temporary upload URLs are excluded.

The mapping boxes still need to be positioned around the actual apartments, followed by aligned color-mask renders. Adding data to GitHub does not by itself connect these masks to the Framer viewer. A private GitHub repository also cannot serve unauthenticated public JSON requests directly.

## Rebuild data

Install `requirements.txt`, then run `python scripts/build_apartment_data.py`. The source palette is frozen so rebuilding does not change colors. The generator checks all apartment identities and compares room, terrace and garden totals against the 53 schedule records. It does not change the Max scene. Run the Max scripts separately.
