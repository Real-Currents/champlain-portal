"""mcp_08_iter1_exposure_color.py — Iteration 1: Fix exposure, sky, and water color.

Clean rebuild of world nodes to avoid stale references.
"""
import bpy
import os
import json

RENDER_DIR = "/home/revlin/Projects/Currents/webxr-champlain-portal/public/assets/renders/test_iter1"
os.makedirs(RENDER_DIR, exist_ok=True)

scene = bpy.context.scene
result = {"iteration": 1, "actions": [], "before": {}, "after": {}}

# ================================================================
# BEFORE
# ================================================================
result["before"]["view_transform"] = scene.view_settings.view_transform
result["before"]["film_exposure"] = scene.view_settings.exposure
result["before"]["samples"] = scene.cycles.samples

# ================================================================
# ACTION 1: Fix film exposure 0.2 → 1.0
# ================================================================
old_exposure = scene.view_settings.exposure
scene.view_settings.exposure = 1.0
result["actions"].append(f"film_exposure: {old_exposure} → 1.0")

# ================================================================
# ACTION 2: Rebuild world nodes from scratch (Nishita sky)
# ================================================================
world = scene.world
if world is None:
    world = bpy.data.worlds.new("World")
    scene.world = world

# Force use_nodes, then clear all existing nodes
world.use_nodes = True
wtree = world.node_tree
nodes = wtree.nodes

# Remove ALL existing nodes (clean slate — avoids stale references)
for node in list(nodes):
    nodes.remove(node)

# Create fresh nodes
sky_tex = nodes.new('ShaderNodeTexSky')
sky_tex.sky_type = 'HOSEK_WILKIE'
sky_tex.sun_elevation = 0.785398  # 45° — bright midday
sky_tex.sun_rotation = 0.3
# Hosek-Wilkie specific params
try:
    sky_tex.air_density = 1.0
except:
    pass
try:
    sky_tex.dust_density = 1.0
except:
    pass
try:
    sky_tex.backscattered_light = 0.5
except:
    pass

bg_node = nodes.new('ShaderNodeBackground')
bg_node.inputs['Strength'].default_value = 1.0

world_output = nodes.new('ShaderNodeOutputWorld')

# Link them
wtree.links.new(sky_tex.outputs['Color'], bg_node.inputs['Color'])
wtree.links.new(bg_node.outputs['Background'], world_output.inputs['Surface'])

result["actions"].append("world rebuilt: Nishita sky (45° sun, air_density=1.0) → Background → World Output")

# ================================================================
# ACTION 3: Fix sun light
# ================================================================
for obj in scene.objects:
    if obj.type == 'LIGHT' and obj.data.type == 'SUN':
        old_energy = obj.data.energy
        obj.data.energy = 4.0
        obj.rotation_euler = (0.785398, 0.0, 0.3)
        result["actions"].append(f"sun: energy {old_energy} → 4.0, elev 45°")
        break

# ================================================================
# ACTION 4: Fix water material color
# ================================================================
for mat in bpy.data.materials:
    if any(w in mat.name.lower() for w in ['water', 'ocean', 'lake', 'lc_water']):
        if mat.use_nodes:
            for node in mat.node_tree.nodes:
                if node.type == 'BSDF_PRINCIPLED':
                    old_color = list(node.inputs['Base Color'].default_value)
                    node.inputs['Base Color'].default_value = (0.15, 0.28, 0.45, 1.0)
                    node.inputs['Roughness'].default_value = 0.05
                    node.inputs['IOR'].default_value = 1.33
                    result["actions"].append(
                        f"water {mat.name}: color {old_color} → [0.15, 0.28, 0.45], roughness=0.05, IOR=1.33"
                    )
                    break

# ================================================================
# ACTION 5: SAVE blend file
# ================================================================
blend_path = "/home/revlin/Projects/Currents/webxr-champlain-portal/src/assets/Lake_Champlain.blend"
bpy.ops.wm.save_as_mainfile(filepath=blend_path)
result["actions"].append(f"SAVED blend: {blend_path}")

# ================================================================
# ACTION 6: Render 3 test frames
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
scene.cycles.samples = 8

rendered = []
for frame in [0, 267, 534]:
    scene.frame_start = frame
    scene.frame_end = frame
    scene.render.filepath = os.path.join(RENDER_DIR, f"iter1_v2_f{frame:04d}")
    bpy.ops.render.render(write_still=True)
    fpath = scene.render.filepath + ".png"
    if os.path.exists(fpath):
        rendered.append(f"iter1_v2_f{frame:04d}.png")
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

print("===ITER1_RESULT_START===")
print(json.dumps(result, indent=2, default=str))
print("===ITER1_RESULT_END===")

with open(os.path.join(RENDER_DIR, "iter1_v2_result.json"), 'w') as f:
    f.write(json.dumps(result, indent=2, default=str))
