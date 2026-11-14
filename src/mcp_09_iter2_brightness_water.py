"""mcp_09_iter2_brightness_water.py — Iteration 2: Fix brightness, water reflections, sky saturation.

Issues from iter1:
- Still ~60 units darker than original across all regions
- Sky is pale/milky — needs more saturation
- Water looks like matte plastic — needs Glossy BSDF for reflections
- No visible shadows from trees/objects
- Terrain is flat cartoon green

Actions:
  1. Increase film_exposure 1.0 → 1.5 (push brighter to match original mean ~150)
  2. Increase sky background strength 1.0 → 3.0
  3. Increase sun energy 4.0 → 8.0 for stronger shadows
  4. Rebuild water material: Principled BSDF + Glossy BSDF mix for real reflections
  5. Save and render test frames
"""
import bpy
import os
import json

RENDER_DIR = "/home/revlin/Projects/Currents/webxr-champlain-portal/public/assets/renders/test_iter2"
os.makedirs(RENDER_DIR, exist_ok=True)

scene = bpy.context.scene
result = {"iteration": 2, "actions": [], "before": {}, "after": {}}

# ================================================================
# ACTION 1: Increase exposure further
# ================================================================
old_exposure = scene.view_settings.exposure
scene.view_settings.exposure = 1.5
result["actions"].append(f"film_exposure: {old_exposure} → 1.5")

# ================================================================
# ACTION 2: Boost sky background strength
# ================================================================
world = scene.world
if world and world.use_nodes:
    for node in world.node_tree.nodes:
        if node.type == 'BACKGROUND':
            old_str = node.inputs['Strength'].default_value
            node.inputs['Strength'].default_value = 3.0
            result["actions"].append(f"background strength: {old_str} → 3.0")
            break
        if node.type == 'TEX_SKY':
            # Try to boost sun size/intensity if available
            try:
                if hasattr(node, 'sun_size'):
                    node.sun_size = 0.1  # smaller = sharper sun
            except:
                pass

# ================================================================
# ACTION 3: Boost sun energy
# ================================================================
for obj in scene.objects:
    if obj.type == 'LIGHT' and obj.data.type == 'SUN':
        old_energy = obj.data.energy
        obj.data.energy = 8.0
        obj.rotation_euler = (0.785398, 0.0, 0.3)
        result["actions"].append(f"sun energy: {old_energy} → 8.0")
        break

# ================================================================
# ACTION 4: Rebuild water material with reflections
# ================================================================
for mat in bpy.data.materials:
    if any(w in mat.name.lower() for w in ['dynamicwater', 'water_material', 'lc_water']):
        result["actions"].append(f"rebuilding water material: {mat.name}")
        if mat.use_nodes:
            nodes = mat.node_tree.nodes
            links = mat.node_tree.links
            
            # Find the output node
            output = None
            for node in nodes:
                if node.type == 'OUTPUT_MATERIAL':
                    output = node
                    break
            if output is None:
                output = nodes.new('ShaderNodeOutputMaterial')
            
            # Clear existing nodes except output
            for node in list(nodes):
                if node != output:
                    nodes.remove(node)
            
            # Create new shader setup:
            # Principled BSDF (base color, transparency) → Mix with Glossy BSDF (reflections)
            principled = nodes.new('ShaderNodeBsdfPrincipled')
            principled.inputs['Base Color'].default_value = (0.15, 0.28, 0.45, 1.0)
            principled.inputs['Roughness'].default_value = 0.02
            principled.inputs['IOR'].default_value = 1.33
            principled.inputs['Transmission Weight'].default_value = 0.5 if 'Transmission Weight' in principled.inputs else 0.0
            if 'Transmission' in principled.inputs:
                principled.inputs['Transmission'].default_value = 0.5
            
            glossy = nodes.new('ShaderNodeBsdfGlossy')
            glossy.inputs['Color'].default_value = (0.8, 0.9, 1.0, 1.0)  # slight blue tint
            glossy.inputs['Roughness'].default_value = 0.05
            
            mix = nodes.new('ShaderNodeMixShader')
            mix.inputs['Fac'].default_value = 0.3  # 30% glossy reflections
            
            links.new(principled.outputs['BSDF'], mix.inputs[1])
            links.new(glossy.outputs['BSDF'], mix.inputs[2])
            links.new(mix.outputs['Shader'], output.inputs['Surface'])
            
            result["actions"].append(f"  {mat.name}: Principled BSDF (transmission=0.5) + 30% Glossy BSDF (reflections)")
            break

# ================================================================
# ACTION 5: Fix terrain color — less saturated, more earthy
# ================================================================
for mat in bpy.data.materials:
    if any(w in mat.name.lower() for w in ['terrain', 'bryce', 'ground', 'earth']):
        if mat.use_nodes:
            for node in mat.node_tree.nodes:
                if node.type == 'BSDF_PRINCIPLED':
                    old_color = list(node.inputs['Base Color'].default_value)
                    # More earthy: brownish-green, less saturated
                    node.inputs['Base Color'].default_value = (0.25, 0.30, 0.15, 1.0)
                    node.inputs['Roughness'].default_value = 0.9
                    result["actions"].append(f"terrain {mat.name}: color {old_color} → [0.25, 0.30, 0.15]")
                    break

# ================================================================
# SAVE blend file
# ================================================================
blend_path = "/home/revlin/Projects/Currents/webxr-champlain-portal/src/assets/Lake_Champlain.blend"
bpy.ops.wm.save_as_mainfile(filepath=blend_path)
result["actions"].append(f"SAVED blend: {blend_path}")

# ================================================================
# Render 3 test frames
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
scene.cycles.samples = 16  # higher for cleaner reflections

rendered = []
for frame in [0, 267, 534]:
    scene.frame_start = frame
    scene.frame_end = frame
    scene.render.filepath = os.path.join(RENDER_DIR, f"iter2_f{frame:04d}")
    bpy.ops.render.render(write_still=True)
    fpath = scene.render.filepath + ".png"
    if os.path.exists(fpath):
        rendered.append(f"iter2_f{frame:04d}.png")
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

print("===ITER2_RESULT_START===")
print(json.dumps(result, indent=2, default=str))
print("===ITER2_RESULT_END===")

with open(os.path.join(RENDER_DIR, "iter2_result.json"), 'w') as f:
    f.write(json.dumps(result, indent=2, default=str))
