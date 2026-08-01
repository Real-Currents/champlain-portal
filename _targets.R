# targets pipeline: Lake Champlain DEM ETL
# ----------------------------------------
# Ingests source DEMs, reprojects to a common metric CRS (UTM 18N), crops to
# scene-relevant extents around the source-video camera, and exports 16-bit
# grayscale PNG heightmaps (+ JSON elevation-range sidecars) for Blender
# displacement and rayshader preview.
#
# Rasters are passed between targets as GeoTIFF file paths (format = "file"),
# not as in-memory SpatRaster objects, because terra external pointers cannot
# be serialized into the targets store.
#
# Run:   Rscript -e 'targets::tar_make()'
# Graph: Rscript -e 'targets::tar_visnetwork()'
#
# === Orientation contract (CRITICAL — see R/dem_functions.R for full text) ===
# Output heightmap PNGs are north-up; JSON sidecar UTM bounds reflect this.
# Blender import convention:  +Y_world = real-North,  +X_world = real-East.
# Verified by R/tests/test_orientation.R.
#
# === Near-shore quadrant assembly (CRITICAL) ===
# Near-shore DEMHF tiles are assembled in NE -> NW -> SW -> SE quadrant order
# via load_dem_tiles_ordered(): the NE tile (N4319E897 = camera anchor) is the
# mosaic anchor; subsequent tiles fill outward, attached to the previous
# quadrant's edge with NA-fill semantics (terra::cover), so no overlap blur.
# The NE tile's NE corner becomes the mosaic's NE corner by construction.

library(targets)
library(tarchetypes)

tar_option_set(packages = c("terra", "png", "rayshader", "jsonlite"))
tar_source("R/dem_functions.R")

# Source-video camera location (Vermont shore, looking NW).
CAM_LON <- -73.358142
CAM_LAT <-  44.198689

INT <- "data/heightmaps/_intermediate"  # GeoTIFF intermediates

# Explicit DEMHF tile order anchors the mosaic at the NE corner (camera tile,
# N4319E897) and fills outward: NE -> NW -> SW -> SE. See the quadrant-assembly
# note in the header above.
NEAR_TILES_ORDERED <- c(
  "data/Elevation_DEMHF0p7M2017_N4319E897-NE.tif",  # NE (camera anchor)
  "data/Elevation_DEMHF0p7M2017_N4305E897-NW.tif",  # NW
  "data/Elevation_DEMHF0p7M2017_N4305E883-SW.tif",  # SW
  "data/Elevation_DEMHF0p7M2017_N4319E883-SE.tif"   # SE
)

list(
  # ── Near-shore DEM: 0.7m DEMHF tiles (Vermont State Plane) → UTM 18N tif ────
  tar_target(near_dem_paths, NEAR_TILES_ORDERED, format = "file"),
  tar_target(near_dem_utm_tif,
    write_dem_tif(
      load_dem_tiles_ordered(near_dem_paths, crs_epsg = 32618),
      file.path(INT, "near_utm.tif")),
    format = "file"),

  # ── Unified terrain: DEMHF (SE corner) + calibrated SRTM extension ──────────
  # Single composite raster covering 15km radius. SE corner = pure DEMHF
  # averaged to 5m. Outside DEMHF footprint: corrected SRTM (bias -1.13m)
  # interpolated to 5m, with a 50m linear blend at the DEMHF boundary.
  # DEMHF wins where it exists (blend_weight = 0 inside its rectangle).
  tar_target(srtm_path, "data/N44W074.SRTMGL1.hgt/N44W074.hgt", format = "file"),
  tar_target(terrain_composite_tif,
    write_dem_tif(
      extend_dem_with_srtm(near_dem_utm_tif, srtm_path, CAM_LON, CAM_LAT,
                            radius_m = 15000, out_res_m = 5,
                            report_path = "data/heightmaps/srtm_calibration.json"),
      file.path(INT, "terrain_composite_utm.tif")),
    format = "file"),

  # ── Heightmap exports ──────────────────────────────────────────────────────
  # lc_terrain.png  → single authoritative Blender displacement map (30km)
  # lc_near_shore.png → kept for Quarto/rayshader preview only (not used in Blender)
  tar_target(terrain_png,
    export_dem_png(
      terra::rast(terrain_composite_tif),
      "data/heightmaps/lc_terrain.png"),
    format = "file"),
  tar_target(near_shore_png,
    export_dem_png(
      terra::rast(near_dem_utm_tif),
      "data/heightmaps/lc_near_shore.png"),
    format = "file"),

  # ── Section crops for the Quarto rayshader preview ──────────────────────────
  tar_target(section_near_shore_png,
    export_dem_png(
      crop_dem_to_radius(terra::rast(near_dem_utm_tif), CAM_LON, CAM_LAT, 500),
      "data/heightmaps/lc_section_near_shore.png"),
    format = "file")
)
