"""mcp_10_iter3_color_ripples.py — Iteration 3: Fine-tune color, add water ripples, terrain texture.

Remaining issues from iter2:
- Sky too warm (R+30, B-38) → cool it down, more blue
- Water too green (G+20) → reduce green, more blue
- Foreground slightly dark and green → brighten, warm
- No water ripples → add Noise texture → Normal map
- No terrain texture → add procedural noise variation

Actions:
  1. Sky: increase air_density for bluer sky, reduce sun_rotation slightly
  2. Water: reduce green in base color, add Noise texture → Bump for ripples
  3. Terrain: add Noise texture for color variation, lighter overall
  4. Fine-tune exposure (1.5 → 1.3, since we overshot brightness slightly)
  5. Save + render test frames
"""
import bpy
import os
import json
import math

RENDER_DIR = "/home/revlin/Projects/Currents/webxr-champlain-portal/public/assets/renders/test_iter3"
os.makedirs(RENDER_DIR, exist_ok=True)

scene = bpy.context.scene
result = {"iteration": 3, "actions": [], "before": {}, "after": {}}

# ================================================================
# ACTION 1: Fine-tune exposure (1.5 → 1.3, we overshot slightly)
# ================================================================
old_exposure = scene.view_settings.exposure
scene.view_settings.exposure = 1.3
result["actions"].append(f"film_exposure: {old_exposure} → 1.3")

# ================================================================
# ACTION 2: Sky — cooler, more blue
# ================================================================
world = scene.world
if world and world.use_nodes:
    for node in world.node_tree.nodes:
        if node.type == 'TEX_SKY':
            # Higher sun elevation = more overhead = bluer sky
            node.sun_elevation = math.radians(55)  # higher = bluer
            node.sun_rotation = 0.15
            # Try to increase air density for more blue
            try:
                node.air_density = 1.5
            except:
                pass
            try:
                node.dust_density = 0.5
            except:
                pass
            result["actions"].append(f"sky: elevation=55°, air_density=1.5 (cooler, bluer)")
            break
        if node.type == 'BACKGROUND':
            # Slight blue tint in background
            old_color = list(node.inputs['Color'].default_value)
            node.inputs['Color'].default_value = (0.4, 0.6, 0.9, 1.0)  # blue tint
            node.inputs['Strength'].default_value = 3.0
            result["actions"].append(f"bg color: {old_color} → [0.4, 0.6, 0.9], strength=3.0")
            break

# ================================================================
# ACTION 3: Water — less green, add ripples via Noise → Bump
# ================================================================
for mat in bpy.data.materials:
    if any(w in mat.name.lower() for w in ['dynamicwater', 'water_material', 'lc_water']):
        result["actions"].append(f"tuning water material: {mat.name}")
        if mat.use_nodes:
            nodes = mat.node_tree.nodes
            links = mat.node_tree.links
            
            # Find Principled BSDF
            principled = None
            for node in nodes:
                if node.type == 'BSDF_PRINCIPLED':
                    principled = node
                    break
            
            if principled:
                # Less green, more blue: [0.10, 0.22, 0.42] (was [0.15, 0.28, 0.45])
                principled.inputs['Base Color'].default_value = (0.10, 0.22, 0.42, 1.0)
                principled.inputs['Roughness'].default_value = 0.08  # slightly rougher
                result["actions"].append(f"  base color: → [0.10, 0.22, 0.42], roughness=0.08")
                
                # Add Noise texture → Bump for ripples
                noise_tex = nodes.new('ShaderNodeTexNoise')
                noise_tex.inputs['Scale'].default_value = 15.0
                noise_tex.inputs['Detail'].default_value = 8.0
                noise_tex.inputs['Roughness'].default_value = 0.6
                noise_tex.inputs['Distortion'].default_value = 2.0
                
                # Add a second noise layer for finer ripples
                noise2 = nodes.new('ShaderNodeTexNoise')
                noise2.inputs['Scale'].default_value = 40.0
                noise2.inputs['Detail'].default_value = 6.0
                noise2.inputs['Roughness'].default_value = 0.8
                
                # Mix the two noises
                mix_noise = nodes.new('ShaderNodeMixRGB')
                mix_noise.blend_type = 'ADD'
                mix_noise.inputs['Fac'].default_value = 0.5
                links.new(noise_tex.outputs['Color'], mix_noise.inputs['Color1'])
                links.new(noise2.outputs['Color'], mix_noise.inputs['Color2'])
                
                # Bump node for ripples
                bump = nodes.new('ShaderNodeBump')
                bump.inputs['Strength'].default_value = 0.15
                bump.inputs['Distance'].default_value = 0.02
                links.new(mix_noise.outputs['Color'], bump.inputs['Height'])
                links.new(bump.outputs['Normal'], principled.inputs['Normal'])
                
                result["actions"].append(f"  added dual-noise bump ripples (scale 15+40, strength 0.15)")
            
            # Also tune the Glossy BSDF if present
            for node in nodes:
                if node.type == 'BSDF_GLOSSY':
                    node.inputs['Color'].default_value = (0.6, 0.75, 0.95, 1.0)  # less white, more blue
                    node.inputs['Roughness'].default_value = 0.1
                    result["actions"].append(f"  glossy: color → [0.6, 0.75, 0.95], roughness=0.1")
                    break
            break

# ================================================================
# ACTION 4: Terrain — add noise color variation, lighten slightly
# ================================================================
for mat in bpy.data.materials:
    if any(w in mat.name.lower() for w in ['terrain', 'bryce', 'ground', 'earth']):
        result["actions"].append(f"tuning terrain material: {mat.name}")
        if mat.use_nodes:
            nodes = mat.node_tree.nodes
            links = mat.node_tree.links
            
            # Find Principled BSDF
            for node in nodes:
                if node.type == 'BSDF_PRINCIPLED':
                    # Slightly lighter, warmer base
                    node.inputs['Base Color'].default_value = (0.28, 0.32, 0.18, 1.0)
                    node.inputs['Roughness'].default_value = 0.85
                    result["actions"].append(f"  terrain base: → [0.28, 0.32, 0.18], roughness=0.85")
                    
                    # Add noise for color variation
                    noise = nodes.new('ShaderNodeTexNoise')
                    noise.inputs['Scale'].default_value = 5.0
                    noise.inputs['Detail'].default_value = 4.0
                    
                    color_ramp = nodes.new('ShaderNodeValToRGB')
                    color_ramp.color_ramp.elements[0].color = (0.22, 0.28, 0.14, 1.0)  # darker patches
                    color_ramp.color_ramp.elements[1].color = (0.35, 0.38, 0.22, 1.0)  # lighter patches
                    
                    links.new(noise.outputs['Fac'], color_ramp.inputs['Fac'])
                    links.new(color_ramp.outputs['Color'], node.inputs['Base Color'])
                    
                    result["actions"].append(f"  added noise color variation (scale 5, 2-stop ramp)")
                    break
                break
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
scene.cycles.samples = 16

rendered = []
for frame in [0, 267, 534]:
    scene.frame_start = frame
    scene.frame_end = frame
    scene.render.filepath = os.path.join(RENDER_DIR, f"iter3_f{frame:04d}")
    bpy.ops.render.render(write_still=True)
    fpath = scene.render.filepath + ".png"
    if os.path.exists(fpath):
        rendered.append(f"iter3_f{frame:04d}.png")
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

print("===ITER3_RESULT_START===")
print(json.dumps(result, indent=2, default=str))
print("===ITER3_RESULT_END===")

with open(os.path.join(RENDER_DIR, "iter3_result.json"), 'w') as f:
    f.write(json.dumps(result, indent=2, default=str))
