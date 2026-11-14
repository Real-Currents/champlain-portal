"""mcp_12_iter5_sky_blue_fix.py — Iteration 5: Fix the persistent blue channel gap.

The blue channel is still ~35 units low across sky and mid regions.
Root cause: AgX tone mapping compresses blues. The Hosek-Wilkie sky at
these parameters produces good blues in linear space but AgX crushes them.

Two approaches to try:
  1. Switch from AgX to Filmic (better for saturated blues)
  2. OR boost sky background color much harder in blue

Also: 
  - Water ripples still not visible enough — increase bump to 0.8
  - Terrain still too flat — increase noise scale and bump
  - Foreground nearly matching now (diff only [11,16,-10])
"""
import bpy
import os
import json
import math

RENDER_DIR = "/home/revlin/Projects/Currents/webxr-champlain-portal/public/assets/renders/test_iter5"
os.makedirs(RENDER_DIR, exist_ok=True)

scene = bpy.context.scene
result = {"iteration": 5, "actions": [], "before": {}, "after": {}}

# ================================================================
# ACTION 1: Try Filmic instead of AgX — better for saturated blues
# ================================================================
old_vt = scene.view_settings.view_transform
scene.view_settings.view_transform = 'Filmic'
result["actions"].append(f"view_transform: {old_vt} → Filmic (better for blue saturation)")

# Also try setting look to Medium High Contrast
try:
    old_look = scene.view_settings.look
    scene.view_settings.look = 'Medium High Contrast'
    result["actions"].append(f"look: {old_look} → Medium High Contrast")
except:
    pass

# Keep exposure at 1.4
scene.view_settings.exposure = 1.4

# ================================================================
# ACTION 2: Sky — push blue much harder
# ================================================================
world = scene.world
if world and world.use_nodes:
    for node in world.node_tree.nodes:
        if node.type == 'TEX_SKY':
            node.sun_elevation = math.radians(70)  # very high sun = deepest blue
            node.sun_rotation = 0.05
            try: node.air_density = 1.0
            except: pass
            try: node.dust_density = 0.1  # minimal dust = clearest sky
            except: pass
            result["actions"].append(f"sky: elevation=70°, dust=0.1 (deepest blue)")
            break
        if node.type == 'BACKGROUND':
            # Push the blue much harder
            node.inputs['Color'].default_value = (0.2, 0.5, 1.0, 1.0)  # strong blue
            node.inputs['Strength'].default_value = 5.0  # much stronger
            result["actions"].append(f"bg: color → [0.2, 0.5, 1.0], strength=5.0 (strong blue)")
            break

# ================================================================
# ACTION 3: Sun — match sky elevation
# ================================================================
for obj in scene.objects:
    if obj.type == 'LIGHT' and obj.data.type == 'SUN':
        obj.data.energy = 8.0  # slightly lower to avoid blowout with Filmic
        obj.rotation_euler = (math.radians(70), 0.0, 0.05)
        result["actions"].append(f"sun: energy=8.0, elevation=70°")
        break

# ================================================================
# ACTION 4: Water — even stronger ripples
# ================================================================
for mat in bpy.data.materials:
    if any(w in mat.name.lower() for w in ['dynamicwater', 'water_material', 'lc_water']):
        if mat.use_nodes:
            nodes = mat.node_tree.nodes
            for node in nodes:
                if node.type == 'BUMP':
                    node.inputs['Strength'].default_value = 0.8
                    result["actions"].append(f"water bump strength: 0.4 → 0.8")
                    break
                if node.type == 'BSDF_PRINCIPLED':
                    # Match original water: deeper blue
                    node.inputs['Base Color'].default_value = (0.05, 0.18, 0.38, 1.0)
                    node.inputs['Roughness'].default_value = 0.02
                    result["actions"].append(f"water base: → [0.05, 0.18, 0.38], roughness=0.02")
                    break
            break

# ================================================================
# ACTION 5: Terrain — stronger noise, more variation
# ================================================================
for mat in bpy.data.materials:
    if any(w in mat.name.lower() for w in ['terrain', 'bryce']):
        if mat.use_nodes:
            nodes = mat.node_tree.nodes
            for node in nodes:
                if node.type == 'TEX_NOISE':
                    node.inputs['Scale'].default_value = 15.0  # finer detail
                    node.inputs['Detail'].default_value = 8.0
                    result["actions"].append(f"terrain noise: scale=15, detail=8")
                    break
                if node.type == 'BUMP':
                    node.inputs['Strength'].default_value = 0.3
                    result["actions"].append(f"terrain bump: strength=0.3")
                    break
            break

# ================================================================
# SAVE blend
# ================================================================
blend_path = "/home/revlin/Projects/Currents/webxr-champlain-portal/src/assets/Lake_Champlain.blend"
bpy.ops.wm.save_as_mainfile(filepath=blend_path)
result["actions"].append(f"SAVED blend: {blend_path}")

# ================================================================
# Render test frames
# ================================================================
orig_rx = scene.render.resolution_x
orig_ry = scene.render.resolution_y
orig_pct = scene.render.resolution_percentage
orig_ff = scene.render.image_settings.file_format
orig_fp = scene.render.filepath
orig_fs = scene.frame_start
orig_fe = scene.frame_end
orig_s = scene.cycles.samples

scene.render.resolution_x = 1024
scene.render.resolution_y = 512
scene.render.resolution_percentage = 100
scene.render.image_settings.file_format = 'PNG'
scene.render.image_settings.color_mode = 'RGB'
scene.cycles.samples = 32

rendered = []
for frame in [0, 267, 534]:
    scene.frame_start = frame
    scene.frame_end = frame
    scene.render.filepath = os.path.join(RENDER_DIR, f"iter5_f{frame:04d}")
    bpy.ops.render.render(write_still=True)
    fpath = scene.render.filepath + ".png"
    if os.path.exists(fpath):
        rendered.append(f"iter5_f{frame:04d}.png")
        result["actions"].append(f"rendered frame {frame}")

# Restore
scene.render.resolution_x = orig_rx
scene.render.resolution_y = orig_ry
scene.render.resolution_percentage = orig_pct
scene.render.image_settings.file_format = orig_ff
scene.render.filepath = orig_fp
scene.frame_start = orig_fs
scene.frame_end = orig_fe
scene.cycles.samples = orig_s

result["after"]["rendered_frames"] = rendered

print("===ITER5_RESULT_START===")
print(json.dumps(result, indent=2, default=str))
print("===ITER5_RESULT_END===")

with open(os.path.join(RENDER_DIR, "iter5_result.json"), 'w') as f:
    f.write(json.dumps(result, indent=2, default=str))
