"""
Iteration 1 - GAP 1: Water Material Fix for lc_water.blend
Headless script to:
  a. Raise Principled BSDF roughness 0.04 -> 0.20
  b. Add depth-gradient ColorRamp: brown-green (shallow) -> steel-blue (deep)
  c. Add dark lakebed plane at Z=-0.5m
  d. Re-add Ocean time driver: frame/30.0
  e. Lower Transmission slightly (0.95 -> 0.85) so depth color shows
"""
import bpy
import sys

# ============================================================
# CONFIG
# ============================================================
WATER_BLEND = "/home/revlin/Projects/Currents/webxr-champlain-portal/src/assets/modules/lc_water.blend"

print(f"[water_edit] Opening {WATER_BLEND}...")
bpy.ops.wm.open_mainfile(filepath=WATER_BLEND)

# ============================================================
# 1. EDIT WATER MATERIAL
# ============================================================
mat_name = "DynamicWaterMaterial"
mat = bpy.data.materials.get(mat_name)
if not mat:
    print(f"[ERROR] Material '{mat_name}' not found!")
    sys.exit(1)

nt = mat.node_tree
nodes = nt.nodes
links = nt.links

# --- a. Raise roughness 0.04 -> 0.20 ---
bsdf = nodes['Principled BSDF']
old_rough = bsdf.inputs['Roughness'].default_value
bsdf.inputs['Roughness'].default_value = 0.20
print(f"[water_edit] Roughness: {old_rough:.4f} -> 0.20")

# --- e. Lower transmission slightly 0.95 -> 0.85 ---
old_trans = bsdf.inputs['Transmission Weight'].default_value
bsdf.inputs['Transmission Weight'].default_value = 0.85
print(f"[water_edit] Transmission: {old_trans:.4f} -> 0.85")

# --- b. Add depth-gradient ColorRamp for water base color ---
# The WaterPlane uses Object texture coordinates. We'll use the Z coordinate
# (Separate XYZ already exists) to drive a ColorRamp that goes from
# brown-green (shallow, near shore) to steel-blue (deep).

# Check if we already added it (idempotent)
ramp_name = "Depth Color Ramp"
if ramp_name in nodes:
    print(f"[water_edit] Depth ColorRamp already exists, updating...")
    depth_ramp = nodes[ramp_name]
else:
    depth_ramp = nt.nodes.new('ShaderNodeValToRGB')
    depth_ramp.name = ramp_name
    depth_ramp.label = "Depth Gradient"
    depth_ramp.location = (-400, -200)

# Configure the color ramp: shallow (warm brown-green) -> deep (steel blue)
cr = depth_ramp.color_ramp
cr.interpolation = 'EASE'
# Clear existing elements and add our stops
while len(cr.elements) > 1:
    cr.elements.remove(cr.elements[-1])

# Shallow water: murky olive-brown
elem0 = cr.elements[0]
elem0.position = 0.0
elem0.color = (0.12, 0.15, 0.10, 1.0)  # olive-brown

# Mid-depth: teal-green transition
elem1 = cr.elements.new(0.35)
elem1.color = (0.05, 0.18, 0.20, 1.0)  # teal

# Deep water: steel blue
elem2 = cr.elements.new(1.0)
elem2.color = (0.02, 0.08, 0.12, 1.0)  # deep steel blue

# Connect: we need the Z position from Separate XYZ -> Map Range -> ColorRamp
# Separate XYZ already feeds from Texture Coordinate.Object
# We'll create a new Map Range to map Z values to 0-1 for the ramp
map_range_name = "Depth Map Range"
if map_range_name in nodes:
    depth_map = nodes[map_range_name]
else:
    depth_map = nt.nodes.new('ShaderNodeMapRange')
    depth_map.name = map_range_name
    depth_map.label = "Depth Z to Ramp"
    depth_map.location = (-600, -200)

# Z range: WaterPlane is at Z=0 in local space (ocean modifier displaces)
# The object origin is at Z=0, vertices range roughly -0.5 to +0.5 after displacement
# But we want distance from SHORE, not depth. The Vector Math LENGTH already
# computes distance from center. Let's use that instead.
# Actually, for a lake, "depth" = distance from shore = radial distance.
# Vector Math (LENGTH) -> Map Range (5-80 -> 1-0) already exists.
# We can tap into that: Map Range.Result already outputs 1 (near) to 0 (far).
# We want the ColorRamp driven by distance, so connect Map Range.Result -> ColorRamp.Factor

# Check existing link from Map Range
# Map Range.Result -> Math.Value (MULTIPLY by 0.5)
# We'll also connect Map Range.Result -> Depth ColorRamp.Factor

# But wait - Map Range outputs 1.0 near shore and 0.0 far.
# We want near=shallow color, far=deep color. So 1.0->brown, 0.0->blue.
# Our ramp: 0.0=olive-brown, 1.0=steel-blue. That's reversed.
# So we need to invert: connect (1 - Map Range.Result) or just flip the ramp.
# Let's flip the ramp colors instead:
elem0.position = 0.0
elem0.color = (0.02, 0.08, 0.12, 1.0)  # deep steel blue (far from shore)

elem2.position = 1.0
elem2.color = (0.12, 0.15, 0.10, 1.0)  # olive-brown (near shore)

# elem1 stays teal in middle
elem1.position = 0.65
elem1.color = (0.05, 0.18, 0.20, 1.0)

# Connect Map Range.Result -> Depth ColorRamp.Factor
map_range_existing = nodes['Map Range']
# Remove old link if exists
for l in list(links):
    if l.from_node == map_range_existing and l.to_node == depth_ramp:
        links.remove(l)
links.new(map_range_existing.outputs['Result'], depth_ramp.inputs['Fac'])

# Now connect Depth ColorRamp.Color -> Principled BSDF.Base Color
# Remove old base color link if any (it's currently a default value, not linked)
for l in list(links):
    if l.to_node == bsdf and l.to_socket == bsdf.inputs['Base Color']:
        links.remove(l)
links.new(depth_ramp.outputs['Color'], bsdf.inputs['Base Color'])

print(f"[water_edit] Added depth-gradient ColorRamp: olive-brown(shallow) -> teal(mid) -> steel-blue(deep)")
print(f"[water_edit] Connected: Map Range.Result -> Depth ColorRamp -> Principled BSDF.Base Color")

# --- c. Add dark lakebed plane ---
lakebed_name = "LakeBed"
if lakebed_name in bpy.data.objects:
    print(f"[water_edit] LakeBed already exists, skipping creation")
else:
    # Create a large dark plane below the water surface
    bpy.ops.mesh.primitive_plane_add(size=200, location=(-6.0, 0.0, -0.5))
    lakebed = bpy.context.active_object
    lakebed.name = lakebed_name
    
    # Create dark lakebed material
    lakebed_mat = bpy.data.materials.new(name="LakeBedMaterial")
    lakebed_mat.use_nodes = True
    lnt = lakebed_mat.node_tree
    lnodes = lnt.nodes
    # Clear default nodes
    for n in list(lnodes):
        lnodes.remove(n)
    
    # Create a Principled BSDF with dark muddy color
    l_bsdf = lnodes.new('ShaderNodeBsdfPrincipled')
    l_bsdf.inputs['Base Color'].default_value = (0.04, 0.03, 0.02, 1.0)  # dark mud
    l_bsdf.inputs['Roughness'].default_value = 0.9
    l_bsdf.inputs['Specular IOR Level'].default_value = 0.2
    
    # Add a noise texture for organic variation
    l_noise = lnodes.new('ShaderNodeTexNoise')
    l_noise.inputs['Scale'].default_value = 8.0
    l_noise.inputs['Detail'].default_value = 6.0
    l_noise.location = (-400, 0)
    
    # ColorRamp for mud color variation
    l_ramp = lnodes.new('ShaderNodeValToRGB')
    l_ramp.location = (-200, 0)
    l_ramp.color_ramp.interpolation = 'LINEAR'
    while len(l_ramp.color_ramp.elements) > 1:
        l_ramp.color_ramp.elements.remove(l_ramp.color_ramp.elements[-1])
    l_ramp.color_ramp.elements[0].position = 0.0
    l_ramp.color_ramp.elements[0].color = (0.03, 0.02, 0.01, 1.0)  # darker mud
    e = l_ramp.color_ramp.elements.new(1.0)
    e.color = (0.08, 0.06, 0.03, 1.0)  # lighter silt
    
    l_output = lnodes.new('ShaderNodeOutputMaterial')
    l_output.location = (300, 0)
    
    # Connect: Noise -> ColorRamp -> BSDF Base Color -> Output
    lnt.links.new(l_noise.outputs['Fac'], l_ramp.inputs['Fac'])
    lnt.links.new(l_ramp.outputs['Color'], l_bsdf.inputs['Base Color'])
    lnt.links.new(l_bsdf.outputs['BSDF'], l_output.inputs['Surface'])
    
    lakebed.data.materials.append(lakebed_mat)
    print(f"[water_edit] Created LakeBed plane at Z=-0.5m with dark mud material (200m)")

# --- d. Re-add Ocean time driver ---
water_plane = bpy.data.objects.get("WaterPlane")
if water_plane:
    ocean_mod = None
    for mod in water_plane.modifiers:
        if mod.type == 'OCEAN':
            ocean_mod = mod
            break
    
    if ocean_mod:
        # Check if driver already exists on the time property
        # Ocean modifier time is a property, driver goes through animation_data
        if water_plane.animation_data is None:
            water_plane.animation_data_create()
        
        ad = water_plane.animation_data
        # Remove existing drivers on ocean.time
        if ad.drivers:
            for d in list(ad.drivers):
                # Check if it's for ocean time
                if 'time' in d.data_path:
                    ad.drivers.remove(d)
        
        # Add new driver
        d = ad.drivers.new(f'modifiers["{ocean_mod.name}"].time')
        d.driver.type = 'SCRIPTED'
        d.driver.expression = "frame / 30.0"
        print(f"[water_edit] Ocean time driver set: frame / 30.0")
        print(f"[water_edit] Current ocean.time = {ocean_mod.time}")
    else:
        print("[water_edit] WARNING: No Ocean modifier found on WaterPlane!")
else:
    print("[water_edit] WARNING: WaterPlane not found!")

# ============================================================
# SAVE
# ============================================================
bpy.ops.wm.save_as_mainfile(filepath=WATER_BLEND)
print(f"[water_edit] Saved to {WATER_BLEND}")
print("[water_edit] DONE - Water material edit complete")
