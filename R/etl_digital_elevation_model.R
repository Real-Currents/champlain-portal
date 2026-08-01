# install.packages(c("s2", "units", "tiff", "readbitmap"))
# install.packages(c("ggplot2", "imager", "remotes", "sf", "sp"))
library(ggplot2)
library(imager)

# remotes::install_github("rspatial/terra")
# remotes::install_github("rspatial/raster")
# remotes::install_github("tylermorganwall/libopenexr")
# remotes::install_github("tylermorganwall/rayimage")
# remotes::install_github("tylermorganwall/rayrender")
# remotes::install_github("tylermorganwall/rayshader")
library(rayshader)
library(raster)
library(scales)

lake_champlain_elevation1 <- raster::raster("data/N44W074.SRTMGL1.hgt/N44W074.hgt")

lake_champlain_crs <- raster::crs(lake_champlain_elevation1)

lake_champlain_heightmap <- lake_champlain_elevation1 |>
  raster_to_matrix()

# png(filename = "public/images/N44W074.png", width = 3601, height = 3601)
lake_champlain_plot <- lake_champlain_heightmap |>
  height_shade() |>
    plot_map()

dev.print(device = png, file = "public/images/N44W074.png", width = 3601, height = 3601)
dev.off()

# montereybay %>%
#  sphere_shade(texture="desert") %>%
#  plot_3d(montereybay,zscale=50)

# Using variables for readability
start_pos_x <- 2165
start_pos_y <- 2755
size <- 256
end_pos_x <- start_pos_x + size - 1
end_pos_y <- start_pos_y + size - 1
lc_subset_heightmap <- lake_champlain_heightmap[start_pos_x:end_pos_x, start_pos_y:end_pos_y]

lc_subset_hillshade <- lc_subset_heightmap |>
  sphere_shade(texture = "imhof4")

# plot_3d(hillshade = imager::load.image("public/images/N44W074.png"),
plot_3d(hillshade = lc_subset_hillshade,
  heightmap = lc_subset_heightmap, 
  windowsize = c(1024,768),
  phi=45,theta=45,fov=70, background = "#F2E1D0",
  shadowcolor = "#523E2B", shadowdepth = -50,
  water = TRUE, wateralpha = 0.2, waterdepth = 28.5,
  zoom=0.5, zscale = 28.5
)

render_snapshot(
  filename = "public/images/Lake Champlain_subset.png",
  title_text = "Lake Champlain",
  title_bar_color = "#1f5214", title_color = "white", title_bar_alpha = 1,
  clear = TRUE
)
