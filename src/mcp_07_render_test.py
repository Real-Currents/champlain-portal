"""mcp_07_render_test.py — Render 3 low-res test frames to verify the assembled scene.

Renders at 1024x1024 per eye (square: the VR180 fisheye circle spans the full
sensor width, so a square captures the complete 180-degree circle; 2048x2048
is the production setting). With multiview STEREO_3D stills, Blender writes
separate <name>_L.png / <name>_R.png files per eye.

Frames: 0, 90, 180 — the Ocean modifier time driver (frame/30) gives water
time 0.0 / 3.0 / 6.0s so wave animation is visible across the test set.

Safety: render via bpy.ops.render.render(write_still=True) only — no viewport
mode changes. Cycles GPU, 8 samples, denoising (scene defaults).
"""
import os

import bpy

REPO = "/home/revlin/Projects/Currents/webxr-champlain-portal"
OUT_DIR = os.path.join(REPO, "public/assets/renders/test_frames")

result = {}
scene = bpy.context.scene

os.makedirs(OUT_DIR, exist_ok=True)

# ---------------------------------------------------------------- snapshot settings
orig = {
    "res_x": scene.render.resolution_x,
    "res_y": scene.render.resolution_y,
    "pct": scene.render.resolution_percentage,
    "filepath": scene.render.filepath,
    "use_multiview": scene.render.use_multiview,
    "views_format": str(scene.render.views_format),
    "samples": scene.cycles.samples,
    "denoise": scene.cycles.use_denoising,
    "engine": scene.render.engine,
}

# ---------------------------------------------------------------- apply test settings
scene.render.resolution_x = 1024
scene.render.resolution_y = 1024
scene.render.resolution_percentage = 100
scene.render.use_multiview = True
scene.render.views_format = "STEREO_3D"
scene.render.image_settings.file_format = "PNG"
scene.render.image_settings.color_mode = "RGB"
scene.render.filepath = os.path.join(OUT_DIR, "test")

rendered = []
for frame in (0, 90, 180):
    scene.frame_set(frame)
    # ocean driver: time = frame/30
    scene.render.filepath = os.path.join(OUT_DIR, "test_f%04d" % frame)
    bpy.ops.render.render(write_still=True)
    rendered.append(frame)

# ---------------------------------------------------------------- restore settings
scene.render.resolution_x = orig["res_x"]
scene.render.resolution_y = orig["res_y"]
scene.render.resolution_percentage = orig["pct"]
scene.render.filepath = orig["filepath"]

# ---------------------------------------------------------------- report outputs
files = []
for f in sorted(os.listdir(OUT_DIR)):
    p = os.path.join(OUT_DIR, f)
    files.append({"file": f, "bytes": os.path.getsize(p)})
result["rendered_frames"] = rendered
result["output_files"] = files
result["ocean_water_time_per_frame"] = {str(f): f / 30.0 for f in rendered}
result["restored_settings"] = orig
result["camera"] = scene.camera.name if scene.camera else None
