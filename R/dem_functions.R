# DEM processing functions for the Lake Champlain terrain ETL pipeline.
# Sourced by _targets.R and dem_preview.qmd.
#
# Source DEMs:
#   - Elevation_DEMHF0p7M2017_*.img : 0.7m, Vermont State Plane (EPSG:32145), near-shore
#   - N44W074.SRTMGL1.hgt           : ~30m SRTM, lon/lat (EPSG:4326), regional + Adirondacks
#
# Camera (source video) location: 44.198689 N, -73.358142 W, looking NW.
#
# === Orientation contract (CRITICAL — consumed by Blender) ===
# Output PNGs are north-up: image row 0 is max-N, row (nrow-1) is min-N;
# image col 0 is min-E, col (ncol-1) is max-E. The JSON sidecar's
# xmin/xmax/ymin/ymax are in UTM 18N meters and reflect this orientation.
#
# Blender consumers MUST place the displaced grid such that the PNG's UV
# coordinates (0,0)->(1,1) map to world (xmin,ymin)->(xmax,ymax) under:
#   +Y_world = real-North,  +X_world = real-East
# This is satisfied by Blender's primitive_grid_add (default UVs) plus a
# Displace modifier (texture_coords='UV', direction='Z') on a mesh with
# zero Z-rotation on both the mesh itself and any instance handle.
# Do not rotate the linked-collection instance about Z; if a different
# camera bearing is needed, rotate the CAMERA instead.

# NULL-coalescing helper (base R has none).
`%||%` <- function(a, b) if (is.null(a)) b else a

# Load and mosaic one or more raster tiles into a single SpatRaster.
load_dem_tiles <- function(paths) {
  tiles <- lapply(paths, terra::rast)
  if (length(tiles) == 1) return(tiles[[1]])
  rsc <- terra::sprc(tiles)
  terra::mosaic(rsc, fun = "mean")
}

# Load DEM tiles in a specific quadrant order and assemble a seamless mosaic.
#
# Unlike load_dem_tiles() (which averages overlapping pixels with
# terra::mosaic(fun="mean") and produces a blurred seam at shared edges), this
# function:
#   1. Reprojects every tile to a common CRS (default UTM 18N).
#   2. Builds a single shared grid that is the union of all tile extents,
#      snapped to the *first* tile's resolution + origin (the "anchor"). The
#      anchor's NE corner therefore becomes the mosaic's NE corner exactly.
#   3. Resamples every tile onto that shared grid (bilinear).
#   4. Sequentially composes them with terra::cover(): the anchor's values
#      "win" everywhere it has data; each subsequent tile fills only the cells
#      still NA. No overlap averaging; the join is deterministic and sharp.
#
# Pass `paths` in the order you want the quadrants laid down, e.g. for our
# Lake Champlain DEMHF tiles: NE -> NW -> SW -> SE.
load_dem_tiles_ordered <- function(paths, crs_epsg = 32618) {
  stopifnot(length(paths) >= 1)
  tiles <- lapply(paths, function(p) terra::project(terra::rast(p),
                                                    paste0("EPSG:", crs_epsg)))
  if (length(tiles) == 1) return(tiles[[1]])
  combined_ext <- Reduce(terra::union, lapply(tiles, terra::ext))
  grid <- terra::extend(tiles[[1]], combined_ext)
  aligned <- lapply(tiles, terra::resample, grid, method = "bilinear")
  result <- aligned[[1]]
  for (i in seq_along(aligned)[-1]) {
    result <- terra::cover(result, aligned[[i]])
  }
  result
}

# Reproject a SpatRaster to a target CRS given as a numeric/character EPSG code.
reproject_dem <- function(dem, crs_epsg) {
  terra::project(dem, paste0("EPSG:", crs_epsg))
}

# Write a SpatRaster to a GeoTIFF and return the path.
# Used to pass rasters between {targets} steps as files, since SpatRaster
# external pointers cannot be serialized into the targets store.
write_dem_tif <- function(dem, out_path) {
  dir.create(dirname(out_path), recursive = TRUE, showWarnings = FALSE)
  terra::writeRaster(dem, out_path, overwrite = TRUE)
  out_path
}

# Crop a DEM to a square bounding box around a lon/lat point.
# radius_m is half the box side length, in the DEM's (projected) units.
crop_dem_to_radius <- function(dem, lon, lat, radius_m) {
  center <- terra::vect(cbind(lon, lat), crs = "EPSG:4326")
  center <- terra::project(center, terra::crs(dem))
  xy <- terra::crds(center)
  ext <- terra::ext(
    xy[1] - radius_m, xy[1] + radius_m,
    xy[2] - radius_m, xy[2] + radius_m
  )
  terra::crop(dem, ext)
}

# Convert a SpatRaster to a numeric elevation matrix oriented for rayshader
# (rows = south->north ascending). terra::as.matrix gives north->south (raster
# row order), so we flip rows to match rayshader's expectation.
dem_to_matrix <- function(dem) {
  m <- terra::as.matrix(dem, wide = TRUE)
  m[nrow(m):1, ]
}

# Normalize an elevation matrix to [0,1] using a fixed or data-derived range.
# NA cells (e.g. outside coverage) map to 0. Returns list(mat, z_min, z_max)
# so the elevation range can be recorded for Blender displacement scaling.
normalize_elevation <- function(mat, z_min = NULL, z_max = NULL) {
  z_min <- z_min %||% min(mat, na.rm = TRUE)
  z_max <- z_max %||% max(mat, na.rm = TRUE)
  norm <- (mat - z_min) / (z_max - z_min)
  norm[is.na(norm)] <- 0
  norm[norm < 0] <- 0
  norm[norm > 1] <- 1
  list(mat = norm, z_min = z_min, z_max = z_max)
}

# Export a DEM as a 16-bit grayscale PNG heightmap for Blender displacement.
# Elevation is normalized to the full 16-bit range [0, 65535]; NA cells map to 0.
# Written through terra/GDAL (north-up, standard image orientation) so the PNG
# aligns with Blender's displacement texture sampling.
# Writes a sidecar <out_path>.json recording z_min/z_max (meters), pixel size,
# and dims so the real elevation range can be reconstructed as a Blender
# displacement Z-scale. Returns out_path (for targets file tracking).
export_dem_png <- function(dem, out_path, z_min = NULL, z_max = NULL) {
  dir.create(dirname(out_path), recursive = TRUE, showWarnings = FALSE)
  vals <- terra::values(dem)
  z_min <- z_min %||% min(vals, na.rm = TRUE)
  z_max <- z_max %||% max(vals, na.rm = TRUE)
  norm <- (dem - z_min) / (z_max - z_min)
  norm <- terra::clamp(norm, 0, 1, values = TRUE)
  norm16 <- round(norm * 65535)
  terra::writeRaster(norm16, out_path, datatype = "INT2U",
                     overwrite = TRUE, NAflag = 0)
  res <- terra::res(dem)
  e <- terra::ext(dem)
  meta <- list(
    path = out_path,
    z_min_m = z_min, z_max_m = z_max, z_range_m = z_max - z_min,
    px_size_m = res[1], py_size_m = res[2],
    nrow = terra::nrow(dem), ncol = terra::ncol(dem),
    crs = terra::crs(dem, describe = TRUE)$code,
    # UTM bounds (meters) so Blender can position non-camera-centered DEMs.
    xmin = e$xmin, xmax = e$xmax, ymin = e$ymin, ymax = e$ymax
  )
  writeLines(
    jsonlite::toJSON(meta, auto_unbox = TRUE, pretty = TRUE),
    paste0(out_path, ".json")
  )
  out_path
}

# === SRTM↔DEMHF calibrated reconciliation ===
# These functions implement slope-consistent extension of the authoritative
# DEMHF mosaic using lower-resolution SRTM data for far-terrain coverage.

# Phase A: Calibrate SRTM against DEMHF in their overlap region.
# Aggregates DEMHF to SRTM resolution, computes per-cell bias, fits a linear
# trend surface bias(x,y) = a + bx + cy, and returns a corrected SRTM raster
# plus a calibration report.
calibrate_srtm_to_demhf <- function(demhf, srtm) {
  overlap_ext <- terra::intersect(terra::ext(demhf), terra::ext(srtm))
  demhf_crop <- terra::crop(demhf, overlap_ext)
  srtm_crop  <- terra::crop(srtm, overlap_ext)

  demhf_agg <- terra::resample(demhf_crop, srtm_crop, method = "average")

  bias <- srtm_crop - demhf_agg
  bias_vals <- terra::values(bias)
  valid <- !is.na(bias_vals) & !is.na(terra::values(demhf_agg))
  bias_clean <- bias_vals[valid]

  bias_mean <- mean(bias_clean)
  bias_sd   <- sd(bias_clean)

  xy <- terra::xyFromCell(srtm_crop, which(valid))
  cx <- mean(xy[, 1]); cy <- mean(xy[, 2])
  xs <- xy[, 1] - cx; ys <- xy[, 2] - cy

  fit <- tryCatch(
    lm(bias_clean ~ xs + ys),
    error = function(e) NULL
  )

  if (!is.null(fit) && summary(fit)$r.squared > 0.05) {
    a <- coef(fit)[1]; b <- coef(fit)[2]; c_coef <- coef(fit)[3]
    all_xy <- terra::xyFromCell(srtm, seq_len(terra::ncell(srtm)))
    correction <- a + b * (all_xy[, 1] - cx) + c_coef * (all_xy[, 2] - cy)
    corrected <- srtm
    terra::values(corrected) <- terra::values(srtm) - correction
    trend_type <- "linear"
  } else {
    corrected <- srtm - bias_mean
    a <- bias_mean; b <- 0; c_coef <- 0
    trend_type <- "uniform"
  }

  report <- list(
    n_overlap_cells = sum(valid),
    bias_mean_m = bias_mean,
    bias_sd_m = bias_sd,
    bias_min_m = min(bias_clean),
    bias_max_m = max(bias_clean),
    trend_type = trend_type,
    trend_coefficients = list(intercept = a, slope_x = b, slope_y = c_coef),
    trend_center_utm = c(cx, cy),
    r_squared = if (!is.null(fit)) summary(fit)$r.squared else NA
  )

  list(corrected_srtm = corrected, report = report)
}

# Phase B: Validate edge slopes — cross-check corrected SRTM against DEMHF
# edge gradients at the N and W boundaries.
validate_edge_slopes <- function(demhf, corrected_srtm, edge_band_px = 15) {
  e <- terra::ext(demhf)
  res_m <- terra::res(demhf)[1]
  band_m <- edge_band_px * res_m

  n_band <- terra::crop(demhf, terra::ext(e$xmin, e$xmax,
                                          e$ymax - band_m, e$ymax))
  w_band <- terra::crop(demhf, terra::ext(e$xmin, e$xmin + band_m,
                                          e$ymin, e$ymax))

  n_slope <- terra::terrain(n_band, v = "slope", unit = "radians")
  n_aspect <- terra::terrain(n_band, v = "aspect", unit = "radians")
  w_slope <- terra::terrain(w_band, v = "slope", unit = "radians")
  w_aspect <- terra::terrain(w_band, v = "aspect", unit = "radians")

  srtm_ext <- terra::ext(corrected_srtm)
  n_adj_ext <- terra::ext(e$xmin, e$xmax,
                          e$ymax, min(e$ymax + 500, srtm_ext$ymax))
  w_adj_ext <- terra::ext(max(e$xmin - 500, srtm_ext$xmin), e$xmin,
                          e$ymin, e$ymax)

  residuals_n <- c()
  residuals_w <- c()

  if (n_adj_ext$ymax > n_adj_ext$ymin) {
    srtm_n <- terra::crop(corrected_srtm, n_adj_ext)
    n_edge_vals <- terra::values(terra::crop(demhf,
                    terra::ext(e$xmin, e$xmax, e$ymax - res_m, e$ymax)))
    n_edge_mean <- mean(n_edge_vals, na.rm = TRUE)
    n_slope_vals <- terra::values(n_slope)
    mean_slope_n <- mean(n_slope_vals, na.rm = TRUE)

    srtm_n_vals <- terra::values(srtm_n)
    srtm_n_xy <- terra::xyFromCell(srtm_n, seq_len(terra::ncell(srtm_n)))
    dist_from_edge <- srtm_n_xy[, 2] - e$ymax
    z_projected <- n_edge_mean + dist_from_edge * tan(mean_slope_n)
    valid_n <- !is.na(srtm_n_vals)
    if (any(valid_n)) {
      residuals_n <- srtm_n_vals[valid_n] - z_projected[valid_n]
    }
  }

  if (w_adj_ext$xmax > w_adj_ext$xmin) {
    srtm_w <- terra::crop(corrected_srtm, w_adj_ext)
    w_edge_vals <- terra::values(terra::crop(demhf,
                    terra::ext(e$xmin, e$xmin + res_m, e$ymin, e$ymax)))
    w_edge_mean <- mean(w_edge_vals, na.rm = TRUE)
    w_slope_vals <- terra::values(w_slope)
    mean_slope_w <- mean(w_slope_vals, na.rm = TRUE)

    srtm_w_vals <- terra::values(srtm_w)
    srtm_w_xy <- terra::xyFromCell(srtm_w, seq_len(terra::ncell(srtm_w)))
    dist_from_edge <- e$xmin - srtm_w_xy[, 1]
    z_projected <- w_edge_mean + dist_from_edge * tan(mean_slope_w)
    valid_w <- !is.na(srtm_w_vals)
    if (any(valid_w)) {
      residuals_w <- srtm_w_vals[valid_w] - z_projected[valid_w]
    }
  }

  all_res <- c(residuals_n, residuals_w)
  all_res <- all_res[is.finite(all_res)]
  list(
    n_edge_residuals = length(residuals_n),
    w_edge_residuals = length(residuals_w),
    residual_mean_m = if (length(all_res) > 0) mean(all_res) else NA,
    residual_sd_m   = if (length(all_res) > 0) sd(all_res) else NA,
    residual_max_m  = if (length(all_res) > 0) max(abs(all_res)) else NA
  )
}

# Phase C: Build a composite DEM — DEMHF wins in its coverage, bias-corrected
# SRTM fills beyond, with a linear blend at the seam.
extend_dem_with_srtm <- function(demhf_tif, srtm_path, cam_lon, cam_lat,
                                  radius_m = 15000, out_res_m = 5,
                                  blend_width_m = 300, edge_band_px = 15,
                                  report_path = NULL) {
  demhf <- terra::rast(demhf_tif)
  srtm  <- terra::project(terra::rast(srtm_path), "EPSG:32618", method = "cubicspline")
  srtm_crop <- crop_dem_to_radius(srtm, cam_lon, cam_lat, radius_m)

  cal <- calibrate_srtm_to_demhf(demhf, srtm_crop)
  edge_report <- validate_edge_slopes(demhf, cal$corrected_srtm, edge_band_px)

  target_ext <- terra::ext(srtm_crop)
  template <- terra::rast(target_ext, resolution = out_res_m,
                          crs = terra::crs(demhf))

  demhf_on_grid <- terra::resample(demhf, template, method = "average")
  srtm_on_grid  <- terra::resample(cal$corrected_srtm, template, method = "cubicspline")

  demhf_ext <- terra::ext(demhf)
  dist_rast <- terra::rast(template)
  xy <- terra::xyFromCell(template, seq_len(terra::ncell(template)))

  # Circular blend boundary: distance from an inscribed circle centred on the
  # DEMHF footprint. This eliminates the four angular corners of the rectangular
  # DEMHF tile boundary that would otherwise read as a square artifact in renders.
  # The DEMHF data still covers the full rectangle; only the blend onset changes.
  cx <- (demhf_ext$xmin + demhf_ext$xmax) / 2
  cy <- (demhf_ext$ymin + demhf_ext$ymax) / 2
  r_hires <- min(demhf_ext$xmax - demhf_ext$xmin,
                 demhf_ext$ymax - demhf_ext$ymin) / 2
  dist_from_edge <- pmax(sqrt((xy[, 1] - cx)^2 + (xy[, 2] - cy)^2) - r_hires, 0)
  terra::values(dist_rast) <- dist_from_edge

  blend_weight <- terra::clamp(dist_rast / blend_width_m, 0, 1, values = TRUE)

  # --- Gradient-consistent SRTM correction in blend zone ---
  # At the DEMHF boundary, compute the slope residual (DEMHF gradient - SRTM gradient).
  # Extrapolate the mean residual outward as a decaying additive correction so
  # upsampled SRTM contours inherit the DEMHF slope trend rather than diverging.
  kx <- matrix(c(0,0,0, -1,0,1, 0,0,0) / (2 * out_res_m), 3, 3)
  ky <- matrix(c(0,-1,0,  0,0,0,  0,1,0) / (2 * out_res_m), 3, 3)
  demhf_gx <- terra::focal(demhf_on_grid, w = kx, na.rm = TRUE)
  demhf_gy <- terra::focal(demhf_on_grid, w = ky, na.rm = TRUE)
  srtm_gx  <- terra::focal(srtm_on_grid,  w = kx, na.rm = TRUE)
  srtm_gy  <- terra::focal(srtm_on_grid,  w = ky, na.rm = TRUE)

  in_edge_band <- dist_from_edge > 0 & dist_from_edge <= blend_width_m &
                  !is.na(terra::values(demhf_gx))
  mean_resid_gx <- mean((terra::values(demhf_gx) - terra::values(srtm_gx))[in_edge_band], na.rm = TRUE)
  mean_resid_gy <- mean((terra::values(demhf_gy) - terra::values(srtm_gy))[in_edge_band], na.rm = TRUE)

  # Radial displacement from the DEMHF inscribed circle boundary (consistent with circular blend)
  radial_dist <- sqrt((xy[,1] - cx)^2 + (xy[,2] - cy)^2)
  dx_signed <- ifelse(radial_dist > 0, (xy[,1] - cx) / radial_dist * dist_from_edge, 0)
  dy_signed <- ifelse(radial_dist > 0, (xy[,2] - cy) / radial_dist * dist_from_edge, 0)

  decay <- pmax(1 - dist_from_edge / blend_width_m, 0)
  slope_correction <- (mean_resid_gx * dx_signed + mean_resid_gy * dy_signed) * decay

  srtm_corrected <- srtm_on_grid
  terra::values(srtm_corrected) <- terra::values(srtm_on_grid) + slope_correction

  demhf_vals <- terra::values(demhf_on_grid)
  srtm_vals  <- terra::values(srtm_corrected)
  blend_vals <- terra::values(blend_weight)

  has_demhf <- !is.na(demhf_vals)
  has_srtm  <- !is.na(srtm_vals)

  composite_vals <- rep(NA_real_, length(demhf_vals))
  both <- has_demhf & has_srtm
  composite_vals[both] <- demhf_vals[both] * (1 - blend_vals[both]) +
                          srtm_vals[both] * blend_vals[both]
  demhf_only <- has_demhf & !has_srtm
  composite_vals[demhf_only] <- demhf_vals[demhf_only]
  srtm_only <- !has_demhf & has_srtm
  composite_vals[srtm_only] <- srtm_vals[srtm_only]

  composite <- template
  terra::values(composite) <- composite_vals

  if (!is.null(report_path)) {
    full_report <- c(cal$report, edge = list(edge_report))
    writeLines(
      jsonlite::toJSON(full_report, auto_unbox = TRUE, pretty = TRUE),
      report_path
    )
  }

  composite
}

# Fetch a satellite imagery overlay (Esri WorldImagery) for a SpatRaster extent.
# Returns an RGBA array at the DEM's resolution suitable for rayshader::add_overlay().
# Requires maptiles, sf, abind. png_opacity controls the alpha channel [0,1].
slippy_overlay <- function(dem, png_opacity = 0.7) {
  ext_sf <- sf::st_as_sf(terra::as.polygons(terra::ext(dem), crs = terra::crs(dem)))
  tiles <- maptiles::get_tiles(ext_sf, provider = "Esri.WorldImagery", verbose = FALSE)
  tiles <- terra::project(tiles, terra::crs(dem))
  tiles <- terra::resample(tiles, dem)
  arr <- terra::as.array(tiles) / 255
  # terra::as.array is [row, col, band] north-down; rotate 90° CW to match
  # rayshader's heightmap orientation (reverse rows then transpose dims 1↔2).
  arr <- aperm(arr[nrow(arr):1, , ], c(2, 1, 3))
  alpha <- matrix(png_opacity, nrow = nrow(arr), ncol = ncol(arr))
  abind::abind(arr[, , 1:3], alpha)
}

# Rayshader preview of a DEM SpatRaster. Used by dem_preview.qmd.
# Interactive: opens X11 rgl window for geometry inspection, then saves PNG via
# a second null-device render (avoids X11 repaint bug in render_snapshot).
# Knitr: null device only; returns include_graphics() for auto-printing.
# satellite = TRUE fetches Esri WorldImagery tiles and drapes them over the terrain.
preview_dem_section <- function(dem, title = "", zscale = 10, scale = 0.1,
                                water = TRUE, waterdepth = 0,
                                satellite = FALSE, satellite_opacity = 0.7,
                                windowsize = c(2880, 1920), ...) {
  in_knitr <- isTRUE(getOption("knitr.in.progress"))
  overlay <- if (satellite) slippy_overlay(dem, png_opacity = satellite_opacity) else NULL
  mat <- dem_to_matrix(dem)
  mat[is.na(mat)] <- min(mat, na.rm = TRUE)
  mat <- rayshader::resize_matrix(mat, scale = scale)
  mat[!is.finite(mat)] <- min(mat[is.finite(mat)])
  hillshade <- rayshader::sphere_shade(mat, texture = "imhof4")
  if (!is.null(overlay)) {
    hillshade <- rayshader::add_overlay(hillshade, overlay, rescale_original = TRUE)
  }

  if (!in_knitr) {
    # Open X11 window so the user can inspect geometry interactively.
    options(rgl.useNULL = FALSE)
    rayshader::plot_3d(
      hillshade, mat,
      zscale = zscale, windowsize = windowsize,
      phi = 35, theta = 45, fov = 60,
      water = water, wateralpha = 0.3, waterdepth = waterdepth,
      ...
    )
    message(title, ": examine the OpenGL window, then press Enter to save snapshot...")
    readline()
  }

  # Re-render to null device — snapshot captures correctly without X11 repaint bug.
  options(rgl.useNULL = TRUE)
  rayshader::plot_3d(
    hillshade, mat,
    zscale = zscale, windowsize = c(1440, 960),
    phi = 35, theta = 45, fov = 60,
    water = water, wateralpha = 0.3, waterdepth = waterdepth,
    ...
  )

  if (in_knitr) {
    snapshot_path <- knitr::fig_path(suffix = ".png")
    dir.create(dirname(snapshot_path), showWarnings = FALSE, recursive = TRUE)
  } else {
    snapshot_path <- tempfile(fileext = ".png")
  }

  rayshader::render_snapshot(
    filename = snapshot_path,
    title_text = title, title_bar_color = "#1f5214",
    title_color = "white", title_bar_alpha = 0.9,
    clear = TRUE
  )

  if (in_knitr) {
    knitr::include_graphics(snapshot_path)
  } else {
    invisible(snapshot_path)
  }
}
