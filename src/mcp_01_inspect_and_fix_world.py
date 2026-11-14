"""mcp_01_inspect_and_fix_world.py — Read scene graph, verify scene state, fix missing HDRI.

Runs INSIDE Blender via the blender_mcp socket server (see src/mcp_client.py).

READ-ONLY except:
  - Re-links the world Environment Texture to the downloaded HDRI
    (kloofendal_43d_clear_puresky_4k.hdr), because the referenced
    kloofendal_puresky_4k.hdr no longer exists on disk (asset renamed/removed
    from the Poly Haven catalog) and renders would fail with a missing file.

Scene graph source of truth:
  /home/revlin/Projects/Currents/webxr-champlain-portal/data/lake_champlain_scene_graph.json
"""
import json
import os

import bpy
from mathutils import Vector

SCENE_GRAPH = "/home/revlin/Projects/Currents/webxr-champlain-portal/data/lake_champlain_scene_graph.json"

result = {}

# ---------------------------------------------------------------- read graph
with open(SCENE_GRAPH) as f:
    graph = json.load(f)

result["graph_id"] = graph.get("scene_graph_id")
result["graph_world_origin"] = graph["world_origin"]
result["graph_camera"] = {
    "name": graph["camera"]["name"],
    "type": graph["camera"]["type"],
    "projection": graph["camera"]["projection"]["panorama_type"],
    "sensor_mm": graph["camera"]["projection"]["sensor_width_mm"],
}
result["objects_in_graph"] = [o["name"] for o in graph["objects"]]

# ---------------------------------------------------------------- verify scene state vs graph
scene = bpy.context.scene
report = {}

# Terrain instance
t_inst = scene.objects.get("lc_terrain_instance")
report["terrain_instance"] = {
    "exists": t_inst is not None,
    "location": list(t_inst.location) if t_inst else None,
    "scale": list(t_inst.scale) if t_inst else None,
    "z_exaggeration": t_inst.scale.z if t_inst else None,
}
# Water instance
w_inst = scene.objects.get("lc_water_instance")
report["water_instance"] = {
    "exists": w_inst is not None,
    "location": list(w_inst.location) if w_inst else None,
    "scale": list(w_inst.scale) if w_inst else None,
}
# Foreground instance
f_inst = scene.objects.get("lc_foreground_instance")
report["foreground_instance"] = {
    "exists": f_inst is not None,
    "location": list(f_inst.location) if f_inst else None,
    "scale": list(f_inst.scale) if f_inst else None,
}

# Camera.001 (VR180 rig) vs graph
cam = scene.objects.get("Camera.001")
if cam:
    c = cam.data
    report["camera_001"] = {
        "type": c.type,
        "pano": str(c.panorama_type),
        "sensor_w": c.sensor_width,
        "interocular": c.stereo.interocular_distance,
        "spherical_stereo": c.stereo.use_spherical_stereo,
        "convergence_mode": str(c.stereo.convergence_mode),
        "location": list(cam.location),
        "view_dir": [round(v, 4) for v in (cam.matrix_world.to_quaternion() @ Vector((0, 0, -1)))],
    }

# HDRI fix ------------------------------------------------------------
world = scene.world
env_node = None
for n in world.node_tree.nodes:
    if n.type == "TEX_ENVIRONMENT":
        env_node = n
        break

if env_node is not None:
    old_path = env_node.image.filepath if env_node.image else None
    result["hdri_old_path"] = old_path
    image_ok = env_node.image is not None and os.path.exists(
        bpy.path.abspath(env_node.image.filepath))
    if not image_ok:
        new_path = graph["environment"]["sky"]["hdri_path"]
        repo = "/home/revlin/Projects/Currents/webxr-champlain-portal"
        abs_new = os.path.join(repo, new_path)
        if os.path.exists(abs_new):
            img = env_node.image
            if img is None:
                img = bpy.data.images.load(abs_new)
                env_node.image = img
            else:
                img.filepath = abs_new
                img.reload()
            result["hdri_fixed"] = {
                "new_path": abs_new,
                "size": list(img.size),
            }
        else:
            result["hdri_fixed"] = {"error": "downloaded HDRI missing", "path": abs_new}
    else:
        result["hdri_fixed"] = {"skipped": "existing image resolves on disk"}

result["world_report"] = report
