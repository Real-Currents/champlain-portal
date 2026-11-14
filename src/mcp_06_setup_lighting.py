"""mcp_06_setup_lighting.py — Sun + sky world verification and light rig check.

The scene already has:
  - Sun light: energy 2.5W, angle 0.1396 rad (~8deg softness... actually the
    angular DIAMETER of the sun; 0.0093 rad would be realistic; 0.1396 is
    softer/stylized), direction WNW at 35deg elevation (from matrix:
    dir (0.5265, -0.6275, -0.5736)).
  - World 'LakeChamplainSky': Environment Texture (now pointing at the
    downloaded kloofendal_43d_clear_puresky_4k.hdr, 4096x2048) -> Background
    (strength 1.0) with Z-rotation 2.094 rad on Mapping.

Verify only — the existing rig matches the scene graph (clear midday sky,
sun elevation 35deg, azimuth 320deg). The one adjustment made: none required
for assembly; we record final state.

Also: Cycles settings check (samples 8, denoising on, GPU device) and film
exposure (AgX Punchy, +0.2) — matches the graph's render node.
"""
import math

import bpy
from mathutils import Vector

result = {}
scene = bpy.context.scene

# ---------------------------------------------------------------- sun
sun = scene.objects.get("Sun")
if sun is None:
    result["sun"] = {"error": "Sun light missing"}
else:
    l = sun.data
    sdir = sun.matrix_world.to_quaternion() @ Vector((0.0, 0.0, -1.0))
    elev = math.degrees(math.asin(-sdir.z))
    # azimuth: direction light travels TOWARD, compass convention
    azim = math.degrees(math.atan2(-sdir.x, -sdir.y)) % 360
    result["sun"] = {
        "type": str(l.type),
        "energy": l.energy,
        "angle_rad": l.angle,
        "angle_deg": round(math.degrees(l.angle), 2),
        "color": list(l.color),
        "direction": [round(v, 4) for v in sdir],
        "elevation_deg": round(elev, 2),
        "azimuth_deg": round(azim, 2),
        "use_shadow": l.use_shadow if hasattr(l, "use_shadow") else None,
        "location": list(sun.location),
    }

# ---------------------------------------------------------------- world / sky
w = scene.world
env = None
for n in w.node_tree.nodes:
    if n.type == "TEX_ENVIRONMENT":
        env = n
        break
bg = None
for n in w.node_tree.nodes:
    if n.type == "BACKGROUND":
        bg = n
        break
mapping = None
for n in w.node_tree.nodes:
    if n.type == "MAPPING":
        mapping = n
        break

import os

result["world"] = {"name": w.name}
if env is not None and env.image is not None:
    fp = bpy.path.abspath(env.image.filepath)
    result["world"]["hdri"] = {
        "name": env.image.name,
        "filepath": fp,
        "exists_on_disk": os.path.exists(fp),
        "size": list(env.image.size),
        "colors_  ": None,
    }
    del result["world"]["hdri"]["colors_  "]
if bg is not None:
    result["world"]["background_strength"] = bg.inputs["Strength"].default_value
if mapping is not None:
    result["world"]["mapping_rotation_z_rad"] = mapping.inputs["Rotation"].default_value[2]

# ---------------------------------------------------------------- cycles settings
cy = scene.cycles
result["cycles"] = {
    "device": str(cy.device),
    "samples": cy.samples,
    "use_denoising": cy.use_denoising,
    "preview_samples": cy.preview_samples,
}
result["color_management"] = {
    "view_transform": scene.view_settings.view_transform,
    "look": scene.view_settings.look,
    "exposure": scene.view_settings.exposure,
}

# ---------------------------------------------------------------- light check vs camera view
cam = scene.objects.get("Camera.001")
if cam is not None and sun is not None and "sdir" in dir():
    cam_view = cam.matrix_world.to_quaternion() @ Vector((0.0, 0.0, -1.0))
    sun_to_scene = -sdir  # from scene toward sun
    dot = cam_view.dot(sun_to_scene)
    angle_deg = math.degrees(math.acos(max(-1.0, min(1.0, dot))))
    result["sun_vs_camera"] = {
        "angle_between_view_and_sun_deg": round(angle_deg, 1),
        "note": "camera looks NNW (-22deg azimuth); sun at 320deg azimuth (NW) "
                "-> sun is ~58deg off-axis: side lighting, ripples glinting, "
                "consistent with the source video",
    }
