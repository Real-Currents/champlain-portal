"""mcp_13_video_plane_compare.py — Create a video plane for same-camera comparison.

Creates a plane mesh skinned with the original Lake_Champlain.mp4 video,
positioned to fill the camera frame. Renders one frame WITH the video plane
visible (ground truth through the fisheye), then hides it and renders the
same frame WITHOUT it (our render). This eliminates the projection mismatch
that was capping PSNR at ~14 dB.

The video plane is temporary — created, used for comparison, then deleted.
"""
import bpy
import os
import json
import math

RENDER_DIR = "/home/revlin/Projects/Currents/webxr-champlain-portal/public/assets/renders/test_compare"
os.makedirs(RENDER_DIR, exist_ok=True)

VIDEO_PATH = "/home/revlin/Projects/Currents/webxr-champlain-portal/public/assets/videos/Lake_Champlain.mp4"

scene = bpy.context.scene
result = {"comparison": True, "actions": []}

# ================================================================
# STEP 1: Load the original video as a Blender image
# ================================================================
# Try to load the video as a movie image
video_img = bpy.data.images.load(VIDEO_PATH, check_existing=True)
# Set it as a movie sequence
video_img.source = 'MOVIE'
result["actions"].append(f"loaded video: {VIDEO_PATH}")
result["actions"].append(f"video size: {video_img.size[0]}x{video_img.size[1]}")

# ================================================================
# STEP 2: Create a plane mesh in front of the camera
# ================================================================
# Get the render camera
cam = scene.objects.get("Camera.001")
if not cam:
    result["error"] = "Camera.001 not found"
    print(json.dumps(result, indent=2))
    raise Exception("Camera.001 not found")

# Create a plane
bpy.ops.mesh.primitive_plane_add(size=2.0, location=(0, 0, 0))
video_plane = bpy.context.active_object
video_plane.name = "VideoComparePlane"
result["actions"].append(f"created plane: {video_plane.name}")

# Position it in front of the camera, filling the view
# Camera is at (11.894, -29.039, 1.744) looking toward (-0.3759, 0.926, -0.0349)
# Place plane 2m in front of camera, scaled to fill fisheye FOV
cam_loc = cam.location
cam_rot = cam.rotation_euler

# Place plane 2m ahead of camera along its view direction
import mathutils
forward = mathutils.Vector((0, 0, -1))
forward.rotate(mathutils.Euler(cam_rot))
plane_loc = cam_loc + forward * 2.0
video_plane.location = plane_loc

# Rotate plane to face camera (face -Z = face the camera)
video_plane.rotation_euler = cam_rot
# Flip 180° so the texture faces the camera
video_plane.rotation_euler = (cam_rot[0] + math.pi, cam_rot[1], cam_rot[2])

# Scale to fill the fisheye view at 2m distance
# Fisheye FOV = 180°, at 2m distance the plane needs to be ~4m x 2m
video_plane.scale = (4.0, 2.0, 1.0)
result["actions"].append(f"plane positioned at {list(plane_loc)}, scale (4, 2, 1)")

# ================================================================
# STEP 3: Create material with video texture (Emission for unlit display)
# ================================================================
mat = bpy.data.materials.new(name="VideoCompareMaterial")
mat.use_nodes = True
nodes = mat.node_tree.nodes
links = mat.node_tree.links

# Clear default nodes
for node in list(nodes):
    nodes.remove(node)

# Create: Image Texture → Emission → Output
tex_node = nodes.new('ShaderNodeTexImage')
tex_node.image = video_img
tex_node.interpolation = 'Closest'

emission = nodes.new('ShaderNodeEmission')
emission.inputs['Strength'].default_value = 1.0

output = nodes.new('ShaderNodeOutputMaterial')

links.new(tex_node.outputs['Color'], emission.inputs['Color'])
links.new(emission.outputs['Emission'], output.inputs['Surface'])

video_plane.data.materials.append(mat)
result["actions"].append(f"created emission material with video texture")

# ================================================================
# STEP 4: Set the video frame to match our render frame (267)
# Original video: 90fps, 27s = 2430 frames
# Our render: 30fps, frame 267 = ~8.9s into the sequence
# Original frame at 8.9s = 90 * 8.9 = 801
# But our render frame 267 maps to original video frame:
# render frame / render_fps * orig_fps = 267/30*90 = 801
video_frame = int(267 / 30 * 90)
# Set the image frame via the ImageUser on the tex_node
if hasattr(tex_node, 'image_user'):
    tex_node.image_user.frame_current = video_frame
    tex_node.image_user.use_auto_refresh = True
scene.frame_set(video_frame)
result["actions"].append(f"set video frame to {video_frame} (matching render frame 267)")

# ================================================================
# STEP 5: Render WITH video plane (ground truth through fisheye)
# ================================================================
# Hide everything except the video plane
hidden_objs = []
for obj in scene.objects:
    if obj != video_plane and obj.type in ('MESH', 'EMPTY', 'LIGHT'):
        if not obj.hide_render:
            obj.hide_render = True
            hidden_objs.append(obj.name)

# Also hide linked library instances
for obj in scene.objects:
    if obj.type == 'EMPTY' and hasattr(obj, 'instance_collection') and obj.instance_collection:
        if not obj.hide_render:
            obj.hide_render = True
            hidden_objs.append(obj.name)

result["actions"].append(f"hidden {len(hidden_objs)} objects for video plane render")

# Render the video plane frame
scene.frame_start = 267
scene.frame_end = 267

orig_rx = scene.render.resolution_x
orig_ry = scene.render.resolution_y
orig_pct = scene.render.resolution_percentage
orig_ff = scene.render.image_settings.file_format
orig_fp = scene.render.filepath
orig_s = scene.cycles.samples

scene.render.resolution_x = 1024
scene.render.resolution_y = 512
scene.render.resolution_percentage = 100
scene.render.image_settings.file_format = 'PNG'
scene.render.image_settings.color_mode = 'RGB'
scene.cycles.samples = 4  # low samples — it's just an emissive plane

scene.render.filepath = os.path.join(RENDER_DIR, "video_plane_f0267")
bpy.ops.render.render(write_still=True)
result["actions"].append(f"rendered video plane frame → {scene.render.filepath}.png")

# ================================================================
# STEP 6: Unhide everything, hide video plane, render comparison frame
# ================================================================
# Unhide all objects
for obj in scene.objects:
    if obj.name in hidden_objs:
        obj.hide_render = False

# Hide the video plane
video_plane.hide_render = True
result["actions"].append(f"unhidden scene objects, hid video plane")

# Render the scene frame
scene.cycles.samples = 16
scene.render.filepath = os.path.join(RENDER_DIR, "scene_render_f0267")
bpy.ops.render.render(write_still=True)
result["actions"].append(f"rendered scene frame → {scene.render.filepath}.png")

# ================================================================
# STEP 7: Cleanup — delete the video plane and material
# ================================================================
bpy.data.objects.remove(video_plane, do_unlink=True)
bpy.data.materials.remove(mat)
# Don't remove the video image — it might be useful later
result["actions"].append("cleaned up video plane and material")

# ================================================================
# Restore render settings
# ================================================================
scene.render.resolution_x = orig_rx
scene.render.resolution_y = orig_ry
scene.render.resolution_percentage = orig_pct
scene.render.image_settings.file_format = orig_ff
scene.render.filepath = orig_fp
scene.frame_start = orig_fs if 'orig_fs' in dir() else scene.frame_start
scene.frame_end = orig_fe if 'orig_fe' in dir() else scene.frame_end
scene.cycles.samples = orig_s

# Save the blend (without the temporary video plane)
bpy.ops.wm.save_as_mainfile(filepath="/home/revlin/Projects/Currents/webxr-champlain-portal/src/assets/Lake_Champlain.blend")

result["render_dir"] = RENDER_DIR
print("===VIDEO_COMPARE_RESULT_START===")
print(json.dumps(result, indent=2, default=str))
print("===VIDEO_COMPARE_RESULT_END===")

with open(os.path.join(RENDER_DIR, "compare_result.json"), 'w') as f:
    f.write(json.dumps(result, indent=2, default=str))
