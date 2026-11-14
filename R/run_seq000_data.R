#!/usr/bin/env Rscript
# Run the seq000 R stage end to end (bathymetry -> grid -> composite -> contract).
# Usage: Rscript R/run_seq000_data.R
suppressMessages({
  library(terra); library(jsonlite)
})
PROJECT_ROOT <- "/home/revlin/Projects/Currents/webxr-champlain-portal"
setwd(PROJECT_ROOT)
source("R/dem_functions.R")
source("R/sequence_functions.R")

INT <- "data/heightmaps/_intermediate"
dir.create(INT, showWarnings = FALSE, recursive = TRUE)
dir.create("data/scene", showWarnings = FALSE, recursive = TRUE)

cat("[1/5] fetch bathymetry points (paged) ...\n")
gj <- fetch_lake_bathy()
cat("      wrote", gj, "\n")

cat("[2/5] grid bathymetry onto terrain grid ...\n")
bathy_tif <- file.path(INT, "lake_bathy_utm.tif")
b <- grid_lake_bathy(gj, "data/heightmaps/_intermediate/terrain_composite_utm.tif",
                     out_tif = bathy_tif)
bv <- terra::values(b, na.rm = TRUE)
cat("      cells:", length(bv), " range(m):", round(min(bv), 2), "to", round(max(bv), 2), "\n")

cat("[3/5] merge bathymetry into terrain composite ...\n")
comp_tif <- file.path(INT, "terrain_full_utm.tif")
m <- merge_bathy_composite("data/heightmaps/_intermediate/terrain_composite_utm.tif",
                            bathy_tif, comp_tif)
cat("      composite written:", comp_tif, "\n")

cat("[4/5] export full heightmap PNG + sidecar (orientation contract) ...\n")
png_out <- export_dem_png(terra::rast(comp_tif), "data/heightmaps/lc_terrain_full.png")
cat("      png:", png_out, "\n")

cat("[5/5] write scene-control contract ...\n")
ctrl <- write_scene_control()
cat("      contract:", ctrl, "\n")
cat("DONE\n")
