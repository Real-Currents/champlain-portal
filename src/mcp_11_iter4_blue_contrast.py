"""mcp_11_iter4_blue_contrast.py — Iteration 4: Push blue channel, contrast, water specular, terrain detail.

Remaining gaps:
- Blue channel still ~40 units low in sky and mid regions
- Water ripples too subtle — need stronger bump + specular highlights
- Terrain too flat/uniform — need stronger contrast, darker patches
- Overall low contrast — needs deeper shadows, brighter highlights
- Sky desaturated — increase Hosek-Wilkie sun intensity, reduce dust

Actions:
  1. Sky: reduce air_density (was causing haze), increase sun elevation higher
  2. Water: stronger bump (0.15→0.4), add specular via Anisotropic or sharper roughness
  3. Terrain: stronger noise contrast, darker valleys, add bump
  4. Exposure: try 1.4 (between iter2's 1.5 and iter3's 1.3)
  5. Increase samples to 32 for cleaner reflections
"""
import bpy
import os
import json
import math

RENDER_DIR = "/home/revlin/Projects/Currents/webxr-champlain-portal/public/assets/renders/test_iter4"
os.makedirs(RENDER_DIR, exist_ok=True)

scene = bpy.context.scene
result = {"iteration": 4, "actions": [], "before": {}, "after": {}}

# ================================================================
# ACTION 1: Exposure fine-tune
# ================================================================
old_exposure = scene.view_settings.exposure
scene.view_settings.exposure = 1.4
result["actions"].append(f"film_exposure: {old_exposure} → 1.4")

# ================================================================
# ACTION 2: Sky — less haze, more blue, higher sun
# ================================================================
world = scene.world
if world and world.use_nodes:
    for node in world.node_tree.nodes:
        if node.type == 'TEX_SKY':
            node.sun_elevation = math.radians(65)  # higher = bluer, less haze
            node.sun_rotation = 0.1
            try: node.air_density = 1.0  # back to standard — less haze
            except: pass
            try: node.dust_density = 0.2  # very clear — less dust
            except: pass
            result["actions"].append(f"sky: elevation=65°, air_density=1.0, dust=0.2 (clear, blue)")
            break
        if node.type == 'BACKGROUND':
            # Deeper blue background tint
            node.inputs['Color'].default_value = (0.3, 0.55, 0.95, 1.0)  # more saturated blue
            node.inputs['Strength'].default_value = 2.5
            result["actions"].append(f"bg: color → [0.3, 0.55, 0.95], strength=2.5")
            break

# ================================================================
# ACTION 3: Sun — more intense for sharper shadows
# ================================================================
for obj in scene.objects:
    if obj.type == 'LIGHT' and obj.data.type == 'SUN':
        obj.data.energy = 10.0
        obj.rotation_euler = (math.radians(65), 0.0, 0.1)  # match sky elevation
        result["actions"].append(f"sun: energy=10.0, elevation=65°")
        break

# ================================================================
# ACTION 4: Water — stronger ripples, sharper reflections
# ================================================================
for mat in bpy.data.materials:
    if any(w in mat.name.lower() for w in ['dynamicwater', 'water_material', 'lc_water']):
        if mat.use_nodes:
            nodes = mat.node_tree.nodes
            links = mat.node_tree.links
            
            # Find and tune Principled BSDF
            for node in nodes:
                if node.type == 'BSDF_PRINCIPLED':
                    # Deeper blue, matching original [0.05, 0.22, 0.38]
                    node.inputs['Base Color'].default_value = (0.08, 0.20, 0.40, 1.0)
                    node.inputs['Roughness'].default_value = 0.03  # very smooth for sharp reflections
                    node.inputs['IOR'].default_value = 1.33
                    result["actions"].append(f"water base: → [0.08, 0.20, 0.40], roughness=0.03")
                    break
            
            # Find existing bump and strengthen it
            for node in nodes:
                if node.type == 'BUMP':
                    node.inputs['Strength'].default_value = 0.4  # was 0.15 — much stronger
                    node.inputs['Distance'].default_value = 0.05
                    result["actions"].append(f"bump strength: 0.15 → 0.4")
                    break
            
            # Tune Glossy BSDF
            for node in nodes:
                if node.type == 'BSDF_GLOSSY':
                    node.inputs['Color'].default_value = (0.5, 0.7, 0.95, 1.0)
                    node.inputs['Roughness'].default_value = 0.03  # very sharp reflections
                    result["actions"].append(f"glossy: roughness=0.03 (sharp reflections)")
                    break
            
            break

# ================================================================
# ACTION 5: Terrain — stronger contrast, darker valleys, bump
# ================================================================
for mat in bpy.data.materials:
    if any(w in mat.name.lower() for w in ['terrain', 'bryce']):
        if mat.use_nodes:
            nodes = mat.node_tree.nodes
            links = mat.node_tree.links
            
            for node in nodes:
                if node.type == 'BSDF_PRINCIPLED':
                    node.inputs['Roughness'].default_value = 0.9
                    result["actions"].append(f"terrain roughness=0.9")
                    break
            
            # Find color ramp and increase contrast
            for node in nodes:
                if node.type == 'VALTORGB':
                    # Darker darks, lighter lights
                    node.color_ramp.elements[0].color = (0.15, 0.20, 0.10, 1.0)  # dark forest
                    node.color_ramp.elements[0].position = 0.3
                    node.color_ramp.elements[1].color = (0.40, 0.45, 0.25, 1.0)  # lighter sage
                    node.color_ramp.elements[1].position = 0.7
                    result["actions"].append(f"terrain color ramp: higher contrast (0.15→0.40)")
                    break
            
            # Add bump to terrain
            for node in nodes:
                if node.type == 'TEX_NOISE':
                    # Use this noise for bump too
                    bump = nodes.new('ShaderNodeBump')
                    bump.inputs['Strength'].default_value = 0.2
                    bump.inputs['Distance'].default_value = 0.1
                    links.new(node.outputs['Fac'], bump.inputs['Height'])
                    # Connect to principled normal
                    for pnode in nodes:
                        if pnode.type == 'BSDF_PRINCIPLED':
                            links.new(bump.outputs['Normal'], pnode.inputs['Normal'])
                            break
                    result["actions"].append(f"terrain bump: strength=0.2")
                    break
            break

# ================================================================
# SAVE blend file
# ================================================================
blend_path = "/home/revlin/Projects/Currents/webxr-champlain-portal/src/assets/Lake_Champlain.blend"
bpy.ops.wm.save_as_mainfile(filepath=blend_path)
result["actions"].append(f"SAVED blend: {blend_path}")

# ================================================================
# Render 3 test frames at higher samples
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
scene.cycles.samples = 32  # higher for cleaner reflections

rendered = []
for frame in [0, 267, 534]:
    scene.frame_start = frame
    scene.frame_end = frame
    scene.render.filepath = os.path.join(RENDER_DIR, f"iter4_f{frame:04d}")
    bpy.ops.render.render(write_still=True)
    fpath = scene.render.filepath + ".png"
    if os.path.exists(fpath):
        rendered.append(f"iter4_f{frame:04d}.png")
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
result["after"]["film_exposure"] = scene.view_settings.exposure

print("===ITER4_RESULT_START===")
print(json.dumps(result, indent=2, default=str))
print("===ITER4_RESULT_END===")

with open(os.path.join(RENDER_DIR, "iter4_result.json"), 'w') as f:
    f.write(json.dumps(result, indent=2, default=str))
