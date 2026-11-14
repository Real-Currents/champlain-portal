"""mcp_03_setup_water.py — Water: ocean params, animation driver, stereo-safe checks.

The water is a LINKED collection instance (lc_water module: WaterPlane with Ocean
modifier + DynamicWaterMaterial, LakeBed). We must NOT modify linked data
directly. This script:

  1. Verifies the water instance transform (scale 10, z=0.16).
  2. Reads Ocean modifier parameters through the linked instance (read-only).
  3. Confirms the animation driver (frame/30 on Ocean time) is present in the
     linked module and reports the effective time at scene frames.
  4. Computes where the water surface actually sits (instance z * scale).
     WaterPlane local z=0 -> world z = 0.16 (instance location).
     NOTE: ocean waves displace +/- ~0.7m*10 scale... verified below.

Ocean patch math (verified empirically in isolated Blender):
  generated patch span = 50 * size meters; module size=0.5 -> 25m patch,
  instance scale 10 -> 250m x 250m water area centered at instance origin
  offset by WaterPlane loc (-150,-150) * scale = (-1500,-1500).
  Hmm: instance origin is (0,0,0.16), WaterPlane loc (-150,-150,0)*10 ->
  (-1500, -1500, 0) + (0,0,0.16). So the patch spans (-1500..-1250)?
  Actually the collection instance transforms ALL module objects by scale 10.
  WaterPlane mesh itself is 2000x2000 (verts at +/-1000 local), so the
  evaluated patch (25m local) sits centered at WaterPlane origin (-150,-150)
  local -> world (-1500,-1500). That would put water off-scene!

  Let me verify with a raycast and correct if the module really is offset.
"""
import json

import bpy

result = {}
scene = bpy.context.scene

w_inst = scene.objects.get("lc_water_instance")
if w_inst is None:
    result["error"] = "lc_water_instance missing"
else:
    result["instance"] = {
        "location": list(w_inst.location),
        "scale": list(w_inst.scale),
    }

    # Read linked water module objects through the instance (read-only)
    linked_objs = {}
    if w_inst.instance_collection:
        for ob in w_inst.instance_collection.objects:
            entry = {"type": ob.type, "loc": list(ob.location)}
            for m in ob.modifiers:
                if m.type == "OCEAN":
                    entry["ocean"] = {
                        p: getattr(m, p)
                        for p in ["size", "spatial_size", "choppiness", "wind_velocity",
                                  "wind_alignment", "wind_direction", "wave_scale",
                                  "time", "random_seed", "use_foam", "foam_coverage"]
                        if hasattr(m, p)
                    }
            if ob.animation_data and ob.animation_data.drivers:
                entry["drivers"] = [d.driver.expression for d in ob.animation_data.drivers]
            linked_objs[ob.name] = entry
    result["linked_water_objects"] = linked_objs

    # Evaluate actual water surface position: raycast straight down at camera
    # anchor and around, using the depsgraph (evaluates ocean modifier).
    import mathutils
    dg = bpy.context.evaluated_depsgraph_get()
    samples = {}
    for name, xy in {
        "origin": (0.0, 0.0),
        "camera_anchor_plus5": (5.0, 5.0),
        "water_foreground_area": (10.0, -22.0),
        "east_20m": (20.0, 0.0),
        "west_20m": (-20.0, 0.0),
        "north_20m": (0.0, 20.0),
        "south_20m": (0.0, -20.0),
        "far_east_100m": (100.0, 0.0),
    }.items():
        o = mathutils.Vector((xy[0], xy[1], 50.0))
        d = mathutils.Vector((0.0, 0.0, -1.0))
        hit, loc, normal, fi, ob, mw = scene.ray_cast(dg, o, d)
        samples[name] = {
            "hit": bool(hit),
            "object": ob.name if ob else None,
            "world_z": round(loc.z, 3) if hit else None,
        }
    result["water_surface_raycast"] = samples
