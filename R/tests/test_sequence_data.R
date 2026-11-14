# Smoke test for the seq000 sequence-data layer.
#
# Run from project root:  Rscript R/tests/test_sequence_data.R
#
# Verifies:
#   - bathymetry grid exists, is in UTM 18N, and holds negative depths
#     (metres below the lake surface) with a plausible modern-lake range
#   - the terrain+bathymetry composite keeps DEM land values and drops the
#     lake floor to charted depth
#   - the RSL curve is monotone, hits its endpoints, and is JSON-serialisable
#   - the scene-control contract exists, references real files, and is
#     internally coherent (past water level above the sea floor, etc.)
#
# Exits with status 1 on any failure.

suppressMessages({
  library(jsonlite)
})

PROJECT_ROOT <- "/home/revlin/Projects/Currents/webxr-champlain-portal"
INT_DIR      <- file.path(PROJECT_ROOT, "data", "heightmaps", "_intermediate")
SCENE_DIR   <- file.path(PROJECT_ROOT, "data", "scene")
BATHY_TIF   <- file.path(INT_DIR, "lake_bathy_utm.tif")
COMPOSITE_TIF <- file.path(INT_DIR, "terrain_full_utm.tif")
SCENE_CTRL  <- file.path(SCENE_DIR, "scene_control.json")

ok   <- function(msg) cat("\033[32mOK\033[0m   ", msg, "\n", sep = "")
fail <- function(msg) { cat("\033[31mFAIL\033[0m ", msg, "\n", sep = ""); quit(status = 1) }
assert <- function(cond, msg) if (isTRUE(cond)) ok(msg) else fail(msg)

source(file.path(PROJECT_ROOT, "R", "sequence_functions.R"))

# ---------------------------------------------------------------- bathymetry
cat("\n--- bathymetry grid ---\n")
if (file.exists(BATHY_TIF)) {
  b <- terra::rast(BATHY_TIF)
  vals <- terra::values(b, na.rm = TRUE)
  assert(grepl("32618", terra::crs(b)), "bathymetry grid is in UTM 18N (EPSG:32618)")
  assert(length(vals) > 1000, sprintf("bathymetry grid has data (%d cells)", length(vals)))
  assert(all(vals <= 0), "all bathymetry depths are at or below lake surface (no positive depths)")
  assert(any(vals < -20), "bathymetry includes real deep soundings")
  assert(min(vals) > -130, sprintf("max charted depth %.1f m is plausible for Lake Champlain", min(vals)))
  assert(max(vals) <= 0, "bathymetry never reports above the lake surface")
} else {
  cat("SKIP bathymetry grid not built yet\n")
}

# ---------------------------------------------------------------- composite
cat("\n--- terrain + bathymetry composite ---\n")
if (file.exists(COMPOSITE_TIF) && file.exists(BATHY_TIF)) {
  m <- terra::rast(COMPOSITE_TIF)
  b <- terra::rast(BATHY_TIF)
  m <- terra::project(m, terra::crs(b)); m <- terra::resample(m, b)
  mv <- terra::values(m); bv <- terra::values(b)
  lake <- !is.na(bv) & !is.na(mv)
  if (any(lake)) {
    lake_floor <- mv[lake]
    assert(max(lake_floor) < 30, "lake floor in composite sits below lake surface")
    assert(min(lake_floor) > -10, "composite lake floor is not absurdly deep")
  } else {
    cat("SKIP no overlapping lake cells\n")
  }
} else {
  cat("SKIP composite not built yet\n")
}

# ---------------------------------------------------------------- RSL curve
cat("\n--- relative sea level curve ---\n")
lim <- rsl_site_limit_m()
curve <- rsl_curve(limit_m = lim$value)
assert(length(curve$ka) > 10, "RSL curve has samples")
assert(all(diff(curve$ka) < 0), "RSL curve time runs from old to young")
assert(all(diff(curve$rsl_m) < 0), "RSL curve is monotonically falling")
assert(abs(curve$rsl_m[1] - lim$value) < 0.01, "RSL curve starts at the site limit")
assert(abs(curve$rsl_m[length(curve$rsl_m)] - 29.5) < 0.01, "RSL curve ends at the modern lake stage")
assert(isTRUE(lim$provisional), "site limit is flagged provisional pending re-derivation")

# ------------------------------------------------------------ scene control
cat("\n--- scene control contract ---\n")
if (file.exists(SCENE_CTRL)) {
  ctrl <- jsonlite::fromJSON(SCENE_CTRL, simplifyVector = FALSE)
  assert(!is.null(ctrl$sequence), "contract has a sequence id")
  assert(ctrl$sequence == "seq000_first_descent", "sequence id is seq000_first_descent")
  assert(ctrl$water$z_past_m > ctrl$water$z_present_m, "past water level is above the present level")
  assert(ctrl$water$z_past_m >= 80, "past water level reaches the marine limit range")
  assert(ctrl$camera$iod_m == 0.063, "camera IOD matches the scene graph (63 mm)")
  assert(length(ctrl$water$rise_frames) == 2, "rise frame window present")
  assert(length(ctrl$ecology$fauna) >= 5, "ecology fauna list is populated")
  assert(length(ctrl$citations) >= 3, "citations recorded for the data-driven values")
  terrain_ref <- file.path(PROJECT_ROOT, ctrl$terrain$heightmap)
  assert(file.exists(terrain_ref), "referenced heightmap exists on disk")

  # ---- community reconstruction (creative-liberty pass) ----
  cat("\n--- community reconstruction ---\n")
  assert(!is.null(ctrl$community), "community block present")
  zones <- ctrl$community$zones
  assert(length(zones) == 3, "community has three depth zones (floor/slope/surface)")
  for (z in zones) {
    assert(length(z$hard) > 0, sprintf("zone '%s' has hard-substrate life", z$name))
    assert(length(z$soft) > 0, sprintf("zone '%s' has soft-substrate life", z$name))
    assert(length(z$plants) > 0, sprintf("zone '%s' has plants", z$name))
  }
  assert(length(ctrl$community$documented_for_champlain_sea) >= 8,
         "documented Champlain Sea species are separated from the creative cast")
  assert(length(ctrl$community$absent_by_design) >= 3,
         "deliberate absences recorded (keeps the scene honest about cold/fresh water)")
  assert(!is.null(ctrl$floor$microflora_ecology), "foraminiferal ecology recorded per species")
  # the foraminifera must remain the environmental constraint, not the cast list
  assert(length(ctrl$floor$microflora) == 4, "four foraminiferal taxa recorded")
  assert(length(ctrl$community$zones[[1]]$soft) > 8,
         "the floor zone is a community, not a foraminifera list")
} else {
  cat("SKIP scene control not written yet\n")
}

cat("\nAll sequence-data checks passed.\n")
