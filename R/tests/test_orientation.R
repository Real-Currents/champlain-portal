# Smoke test for the DEM ETL orientation contract.
#
# Run from project root:  Rscript R/tests/test_orientation.R
#
# Verifies that:
#   - lc_near_shore.png + JSON sidecar exist and are internally consistent
#   - lc_far_terrain.png + JSON sidecar exist and are internally consistent
#   - UTM bounds are valid (xmax > xmin, ymax > ymin)
#   - dims and bounds agree with declared px_size_m / py_size_m
#   - Sampling the heightmap at the camera anchor's UTM coord gives a finite
#     elevation in the expected range (e.g. NearShore samples lake level
#     around 29.5m ASL near the camera anchor)
#
# Exits with status 1 on any failure (so it can gate CI later).

suppressMessages({
  library(jsonlite)
  library(png)
})

PROJECT_ROOT <- "/home/revlin/Projects/Currents/webxr-champlain-portal"
HM_DIR       <- file.path(PROJECT_ROOT, "data", "heightmaps")
CAM_LON      <- -73.358142
CAM_LAT      <-  44.198689
LAKE_ASL     <-  29.5

# Camera anchor in UTM 18N (precomputed; matches R/terra reprojection).
CAM_E <- 631195.0
CAM_N <- 4895252.0

# Cross-system colored output (no extra deps).
ok   <- function(msg) cat("\033[32mOK\033[0m   ", msg, "\n", sep = "")
fail <- function(msg) { cat("\033[31mFAIL\033[0m ", msg, "\n", sep = ""); quit(status = 1) }

assert <- function(cond, msg) if (isTRUE(cond)) ok(msg) else fail(msg)

check_layer <- function(name, expected_z_min_range, expected_z_max_range,
                        sample_z_at_cam_range = NULL) {
  cat("\n--- ", name, " ---\n", sep = "")
  png_path  <- file.path(HM_DIR, paste0(name, ".png"))
  json_path <- file.path(HM_DIR, paste0(name, ".png.json"))
  assert(file.exists(png_path),  paste(png_path,  "exists"))
  assert(file.exists(json_path), paste(json_path, "exists"))

  meta <- jsonlite::fromJSON(json_path)

  # Required fields
  required <- c("z_min_m","z_max_m","z_range_m","px_size_m","py_size_m",
                "nrow","ncol","crs","xmin","xmax","ymin","ymax")
  missing <- setdiff(required, names(meta))
  assert(length(missing) == 0, paste("JSON has all required fields (missing:",
                                     if (length(missing)) paste(missing, collapse=",") else "none", ")"))

  # Bounds sanity
  assert(meta$xmax > meta$xmin, "xmax > xmin")
  assert(meta$ymax > meta$ymin, "ymax > ymin")
  assert(meta$nrow > 0 && meta$ncol > 0, "nrow > 0 and ncol > 0")
  assert(meta$crs == "32618" || meta$crs == 32618, "CRS is UTM 18N (EPSG:32618)")

  # Dims agree with px_size and bounds (within rounding tolerance)
  expected_W <- meta$px_size_m * meta$ncol
  expected_H <- meta$py_size_m * meta$nrow
  actual_W   <- meta$xmax - meta$xmin
  actual_H   <- meta$ymax - meta$ymin
  assert(abs(expected_W - actual_W) < meta$px_size_m * 2,
         sprintf("width matches px_size_m*ncol (expect %.1f, got %.1f)", expected_W, actual_W))
  assert(abs(expected_H - actual_H) < meta$py_size_m * 2,
         sprintf("height matches py_size_m*nrow (expect %.1f, got %.1f)", expected_H, actual_H))

  # Elevation range plausibility
  assert(meta$z_min_m >= expected_z_min_range[1] && meta$z_min_m <= expected_z_min_range[2],
         sprintf("z_min_m (%.2f) in expected range [%.1f, %.1f]",
                 meta$z_min_m, expected_z_min_range[1], expected_z_min_range[2]))
  assert(meta$z_max_m >= expected_z_max_range[1] && meta$z_max_m <= expected_z_max_range[2],
         sprintf("z_max_m (%.2f) in expected range [%.1f, %.1f]",
                 meta$z_max_m, expected_z_max_range[1], expected_z_max_range[2]))

  # Sample at camera anchor UTM (if it falls inside this layer's bounds)
  if (CAM_E >= meta$xmin && CAM_E <= meta$xmax &&
      CAM_N >= meta$ymin && CAM_N <= meta$ymax) {
    img <- png::readPNG(png_path)               # 16-bit -> matrix or array
    # 3D array (RGBA-like) -> take first channel; 2D -> use as-is.
    if (length(dim(img)) == 3) img <- img[, , 1]
    # North-up image: row 0 = top = max-N
    col <- round((CAM_E - meta$xmin) / (meta$xmax - meta$xmin) * (meta$ncol - 1)) + 1
    row <- round((meta$ymax - CAM_N) / (meta$ymax - meta$ymin) * (meta$nrow - 1)) + 1
    pv  <- img[row, col]                        # in [0,1]
    z_real <- meta$z_min_m + pv * meta$z_range_m
    cat(sprintf("       sample at cam UTM (col=%d,row=%d): pixel=%.4f -> elev=%.2f m ASL\n",
                col, row, pv, z_real))
    assert(is.finite(z_real),
           sprintf("sample at camera anchor is finite (got %.2f)", z_real))
    if (!is.null(sample_z_at_cam_range)) {
      assert(z_real >= sample_z_at_cam_range[1] && z_real <= sample_z_at_cam_range[2],
             sprintf("sample at camera anchor (%.2f m ASL) in expected range [%.1f, %.1f]",
                     z_real, sample_z_at_cam_range[1], sample_z_at_cam_range[2]))
    }
  } else {
    cat("       camera anchor outside this layer's bounds (skipping sample test)\n")
  }
}

cat("=== DEM ETL orientation + integrity smoke test ===\n")
cat(sprintf("Camera anchor: %.6f N, %.6f W -> UTM 18N (%.0f, %.0f)\n",
            CAM_LAT, CAM_LON, CAM_E, CAM_N))

# Near-shore: VT bank, 0.7m DEMHF (preview/QC only — not used in Blender).
# z_min should be ~lake surface (28-30m ASL), z_max < 100m (low bank).
check_layer("lc_near_shore",
            expected_z_min_range = c(25, 32),
            expected_z_max_range = c(40, 120),
            sample_z_at_cam_range = c(28, 32))

# Unified terrain: single authoritative Blender heightmap (30km, 5m/px).
# SE corner = DEMHF averaged to 5m; extension = calibrated SRTM.
# z_min ~lake surface (20-30m), z_max ~Adirondack peaks (600m+).
# Camera anchor is in the DEMHF zone → sample should be ~29m ASL.
check_layer("lc_terrain",
            expected_z_min_range = c(0, 30),
            expected_z_max_range = c(400, 1700),
            sample_z_at_cam_range = c(25, 35))

cat("\n\033[32mAll orientation/integrity checks PASSED.\033[0m\n")
