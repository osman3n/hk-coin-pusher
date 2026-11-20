import io, re, sys

path = r"C:\Users\osman_lam\Projects\WebGame\Coin Pusher\render.js"
src = io.open(path, encoding="utf-8").read()
lines = src.split("\n")

# locate block: from the two-deck forEach to the inset backdrop line
start = None
for i, ln in enumerate(lines):
    if "['top', 'bottom'].forEach(function (tier) {" in ln:
        start = i
        break
end = None
for i in range(start, len(lines)):
    if "scene.add(box(1.22, 0.9, 0.012, insetMat, 0, 0.14, -0.435));" in lines[i]:
        end = i
        break
assert start is not None and end is not None, (start, end)
print("replacing lines", start + 1, "..", end + 1)

new = """    // One deck. Tables and plates are keyed by deck name so the sync pass can
    // still find them, but there is exactly one of each now.
    var tm = buildTable('main');
    tableMeshes.main = tm;
    scene.add(tm);
    var pm = buildPlate('main');
    plateMeshes.main = pm;
    scene.add(pm);
    deckBacklight();

    // The plate travel is the only thing that moves in this machine, so the
    // frame under it has to read as the slot it slides in. These two skids sit
    // either side of the plate's stroke and are what the eye uses to tell that
    // the bar is moving forward rather than the whole table sliding.
    var skidMat = M(0x241a12, 0.85);
    var skidZ = (G.Sim.DECK.plate.back + G.Sim.DECK.plate.fwd) / 2;
    [-1, 1].forEach(function (side) {
      scene.add(box(0.022, 0.026, 0.30, skidMat, side * 0.585, -0.006, skidZ));
    });

    // Interior backdrop. The cabinet shell is a mid brown; coins on it are only
    // a shade lighter, so the whole machine flattened into one value. A dark
    // inset panel behind the deck gives the gold something to sit against.
    var insetMat = M(0x0e0906, 0.95);
    scene.add(box(1.22, 0.9, 0.012, insetMat, 0, 0.14, -0.435));"""

lines[start:end + 1] = new.split("\n")
io.open(path, "w", encoding="utf-8", newline="\n").write("\n".join(lines))
print("done")
