# Sequence-data functions for the seq000 "First Descent" VR180 sequence.
#
# Sourced by _targets.R (seq000 targets) and by R/tests/test_sequence_data.R.
#
# Purpose: build the data layer the seq000 scene needs — a terrain+bathymetry
# composite (so the sea floor is real, not guessed) and a regionally-informed
# relative-sea-level curve that drives the water's rise across the 15 s shot.
#
# === Data provenance discipline ===
# Every value that ends up in the Blender scene traces to a source recorded in
# the JSON outputs. Where a value is a working estimate pending re-derivation
# (e.g. the site marine limit), it is marked "provisional" and carries an
# uncertainty. Shell-based ages are never used as scene clock anchors because
# their reservoir bias runs up to ~1500 yr (Cronin et al., USGS pubs 70033269).

REPO <- "/home/revlin/Projects/Currents/webxr-champlain-portal"

`%||%` <- function(a, b) if (is.null(a)) b else a

# ---------------------------------------------------------------------------
# Bathymetry: VT VCGI "VT Lake Champlain Bathymetry" (LKCHDEM) point service.
# Source: https://services1.arcgis.com/BkFxaEFNwHqX3tAw/arcgis/rest/services/
#         FS_VCGI_OPENDATA_Elevation_LKCHDEM_point_SP_v1/FeatureServer/0
# Datum: EPSG:32145 (Vermont State Plane, US survey feet); DEPTH_FT is NEGATIVE
# feet below the lake surface (observed -1 .. -184 ft, i.e. to ~56 m, matching
# the modern lake's real maximum depth).
# ---------------------------------------------------------------------------

BATHY_SERVICE <- paste0(
  "https://services1.arcgis.com/BkFxaEFNwHqX3tAw/arcgis/rest/services/",
  "FS_VCGI_OPENDATA_Elevation_LKCHDEM_point_SP_v1/FeatureServer/0/query"
)

#' Download the Lake Champlain bathymetry points as GeoJSON (paged).
#' @return path to the written GeoJSON
fetch_lake_bathy <- function(out_path = file.path(REPO, "data/_raw/lkch_bathy.geojson"),
                              max_pages = 40L) {
  dir.create(dirname(out_path), showWarnings = FALSE, recursive = TRUE)
  offset <- 0L
  page <- 0L
  all_features <- list()
  repeat {
    page <- page + 1L
    url <- paste0(
      BATHY_SERVICE,
      "?where=1%3D1",
      "&outFields=OBJECTID%2CDEPTH_FT",
      "&returnGeometry=true",
      "&outSR=4326",
      "&resultRecordCount=2000",
      "&resultOffset=", offset,
      "&f=geojson"
    )
    raw <- tryCatch(
      paste(readLines(url, warn = FALSE), collapse = ""),
      error = function(e) stop("bathymetry fetch failed: ", conditionMessage(e))
    )
    gj <- jsonlite::fromJSON(raw, simplifyVector = FALSE)
    feats <- gj$features %||% list()
    if (length(feats) == 0L) break
    all_features <- c(all_features, feats)
    offset <- offset + length(feats)
    if (length(feats) < 2000L || page >= max_pages) break
  }
  if (length(all_features) == 0L) stop("bathymetry service returned no features")
  out <- list(type = "FeatureCollection", features = all_features)
  write(jsonlite::toJSON(out, auto_unbox = TRUE, digits = NA), out_path)
  out_path
}

#' Grid bathymetry points onto a template raster, in metres below lake surface.
#' @return SpatRaster of negative depths (m) on the template grid
grid_lake_bathy <- function(geojson_path, template_tif, out_tif = NULL) {
  pts <- sf::st_read(geojson_path, quiet = TRUE)
  pts <- sf::st_transform(pts, 32618)              # UTM 18N, metres
  tpl <- terra::rast(template_tif)
  tpl_crs <- terra::crs(tpl, proj = TRUE)
  # DEPTH_FT (negative feet) -> metres below surface (negative metres)
  pts$depth_m <- as.numeric(pts$DEPTH_FT) * 0.3048
  v <- terra::vect(pts)                            # terra::vect keeps the field
  # rasterize: mean depth of points falling in each cell
  r <- terra::rasterize(v, tpl, field = "depth_m", fun = "mean", na.rm = TRUE)
  terra::crs(r) <- tpl_crs
  # Charted soundings are discrete points, so only cells containing a sounding
  # get a value. Fill the gaps so the sea floor is a real surface rather than a
  # field of spikes: iterative mean fill on a raster neighbourhood.
  filled <- r
  for (i in seq_len(12)) {
    filled <- terra::ifel(is.na(filled),
                           terra::app(filled, "mean", na.rm = TRUE, window = 5),
                           filled)
    if (!any(is.na(terra::values(filled)))) break
  }
  # anything still empty (far from any sounding) stays NA -> treated as land
  r <- terra::clamp(filled, lower = -130, upper = 0)
  if (!is.null(out_tif)) terra::writeRaster(r, out_tif, overwrite = TRUE)
  r
}

#' Merge charted bathymetry into the terrain composite.
#' Land keeps the DEM values; inside the lake footprint the charted depth
#' (negative m relative to lake surface) is used; the shoreline is feathered.
merge_bathy_composite <- function(terrain_tif, bathy_tif, out_tif) {
  t <- terra::rast(terrain_tif)
  b <- terra::rast(bathy_tif)
  b <- terra::project(b, terra::crs(t))
  b <- terra::resample(b, t)
  nr <- terra::nrow(t); nc <- terra::ncol(t)
  # Build helper rasters on the terrain grid: make an all-NA raster with the
  # terrain's exact geometry, then write values into it.
  template <- terra::rast(nrows = nr, ncols = nc, xmin = terra::xmin(t),
                           xmax = terra::xmax(t), ymin = terra::ymin(t),
                           ymax = terra::ymax(t), crs = terra::crs(t))
  mk <- function(values) {
    r <- terra::rast(template)
    terra::values(r) <- matrix(values, nrow = nr, ncol = nc)
    r
  }
  tv <- terra::values(t, mat = FALSE)
  bv <- terra::values(b, mat = FALSE)
  lake <- !is.na(bv)          # charted sounding present

  # Sea floor as absolute elevation (lake surface 29.5 m ASL + depth).
  # The charted depth is negative, so the floor is at or below the surface.
  # Clamp: a sea floor can never sit above the lake surface.
  floor_abs <- 29.5 + bv
  floor_abs[!is.na(floor_abs) & floor_abs > 29.5] <- 29.5
  floor_r <- mk(ifelse(lake, floor_abs, NA_real_))
  lake_mask_r <- mk(ifelse(lake, 1, 0))       # 1 = lake, 0 = land

  # Fill DEM voids (the source DEMs have no bathymetry) with lake level, so the
  # arithmetic below is NA-free; lake cells are overwritten with the charted
  # floor immediately afterwards.
  t2 <- t
  t2[is.na(t2)] <- 29.5

  # Base surface: charted sea floor inside the lake, DEM on land.
  base <- terra::ifel(lake_mask_r == 1, floor_r, t2)

  # Shoreline feather: land within 2 cells of the lake is pulled down to lake
  # level so the shore has no cliff, and the sea floor is never blended toward
  # land elevation (an earlier version did exactly that and pushed 39% of lake
  # cells above the lake surface).
  lake_cells_r <- mk(ifelse(lake, 1, NA_real_))
  dist_to_lake <- as.vector(terra::distance(lake_cells_r))     # in cells
  blend <- ifelse(lake, 1, pmax(0, pmin(1, 1 - dist_to_lake / 2)))
  blend_r <- mk(blend)
  target_r <- terra::ifel(lake_mask_r == 1, floor_r, mk(pmin(tv, 29.5)))
  merged <- t2 * (1 - blend_r) + target_r * blend_r

  terra::writeRaster(merged, out_tif, overwrite = TRUE)
  merged
}

# ---------------------------------------------------------------------------
# Relative sea level (RSL) curve for the site.
#
# Regional anchors (published):
#   - Champlain Sea marine episode ~12,500-10,000 cal yr BP (Cronin et al.,
#     USGS pubs 70033269; calibrated plant material; shell ages carry up to
#     ~1500 yr reservoir bias and are NOT used as clock anchors).
#   - Raised-shoreline shells at 95 m (11,665+/-175 QC-200) and 47 m
#     (10,300+/-180 QC-199) on the valley profile (Quaternary Research, 1977).
#   - Isobase mapping (Rayburn et al.): maximum-uplift azimuth ~000 deg, with
#     the 140 m isobase crossing the Lake Champlain area.
#
# The site limit at the Charlotte anchor is INTERPOLATED between published
# raised-shoreline measurements and is the single most load-bearing number in
# the scene. Until Task R3 re-derives it from the primary sources, the working
# value is marked provisional and carries an uncertainty band.
# ---------------------------------------------------------------------------

rsl_site_limit_m <- function() {
  # Provisional working value, 90 m +/- 8 m. Re-derive from the primary
  # raised-shoreline measurements before final render.
  list(value = 90.0, uncertainty_m = 8.0, provisional = TRUE)
}

#' Monotone relative sea level curve (metres ASL) against model time (ka BP).
rsl_curve <- function(limit_m = NULL, present_m = 29.5, ka_start = 12.5,
                       ka_end = 10.0, n = 40) {
  if (is.null(limit_m)) limit_m <- rsl_site_limit_m()$value
  ka <- seq(ka_start, ka_end, length.out = n)
  # Shape: the sea reaches its local highstand at the start of the episode
  # (glacial isostatic rebound outpaces eustatic fall in this valley), then
  # falls toward the modern lake stage. Convex decay reads as deceleration.
  t <- (ka - ka_start) / (ka_end - ka_start)
  rsl <- present_m + (limit_m - present_m) * (1 - t) ^ 1.35
  list(ka = ka, rsl_m = rsl)
}

#' Write the scene-control contract consumed by Blender.
write_scene_control <- function(out_path = file.path(REPO, "data/scene/scene_control.json"),
                                terrain_png = "data/heightmaps/lc_terrain_full.png",
                                terrain_json = "data/heightmaps/lc_terrain_full.png.json") {
  dir.create(dirname(out_path), showWarnings = FALSE, recursive = TRUE)
  lim <- rsl_site_limit_m()
  curve <- rsl_curve(limit_m = lim$value)
  ctrl <- list(
    sequence = "seq000_first_descent",
    provenance = list(
      authored_by = "Nicole",
      commissioned_by = "John",
      scene_graph = "data/lake_champlain_scene_graph.json",
      note = "Every scene value traces to a source recorded here or in rsl_curve()."
    ),
    fps = 30,
    frames = list(1L, 450L),
    samples = 8L,   # per the reference blend (LakeChamplain3D); see render_spec
    camera = list(
      utm_epsg = 32618,
      lon = -73.358142, lat = 44.198689,
      z_asl_m = 29.5 + 1.744,
      height_above_lake_m = 1.744,
      bearing_deg = 315.0,
      iod_m = 0.063
    ),
    water = list(
      z_present_m = 29.5,
      z_past_m = lim$value,
      z_past_uncertainty_m = lim$uncertainty_m,
      z_past_provisional = lim$provisional,
      rise_frames = list(120L, 330L),
      fresh_color = c(0.12, 0.28, 0.22),
      salt_color = c(0.05, 0.16, 0.17),
      curve = lapply(seq_along(curve$ka), function(i)
        list(ka = curve$ka[i], rsl_m = curve$rsl_m[i]))
    ),
    terrain = list(
      heightmap = terrain_png,
      scale_json = terrain_json,
      bathymetry_source = "VT VCGI Elevation_LKCHDEM_point_SP_v1 (DEPTH_FT, EPSG:32145)",
      composite = "DEMHF 0.7m + SRTM-calibrated + charted bathymetry"
    ),
    # John's placement, matched to the source video framing (2026-10-16).
    # Recorded here so a scene rebuild cannot overwrite it.
    foreground_instance = list(
      location = c(11.5434, -15.6281, -0.5301),
      rotation_z = 1.16965,
      scale = c(1.0, 1.0, 1.0),
      authored_by = "John"
    ),
    render_spec = list(
      source = "src/assets/Lake_Champlain.blend :: LakeChamplain3D",
      samples = 8L, preview_samples = 12L, denoiser = "OPENIMAGEDENOISE",
      adaptive_sampling = TRUE, adaptive_threshold = 0.01,
      max_bounces = 12L, transmission_bounces = 12L, volume_bounces = 0L,
      device = "GPU", filter_size = 1.5,
      view_transform = "AgX", look = "AgX - Punchy", exposure = 1.5
    ),
    ecology = list(
      floor_vegetation = "macroalgal forest (Fucus/Ascidiacea-type) on hard substrate, 20-45 m depth",
      floor_vegetation_status = "plausible but NOT documented in the Champlain Sea literature consulted; treat as artistic, not evidence-backed",
      fauna = c("Atlantic cod (Gadus morhua)", "beluga (Delphinapterus leucas)",
                "ringed seal (Pusa hispida)", "bearded seal (Erignathus barbatus)",
                "walrus (Odobenus rosmarus)", "sea hare (Aplysia-type)",
                "mysid shrimp, ostracods, bivalves (Mya arenaria)"),
      # Benthic foraminifera: the species that actually characterise the
      # Champlain Sea floor, from Corliss, Hunt & Keigwin (1982), Quaternary
      # Research 17: 325-338. These are the real floor-dwellers of the scene.
      foraminifera = list(
        initial_phase = c("Cassidulina reniforme", "Islandiella helenae"),
        later_phase = c("Elphidium excavatum forma clavatum", "Protelphidium orbiculare"),
        note = "Corliss et al. 1982: C. reniforme and I. helenae dominate the initial phase of the Champlain Sea, replaced by E. excavatum f. clavatum and P. orbiculare for the remainder of the sea's history.",
        citation = "Corliss, B.H., Hunt, A.S. & Keigwin, L.D. (1982), Quaternary Research 17: 325-338"
      ),
      paleosalinity = "glaciomarine deposition in Champlain Sea water 30-100 m deep at palaeosalinity 22-33 per mille",
      citations = c(
        "Harington 1977, Marine mammals in the Champlain Sea and the Great Lakes, Ann. NY Acad. Sci.",
        "Champlain Sea fauna inventory (beluga, narwhal, harbour porpoise, humpback, finback, bowhead; ringed/harp/bearded/harbour seals; walrus)",
        "LCBP Basin Atlas, Ice Age Waters (beluga, Atlantic cod, seals, blue mussels in the Champlain Sea)",
        "Corliss, B.H., Hunt, A.S. & Keigwin, L.D. (1982), Benthonic foraminiferal faunal and isotopic data for the postglacial evolution of the Champlain Sea, Quaternary Research 17: 325-338"
      )
    ),
    # Floor dressing is driven by the benthic foraminiferal record: the
    # species that characterise the Champlain Sea floor, and the depth band
    # the glaciomarine record describes.
    floor = list(
      depth_band_m = c(30, 100),
      paleosalinity_permille = c(22, 33),
      setting = "glaciomarine, cold, seasonally sea-ice-affected surface, shallowing and freshening through the episode",
      microflora = c("Cassidulina reniforme", "Islandiella helenae",
                     "Elphidium excavatum forma clavatum", "Protelphidium orbiculare"),
      # Ecological meaning of each taxon (modern calibration), so the dressing
      # is driven by what the species want rather than by taste.
      microflora_ecology = list(
        "Cassidulina reniforme" = "cold Arctic shelf benthos, moderate-high food supply",
        "Islandiella helenae" = "low temperature and lower salinity; sea-ice margin indicator (Jennings & Helgadottir 1994; Seidenkrantz 2013)",
        "Elphidium excavatum forma clavatum" = "shallow, turbid water; proximal-glacier environment indicator",
        "Protelphidium orbiculare" = "ameliorated shallow water"
      ),
      macroflora = "macroalgal (Fucus/Ascidiacea-type) cover on hard substrate — PLAUSIBLE, not documented for the Champlain Sea floor specifically",
      macroflora_condition = "Arctic macroalgae favour CLEAR water under sea ice; turbidity suppresses cover (Arctic sea-ice proxy literature). Concentrate cover on rock/boulders/drowned wood, thin on soft mud.",
      substrate = "bioturbated sediment with mixed layer and burrows — the preserved assemblage is biased toward infaunal producers (Deep-Sea Research II 2016, European Arctic Margin)",
      seasonality = "sparse drifting phytodetritus from the under-ice spring bloom rather than dense marine snow (Northern Svalbard phytodetritus paper)",
      fauna_scale = c("mysid shrimp", "ostracods", "bivalves (Mya arenaria)",
                       "sea hare (Aplysia-type)", "Atlantic cod (Gadus morhua)"),
      large_fauna = c("beluga (Delphinapterus leucas)", "ringed seal (Pusa hispida)",
                      "bearded seal (Erignathus barbatus)", "walrus (Odobenus rosmarus)"),
      transition_event = "faunal turnover Cassidulina/Islandiella -> Elphidium/Protelphidium at ~10,900 yr BP, coincident with a Laurentide meltwater pulse and the largest environmental change in the sea's history (Corliss et al. 1982)",
      citation = "Corliss, B.H., Hunt, A.S. & Keigwin, L.D. (1982), Quaternary Research 17: 325-338"
    ),
    # Full community reconstruction. The foraminifera are the DIARY (the
    # environmental readout); they are not the whole community. The rest of
    # the cast is extrapolated from modern Arctic shallow-water community
    # structure, on John's instruction to take creative liberty
    # (2026-10-16): "the other 99.99% of creatures and plants may also have
    # been present alongside those microscopic creatures."
    #
    # Three depth/zone bands, because that is how the modern Arctic data
    # structures itself and it is also how the camera sees it.
    community = list(
      basis = "extrapolated from modern Arctic shallow (<30 m) coastal community structure; foraminifera provide the environmental constraint, not the cast list",
      instruction = "John, 2026-10-16: take creative liberty. Species names are anchored to real Arctic genera where a genus is recorded in the region, and invented ONLY where no regional record exists (marked creative).",
      zones = list(
        list(name = "floor", depth_m = c(30, 100), role = "the deep mud, where the diary was written",
             hard = list(
               "sea star (Asterias/Orthasterias-type, predates on mussels)",
               "brittle star (Ophiuroidea: Ophiacantha bidentata, Stegophiura nodosa)",
               "sea urchin (Strongylocentrotus droebachiensis)",
               "sand dollar (Echinarachnius parma)",
               "sea anemone (Hormathia-type)",
               "sea cucumber (Holothuroidea)",
               "brittle-star sp. assemblage marker: Ophiacantha bidentata"),
             soft = list(
               "bivalve (Mya arenaria, Limecola balthica, Hiatella arctica)",
               "gastropod (Margarites vahlii)",
               "sea hare (Aplysia-type)",
               "polychaete worm (Harmothoe imbricata, Pholoe longa, Cistenides granulata)",
               "priapulid worm (Paramphitoe hystrix)",
               "Amphipod (Pontoporeia femorata)",
               "isopod / cumacean (Eualus gaimardii, Ischyrocerus commensalis)",
               "shrimp (Lebbeus polaris, Paroediceros lynceus, Apherusa megalops)",
               "snow crab (Chionoecetes opilio)",
               "Atlantic cod (Gadus morhua)"),
             plants = list(
               "kelp (Laminaria/Agrostophyllum-type) on rock and boulder",
               "macroalgal turf (Fucus/Ascidiacea-type) on hard substrate",
               "sea grass (Zostera-type) in the shallowest clear pockets",
               "cyanobacterial / benthic diatom film on mud")),
        list(name = "slope", depth_m = c(5, 30), role = "where the weed forest is and where the light still reaches",
             hard = list(
               "rocky reef with kelp forest (Laminaria, Alaria esculenta, Fucus serratus)",
               "boulder field with urchins and sea stars",
               "drowned wood with dead-tree stumps and kelp holdfasts on them",
               "tunicate / sea squirt colonies (Molgula, Boltenia echinata, Styela rustica, Chelyosoma macleayanum)",
               "sponge colonies (Halichondria panacea-type)",
               "sculpin on the rock (Gadus/myxocephalus-type)"),
             soft = list(
               "mysid shrimp swarms",
               "bivalve bed (blue mussel Mytilus edulis, Mya arenaria)",
               "Atlantic cod in the deeper water",
               "capelin, herring, and smelt in the water column"),
             plants = list(
               "kelp forest (Laminaria spp.)",
               "Alaria esculenta in turbulent water",
               "Fucus serratus in the lower shore",
               "red seaweeds (Chondrus crispus, Lomentaria articulata) under the canopy",
               "sea grass meadows in clear shallow pockets")),
        list(name = "surface", depth_m = c(0, 5), role = "the ceiling of the world, and the ice above it",
             hard = list("ice foot and ice ledge on the shore, anchor ice"),
             soft = list(
               "myctophid and capelin shoals",
               "Arctic tern and ivory gull diving",
               "beluga (Delphinapterus leucas) surfacing in the channel",
               "ringed seal (Pusa hispida) in the ice holes",
               "bearded seal (Erignathus barbatus) on the ice edge",
               "walrus (Odobenus rosmarus) on the far ice"),
             plants = list(
               "ice algae in the underside of the floating ice",
               "sea ice diatom bloom",
               "seasonal macroalgal bloom under the ice")
             )
      ),
      # The three things that are documented for the Champlain Sea itself and
      # therefore are NOT creative liberty — they are evidence.
      documented_for_champlain_sea = c(
        "beluga (Delphinapterus leucas) — Harington 1977; the 1849 Charlotte bones",
        "ringed seal and harbour seal — Harington 1977",
        "bearded seal (Erignathus barbatus) — Champlain Sea mammal inventory",
        "walrus (Odobenus rosmarus) — remains from Sainte-Julienne-de-Montcalm and Saint-Nicolas",
        "Atlantic cod (Gadus morhua) — LCBP Basin Atlas, Ice Age Waters",
        "blue mussels (Mytilus edulis) — LCBP Basin Atlas, Ice Age Waters",
        "narwhal, harbour porpoise, humpback, finback, bowhead — Champlain Sea vertebrate fauna",
        "C. reniforme, I. helenae, E. excavatum f. clavatum, P. orbiculare foraminifera — Corliss et al. 1982"
      ),
      # Deliberate absences, so the scene stays honest about the ice.
      absent_by_design = c(
        "no coral — the water was too cold and too fresh for reef builders",
        "no sea turtles, no rays, no warm-water fish — salinity and temperature excluded them",
        "no dense Sargassum-like floating mats — this was cold northern water, not the tropics"
      )
    ),
    far_field = list(
      ice_wall_bearing_deg = 315,
      icebergs = list(count = 6, seed = 20261016),
      beluga_silhouettes = list(count = 3, range_m = c(60, 80))
    ),
    citations = c(
      "Cronin et al., USGS pubs 70033269 — calibrated Champlain Sea chronology 13-9 ka",
      "Quaternary Research 1977 — QC-200 95 m, QC-199 47 m raised-shoreline shells",
      "Rayburn et al. — isobase mapping, 140 m isobase, max-uplift azimuth 000 deg"
    )
  )
  write(jsonlite::toJSON(ctrl, auto_unbox = TRUE, pretty = TRUE, digits = NA), out_path)
  out_path
}
