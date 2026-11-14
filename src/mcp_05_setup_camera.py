"""mcp_05_setup_camera.py — VR180 fisheye stereo camera finalization.

Camera.001 is already FISHEYE_LENS_POLYNOMIAL with the calibrated K polynomial
(sensor 201.7mm; verified: theta(r) = -(k0+k1*r+k2*r^2+k3*r^3+k4*r^4) maps
r=100.85mm -> 89.79deg, i.e. 180deg circular FOV across the sensor width).

The ONE missing piece (verified against Cycles source blender/camera.cpp):
`use_spherical_stereo` was FALSE. In Cycles, stereo eye offsets for panorama
cameras are gated on this flag (RE_engine_get_spherical_stereo ->
cam->set_stereo_eye(STEREO_LEFT/RIGHT)). Without it, multiview renders are
identical left/right. Verified empirically in an isolated headless Blender:
spherical stereo + polynomial fisheye produce correct per-eye disparity.

Changes (LOCAL, reversible):
  - Camera.001.stereo.use_spherical_stereo = True
  - Keep PARALLEL convergence (convergence_distance -> FLT_MAX in Cycles:
    zero parallax at infinity — correct for VR180).
  - Keep interocular 0.063m (63mm baseline, matches source video rig).
  - Keep pivot CENTER.
  - Pole merge left OFF (optional comfort feature; noted in scene graph).
  - Confirm Camera.001 is the active scene camera.

Also verify the reference rig (Camera, 35mm PERSP) exists and is NOT the
render camera. Its transform is a leftover (pointing straight down at the
water from (0,-5,0)); the graph records it as the narrow-FOV matching rig
(~78deg FOV, 63mm baseline). We do not move it — matching the source video
framing is a convergence-iteration task, not assembly.
"""
import bpy

result = {}
scene = bpy.context.scene

cam_ob = scene.objects.get("Camera.001")
if cam_ob is None:
    result["error"] = "Camera.001 missing"
else:
    c = cam_ob.data
    st = c.stereo

    before = {
        "spherical_stereo": st.use_spherical_stereo,
        "interocular": st.interocular_distance,
        "convergence_mode": str(st.convergence_mode),
        "pivot": str(st.pivot),
        "pole_merge": st.use_pole_merge,
    }

    st.use_spherical_stereo = True
    st.interocular_distance = 0.063
    st.convergence_mode = "PARALLEL"
    st.pivot = "CENTER"

    after = {
        "spherical_stereo": st.use_spherical_stereo,
        "interocular": st.interocular_distance,
        "convergence_mode": str(st.convergence_mode),
        "pivot": str(st.pivot),
        "pole_merge": st.use_pole_merge,
    }
    result["stereo_before"] = before
    result["stereo_after"] = after

    # Camera projection sanity (unchanged, just verified)
    result["projection"] = {
        "type": c.type,
        "panorama_type": str(c.panorama_type),
        "sensor_width": c.sensor_width,
        "sensor_height": c.sensor_height,
        "k0": c.fisheye_polynomial_k0,
        "k1": c.fisheye_polynomial_k1,
        "k2": c.fisheye_polynomial_k2,
        "k3": c.fisheye_polynomial_k3,
        "k4": c.fisheye_polynomial_k4,
        "fisheye_fov": c.fisheye_fov,
        "clip_start": c.clip_start,
        "clip_end": c.clip_end,
    }
    result["transform"] = {
        "location": list(cam_ob.location),
        "rotation_euler": list(cam_ob.rotation_euler),
    }
    from mathutils import Vector
    view = cam_ob.matrix_world.to_quaternion() @ Vector((0.0, 0.0, -1.0))
    import math
    result["view_direction"] = [round(v, 4) for v in view]
    result["view_azimuth_deg"] = round(math.degrees(math.atan2(view.x, view.y)), 2)

    # active camera
    result["active_scene_camera"] = scene.camera.name if scene.camera else None

    # render views setup
    r = scene.render
    result["multiview"] = {
        "use_multiview": r.use_multiview,
        "views_format": str(r.views_format),
        "views": [{"name": v.name, "use": v.use} for v in r.views],
    }
    if not r.use_multiview:
        r.use_multiview = True
        result["multiview_enabled_now"] = True
    if r.views_format != "STEREO_3D":
        r.views_format = "STEREO_3D"
        result["views_format_set"] = "STEREO_3D"

# reference rig status
ref = scene.objects.get("Camera")
if ref:
    result["reference_rig"] = {
        "exists": True,
        "type": ref.data.type,
        "lens": ref.data.lens,
        "is_scene_camera": scene.camera is ref,
        "location": list(ref.location),
        "note": "narrow-FOV rectilinear reference rig; transform is leftover, "
                "framing match deferred to convergence iteration",
    }
