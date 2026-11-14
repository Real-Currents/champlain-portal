"""
Fix: Move LakeBed into the lc_water collection in lc_water.blend
so it comes through as a linked object in the comp file.
"""
import bpy

WATER_BLEND = "/home/revlin/Projects/Currents/webxr-champlain-portal/src/assets/modules/lc_water.blend"
bpy.ops.wm.open_mainfile(filepath=WATER_BLEND)

# Find LakeBed
lakebed = bpy.data.objects.get('LakeBed')
if not lakebed:
    print("[ERROR] LakeBed not found!")
    import sys; sys.exit(1)

# Find the lc_water collection
water_col = None
for col in bpy.data.collections:
    if col.name == 'lc_water':
        water_col = col
        break

if not water_col:
    # Create it if it doesn't exist
    water_col = bpy.data.collections.new('lc_water')
    bpy.context.scene.collection.children.link(water_col)
    print(f"[fix] Created lc_water collection")

# Move LakeBed from Scene Collection to lc_water collection
# First unlink from any current collections
for col in lakebed.users_collection:
    col.objects.unlink(lakebed)

# Link to lc_water collection
water_col.objects.link(lakebed)
print(f"[fix] Moved LakeBed to '{water_col.name}' collection")

# Verify
print(f"[fix] lc_water collection objects:")
for obj in water_col.objects:
    print(f"  - {obj.name} ({obj.type})")

bpy.ops.wm.save_as_mainfile(filepath=WATER_BLEND)
print(f"[fix] Saved {WATER_BLEND}")
