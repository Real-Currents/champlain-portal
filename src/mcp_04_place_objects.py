"""mcp_04_place_objects.py — Place the tree stump, hide default test meshes, probe water extent.

Actions (all LOCAL scene objects, no linked-data modification):
  1. Hide Suzanne + Sphere (default test meshes; hide_render + hide_viewport,
     NOT deleted — reversible).
  2. Append tree_stump_01 object + material from
     public/assets/models/tree_stump_01_2k.blend (Poly Haven CC0, 20,744 verts).
  3. Place the stump in the foreground shallow-water area: world (9.2, -21.5),
     base sunk ~0.25m below water surface (Z=0 datum).
  4. Probe water extent on a coarse grid (where does the ocean patch end?).

Stump .blend contents: object 'tree_stump_01' at origin, local bbox
z -0.193..0.38, material 'tree_stump_01' (images packed/relative — we repoint
them to the downloaded 2K JPG set in public/assets/material/textures/polyhaven/).
"""
import os

import bpy

REPO = "/home/revlin/Projects/Currents/webxr-champlain-portal"
STUMP_BLEND = os.path.join(REPO, "public/assets/models/tree_stump_01_2k.blend")
TEX_DIR = os.path.join(REPO, "public/assets/material/textures/polyhaven/tree_stump_01")

result = {}
scene = bpy.context.scene

# ---------------------------------------------------------------- 1. hide test meshes
hidden = []
for name in ["Suzanne", "Sphere"]:
    ob = scene.objects.get(name)
    if ob:
        ob.hide_render = True
        ob.hide_viewport = True
        hidden.append(name)
result["hidden_test_meshes"] = hidden

# ---------------------------------------------------------------- 2. append stump
appended = []
if os.path.exists(STUMP_BLEND):
    if "tree_stump_01" in bpy.data.objects:
        ob = bpy.data.objects["tree_stump_01"]
        if ob.name not in scene.objects:
            scene.collection.objects.link(ob)
        appended.append(ob.name)
    else:
        with bpy.data.libraries.load(STUMP_BLEND, link=False) as (src, dst):
            dst.objects = [o for o in src.objects if o == "tree_stump_01"]
        for ob in dst.objects:
            if ob is None:
                continue
            scene.collection.objects.link(ob)
            appended.append(ob.name)
result["appended_objects"] = appended

# ---------------------------------------------------------------- 3. place stump
stump = bpy.data.objects.get("tree_stump_01")
if stump:
    # Deja response: the object is its own parent; just set transform.
    stump.location = (9.2, -21.5, -0.25)
    stump.rotation_euler = (0.0, 0.0, 0.35)  # slight yaw toward camera
    stump.scale = (1.0, 1.0, 1.0)
    result["stump_placed"] = {
        "location": list(stump.location),
        "rotation": list(stump.rotation_euler),
        "verts": len(stump.data.vertices),
        "materials": [m.name if m else None for m in stump.data.materials],
    }

    # Repack/repoint textures if the material's images are missing.
    tex_map = {
        "diff": "tree_stump_01_diff_2k.jpg",
        "nor_gl": "tree_stump_01_nor_gl_2k.jpg",
        "rough": "tree_stump_01_rough_2k.jpg",
        "ao": "tree_stump_01_ao_2k.jpg",
    }
    mat = stump.data.materials[0] if stump.data.materials else None
    tex_report = []
    if mat and mat.use_nodes:
        for n in mat.node_tree.nodes:
            if n.type == "TEX_IMAGE" and n.image:
                img = n.image
                resolved = bpy.path.abspath(img.filepath)
                if not os.path.exists(resolved):
                    # find which texture slot by name heuristic
                    base = img.name.lower()
                    target = None
                    for key, fname in tex_map.items():
                        if key in base or base.replace(".png", "") in fname:
                            target = os.path.join(TEX_DIR, fname)
                            break
                    if target and os.path.exists(target):
                        img.filepath = target
                        img.reload()
                        tex_report.append({"image": img.name, "repointed": target})
                    else:
                        tex_report.append({"image": img.name, "missing": resolved})
                else:
                    tex_report.append({"image": img.name, "ok": resolved})
    result["stump_textures"] = tex_report

# ---------------------------------------------------------------- 4. probe water extent
import mathutils

dg = bpy.context.evaluated_depsgraph_get()
extent = {}
for name, xy in {
    "center": (0.0, 0.0),
    "n250": (0.0, 250.0),
    "s250": (0.0, -250.0),
    "e250": (250.0, 0.0),
    "w250": (-250.0, 0.0),
    "n1000": (0.0, 1000.0),
    "s1000": (0.0, -1000.0),
    "e1000": (1000.0, 0.0),
    "w1000": (-1000.0, 0.0),
    "n2000": (0.0, 2000.0),
    "s2000": (0.0, -2000.0),
    "e2000": (2000.0, 0.0),
    "w2000": (-2000.0, 0.0),
    "w5000": (-5000.0, 0.0),
    "e5000": (5000.0, 0.0),
    "n5000": (0.0, 5000.0),
    "s5000": (0.0, -5000.0),
}.items():
    o = mathutils.Vector((xy[0], xy[1], 50.0))
    d = mathutils.Vector((0.0, 0.0, -1.0))
    hit, loc, normal, fi, ob, mw = scene.ray_cast(dg, o, d)
    extent[name] = {
        "hit": bool(hit),
        "object": ob.name if ob else None,
        "z": round(loc.z, 2) if hit else None,
    }
result["water_extent_probe"] = extent
