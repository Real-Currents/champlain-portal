options(rgl.useNULL = FALSE)

suppressMessages(library(rayshader))
suppressMessages(library(raster))

elmat <- montereybay

setwd("/home/revlin/Projects/Currents/webxr-champlain-portal")

# Load DEM
DEM <- raster::raster("data/vermont/57-Elevation_DEMHF0p7m2016_N5145E281.img")

# Build elmat (same as geoviz_test chunk)
elmat <- matrix(
  raster::extract(DEM, raster::extent(DEM), method = 'bilinear'),
  nrow = ncol(DEM),
  ncol = nrow(DEM)
)
elmat[is.na(elmat)] <- min(elmat, na.rm = TRUE)
elmat <- rayshader::resize_matrix(elmat, scale = 0.1)

zscale = 5

scene <- elmat |>
  sphere_shade(texture = "desert") |>
  add_water(detect_water(elmat), color = "lightblue") |>
  add_shadow(
    cloud_shade(
      elmat,
      zscale = zscale,
      start_altitude = 500,
      end_altitude = 1000,
    ),
    0
  )

png("hartford_current_2d.png", width=800, height=600)
scene |> plot_map()
dev.off()
cat(paste0("2D map saved to ", getwd(), "/hartford_current_2d.png\n"))

scene |>
  plot_3d(
    elmat,
    zscale = zscale,
    fov = 0,
    theta = 135,
    zoom = 0.75,
    phi = 45,
    windowsize = c(1000, 800),
    background = "darkred"
  )

render_camera(theta = 20, phi = 40, zoom = 0.64, fov = 56)

render_clouds(
  elmat,
  zscale = zscale,
  start_altitude = 800,
  end_altitude = 1000,
  attenuation_coef = 1,
  sun_altitude = 10,
  clear_clouds = TRUE
)

message("3D scene rendered. Examine the RGL window, then press Enter to save snapshot...")
readline()

# Re-render to null (off-screen) device — on X11/GLX, snapshot3d() triggers a repaint
# event that clears geometry to background before re-drawing; null device has no repaint.
options(rgl.useNULL = TRUE)
scene |>
  plot_3d(elmat, zscale = zscale, fov = 0, theta = 135, zoom = 0.75, phi = 45,
          windowsize = c(1000, 800), background = "darkred")
render_camera(theta = 20, phi = 40, zoom = 0.64, fov = 56)
render_clouds(elmat, zscale = zscale, start_altitude = 800, end_altitude = 1000,
              attenuation_coef = 5, sun_altitude = 10, clear_clouds = TRUE)
render_snapshot(filename = "hartford_current_3d.png", clear = TRUE)
message(paste0("3D snapshot saved to ", getwd(), "/hartford_current_3d.png"))
