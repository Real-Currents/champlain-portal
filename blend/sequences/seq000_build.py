# seq000_build.py — builds the seq000 "First Descent" scene in Blender.
#
# Run via MCP execute_blender_code (this file is the source of truth; the MCP
# payload reads and execs it so the visible mcp_script text always matches what ran).
#
# Design contract (John, 2026-10-16):
#   - Player NEVER translates. Camera is planted and never keyed.
#   - seq000 is the witnessed opening: no controls, no objectives, no voice.
#   - The water column IS the time axis. Sea level rises past the lens.
#   - Ending: stillness on the sea floor, populated (algae forest, arctic fauna),
#     with the drowned shore (her doorstep) dead-center.
#
# Scene graph (data/lake_champlain_scene_graph.json) is the source of truth for
# camera calibration, terrain instance transform, and module locations.
# Story/sequence values live in data/scene/scene_control.json (produced by R).

import bpy
import json
import math
import os
from mathutils import Euler

REPO = "/home/revlin/Projects/Currents/webxr-champlain-portal"
MODULES = REPO + "/src/assets/modules"
GRAPH = REPO + "/data/lake_champlain_scene_graph.json"
SCENE_CTRL = REPO + "/data/scene/scene_control.json"


def load_json(path, default=None):
    if not os.path.exists(path):
        return default if default is not None else {}
    with open(path) as fh:
        return json.load(fh)


def purge_object(name):
    ob = bpy.data.objects.get(name)
    if ob:
        bpy.data.objects.remove(ob, do_unlink=True)


def get_or_new_material(name):
    mat = bpy.data.materials.get(name)
    if mat is None:
        mat = bpy.data.materials.new(name)
    return mat


def build_scene():
    g = load_json(GRAPH)
    ctrl = load_json(SCENE_CTRL, {})

    # ---------------- render configuration: VR180 SBS, native ----------------
    sc = bpy.context.scene
    sc.name = "seq000_first_descent"
    r = sc.render
    r.engine = 'CYCLES'
    r.use_multiview = True
    r.views_format = 'STEREO_3D'
    r.image_settings.views_format = 'STEREO_3D'
    r.image_settings.stereo_3d_format.display_mode = 'SIDEBYSIDE'
    r.image_settings.file_format = 'PNG'
    r.use_file_extension = True
    r.resolution_x = 2048
    r.resolution_y = 2048
    r.resolution_percentage = 100
    r.fps = 30
    sc.frame_start = 1
    sc.frame_end = ctrl.get("frames", [1, 450])[1]
    # Render specs follow the project's reference blend
    # (src/assets/Lake_Champlain.blend, scene LakeChamplain3D) as the authority.
    sc.cycles.samples = ctrl.get("samples", 8)
    sc.cycles.preview_samples = 12
    sc.cycles.use_denoising = True
    sc.cycles.denoiser = 'OPENIMAGEDENOISE'
    sc.cycles.use_adaptive_sampling = True
    sc.cycles.adaptive_threshold = 0.01
    sc.cycles.max_bounces = 12
    sc.cycles.diffuse_bounces = 4
    sc.cycles.glossy_bounces = 4
    sc.cycles.transmission_bounces = 12
    sc.cycles.volume_bounces = 0
    sc.cycles.transparent_max_bounces = 8
    sc.cycles.caustics_reflective = True
    sc.cycles.caustics_refractive = True
    sc.cycles.blur_glossy = 1.0
    sc.cycles.device = 'GPU'
    r.filter_size = 1.5
    # AgX Punchy at +1.5 exposure, as in the reference scene.
    sc.view_settings.view_transform = 'AgX'
    sc.view_settings.look = 'AgX - Punchy'
    sc.view_settings.exposure = 1.5
    sc.view_settings.gamma = 1.0
    sc.display_settings.display_device = 'sRGB'

    # ---------------- camera: calibrated polynomial fisheye ----------------
    purge_object("Camera_seq000")
    cam_data = bpy.data.cameras.get("cam_seq000") or bpy.data.cameras.new("cam_seq000")
    cam_data.type = 'PANO'
    cam_data.panorama_type = 'FISHEYE_LENS_POLYNOMIAL'
    proj = g["camera"]["projection"]
    for i in range(5):
        setattr(cam_data, f"fisheye_polynomial_k{i}", proj["k_polynomial"][f"k{i}"])
    cam_data.sensor_width = proj["sensor_width_mm"]
    cam_data.sensor_height = proj["sensor_height_mm"]
    cam_data.lens = proj["lens_mm"]
    st = g["camera"]["stereo"]
    cam_data.stereo.interocular_distance = st["interocular_distance_m"]
    cam_data.stereo.convergence_mode = 'PARALLEL'
    cam_data.stereo.use_spherical_stereo = True
    cam_data.stereo.use_pole_merge = st["use_pole_merge"]
    cam_data.clip_start = g["camera"]["clip_start_m"]
    cam_data.clip_end = g["camera"]["clip_end_m"]
    cam_data.shift_x = 0.0
    cam_data.shift_y = 0.0

    cam = bpy.data.objects.new("Camera_seq000", cam_data)
    sc.collection.objects.link(cam)
    sp = g["camera"]["spatial"]
    cam.location = sp["location"]
    cam.rotation_euler = Euler(sp["rotation_euler"], 'XYZ')
    sc.camera = cam

    # ---------------- world: cold arctic sky, seen from below the surface ----
    world = bpy.data.worlds.get("World") or bpy.data.worlds.new("World")
    sc.world = world
    world.use_nodes = True
    nt = world.node_tree
    nt.nodes.clear()
    out = nt.nodes.new("ShaderNodeOutputWorld")
    out.location = (200, 0)
    bg = nt.nodes.new("ShaderNodeBackground")
    bg.location = (0, 0)
    sky = nt.nodes.new("ShaderNodeTexSky")
    sky.location = (-300, 0)
    sky.sky_type = 'MULTIPLE_SCATTERING'
    sky.sun_elevation = math.radians(12.0)
    sky.sun_rotation = math.radians(320.0)
    sky.altitude = 200
    sky.air_density = 2.4
    sky.aerosol_density = 1.6
    sky.ozone_density = 1.2
    sky.sun_intensity = 0.30
    sky.turbidity = 2.4
    nt.links.new(sky.outputs[0], bg.inputs[0])
    nt.links.new(bg.outputs[0], out.inputs[0])
    bg.inputs[1].default_value = 0.5

    # ---------------- two suns: present + past, crossfaded by frame -----------
    def make_sun(name, energy, angle_deg, elevation_deg, azimuth_deg, color):
        purge_object(name)
        d = bpy.data.lights.get(name) or bpy.data.lights.new(name, type='SUN')
        d.type = 'SUN'
        d.energy = energy
        d.angle = math.radians(angle_deg)
        d.color = color
        o = bpy.data.objects.new(name, d)
        sc.collection.objects.link(o)
        a = math.radians(azimuth_deg)
        o.rotation_euler = Euler((math.radians(90 - elevation_deg), 0.0, a), 'XYZ')
        o.location = (math.sin(a) * 800, math.cos(a) * 800, 800)
        return o

    sun_present = make_sun("Sun_present", 3.4, 0.5, 35.0, 320.0, (1.0, 0.98, 0.93))
    sun_past = make_sun("Sun_past", 1.0, 2.0, 12.0, 335.0, (0.82, 0.90, 1.0))

    # ---------------- module collections (terrain, water, foreground) ---------
    for fname, coll in (("lc_terrain.blend", "lc_terrain"),
                        ("lc_water.blend", "lc_water"),
                        ("lc_foreground.blend", "lc_foreground")):
        path = MODULES + "/" + fname
        if not os.path.exists(path):
            continue
        lc = bpy.data.collections.get(coll)
        if lc is None:
            with bpy.data.libraries.load(path, link=True) as (df, dt):
                dt.collections = [c for c in df.collections if c == coll]
            lc = bpy.data.collections.get(coll)
        inst = bpy.data.objects.get(coll + "_instance")
        if inst is None:
            inst = bpy.data.objects.new(coll + "_instance", None)
            sc.collection.objects.link(inst)
        inst.instance_type = 'COLLECTION'
        inst.instance_collection = lc

    # terrain instance transform from the graph (orientation contract: no Z rot)
    it = g["terrain"]["mesh"]["instance_transform"]
    t_inst = bpy.data.objects.get("lc_terrain_instance")
    if t_inst:
        t_inst.location = it["location"]
        t_inst.scale = it["scale"]
        t_inst.rotation_euler = (0.0, 0.0, 0.0)

    # Foreground placement is John's (2026-10-16, matched to the source video
    # framing) and lives in the scene-control contract so a rebuild cannot
    # overwrite it. Fall back to the graph's recorded instance position.
    fg = ctrl.get("foreground_instance")
    fg_inst = bpy.data.objects.get("lc_foreground_instance")
    if fg_inst and fg:
        fg_inst.location = fg["location"]
        fg_inst.rotation_euler = (0.0, 0.0, fg["rotation_z"])
        fg_inst.scale = fg.get("scale", [1.0, 1.0, 1.0])
    elif fg_inst:
        fg_inst.location = (11.5434, -15.6281, -0.5301)
        fg_inst.rotation_euler = (0.0, 0.0, 1.16965)

    # ---------------- water: the time axis ----------------
    # The water plane's Z is keyed from the present lake surface up to the
    # marine limit, following the RSL curve from the scene-control contract.
    # The curve's shape (convex, decelerating) is what makes the sea read as
    # an episode rather than a linear ramp.
    water_ctrl = ctrl.get("water", {})
    rise_f = water_ctrl.get("rise_frames", [120, 330])
    z_present = water_ctrl.get("z_present_m", 29.5)
    z_past = water_ctrl.get("z_past_m", 90.0)
    curve = water_ctrl.get("curve", [])

    def rsl_at(frame):
        """Sea level (m ASL) at a given frame, mapped from the RSL curve.

        The portal runs BACKWARD in geological time: the participant starts in
        the present and the scene moves into the past. So as the frame
        advances, model time goes from 10 ka (young, modern lake) back to
        12.5 ka (old, marine limit), and the sea rises to meet it.
        """
        if not curve:
            return z_present
        ka_start = curve[0]["ka"]        # 12.5 ka -> marine limit
        ka_end = curve[-1]["ka"]         # 10.0 ka -> modern lake stage
        if frame <= rise_f[0]:
            return z_present
        if frame >= rise_f[1]:
            return z_past
        u = (frame - rise_f[0]) / float(rise_f[1] - rise_f[0])
        ka = ka_end + (ka_start - ka_end) * u      # reversed: into the past
        for i in range(len(curve) - 1):
            k0, k1 = curve[i]["ka"], curve[i + 1]["ka"]
            if (k1 <= ka <= k0) or (k0 <= ka <= k1):
                span = (k1 - k0) or 1e-9
                t = (ka - k0) / span
                return curve[i]["rsl_m"] + t * (curve[i + 1]["rsl_m"] - curve[i]["rsl_m"])
        return z_present

    water_obj = None
    wcoll = bpy.data.collections.get("lc_water")
    if wcoll:
        for ob in wcoll.objects:
            if ob.type == 'MESH' and "water" in ob.name.lower():
                water_obj = ob
                break
    water_keys = []
    if water_obj is not None:
        # Blender 5.x uses slotted Actions (action.fcurves is gone), so set the
        # default keyframe interpolation via preferences instead of walking
        # F-Curves after the fact.
        prefs = bpy.context.preferences.edit
        prev_interp = prefs.keyframe_new_interpolation_type
        prefs.keyframe_new_interpolation_type = 'LINEAR'
        # Z is in Blender space where 0 = lake surface (29.5 m ASL)
        # Key EVERY frame of the rise: the deceleration that makes the sea read
        # as an episode rather than a linear ramp lives in the RSL curve, and
        # endpoint keys alone would flatten it into a straight line.
        frames_to_key = [1] + list(range(rise_f[0], rise_f[1] + 1)) + [450]
        for f in frames_to_key:
            sea = rsl_at(f)
            water_obj.location.z = sea - z_present
            water_obj.keyframe_insert("location", index=2, frame=f)
        water_keys = [(f, round(rsl_at(f), 2)) for f in (1, rise_f[0], rise_f[1], 450)]
        prefs.keyframe_new_interpolation_type = prev_interp

    # ---------------- epoch crossfade: present sun fades out, arctic sun in --
    def key_energy(obj, pairs):
        for f, e in pairs:
            obj.data.energy = e
            obj.data.keyframe_insert("energy", frame=f)

    if sun_present and sun_past:
        key_energy(sun_present, [(1, 3.4), (rise_f[0], 0.9), (rise_f[1], 0.0), (450, 0.0)])
        key_energy(sun_past, [(1, 0.0), (rise_f[0], 0.15), (rise_f[1], 1.0), (450, 1.0)])

    return {
        "scene": sc.name,
        "camera": {
            "name": cam.name,
            "panorama": cam_data.panorama_type,
            "k": [round(getattr(cam_data, f"fisheye_polynomial_k{i}"), 12) for i in range(5)],
            "iod": cam_data.stereo.interocular_distance,
            "spherical_stereo": cam_data.stereo.use_spherical_stereo,
            "convergence": cam_data.stereo.convergence_mode,
            "loc": [round(v, 4) for v in cam.location],
            "rot": [round(v, 5) for v in cam.rotation_euler],
        },
        "world": {"sky_type": sky.sky_type, "sun_elev_deg": 12.0,
                  "air_density": sky.air_density, "strength": bg.inputs[1].default_value},
        "suns": [sun_present.name, sun_past.name],
        "water_keys": water_keys,
        "objects": [o.name for o in sc.objects],
        "materials": [m.name for m in bpy.data.materials],
    }


RESULT = build_scene()
