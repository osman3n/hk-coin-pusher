import io

path = r"C:\Users\osman_lam\Projects\WebGame\Coin Pusher\render.js"
src = io.open(path, encoding="utf-8").read()
lines = src.split("\n")

# --- replace buildTable + buildPlate ---
start = next(i for i, l in enumerate(lines) if l.strip().startswith("function buildTable(tier)"))
end = next(i for i, l in enumerate(lines) if l.strip().startswith("function buildTray()"))

new = '''  function buildTable() {
    var D = G.Sim.DECK;
    var T = D.table, y = D.y;
    var g = new THREE.Group();
    var w = T.x1 - T.x0, d = T.lip - T.z0;
    var zc = (T.z0 + T.lip) / 2;

    // The felt has to be dark enough that a gold coin pops, but not so dark
    // that the deck reads as a hole in the machine.
    var felt = new THREE.MeshStandardMaterial({ color: 0x14201c, roughness: 0.92 });
    var top = new THREE.Mesh(new THREE.BoxGeometry(w, 0.02, d), felt);
    top.position.set((T.x0 + T.x1) / 2, y - 0.01, zc);
    top.receiveShadow = true;
    g.add(top);

    // side rails
    var railMat = M(0x3d2717, 0.7);
    var sideGeo = new THREE.BoxGeometry(0.025, 0.055, d);
    var l = new THREE.Mesh(sideGeo, railMat); l.position.set(T.x0 - 0.012, y + 0.017, zc);
    var r = new THREE.Mesh(sideGeo, railMat); r.position.set(T.x1 + 0.012, y + 0.017, zc);
    l.castShadow = r.castShadow = true;
    g.add(l); g.add(r);

    // The lip, with the payout slot cut out of it. This is the single most
    // important piece of geometry on the table: it has to make the slot legible
    // as a hole in an edge, not as a wide-open table that happens to drop coins.
    // So it is built as two solid brass blocks either side of the slot rather
    // than one bar across the whole width.
    var lipMat = M(0xd9a441, 0.35, 0.6);
    var lipThick = 0.018;
    var slotHalf = G.Sim.PAY_W;
    var lipW = (T.x1 - T.x0) / 2 + 0.025;
    var blockW = lipW - slotHalf;
    [-1, 1].forEach(function (side) {
      var block = new THREE.Mesh(new THREE.BoxGeometry(blockW, lipThick, lipThick), lipMat);
      block.position.set(side * (slotHalf + blockW / 2), y + lipThick / 2, T.lip + 0.008);
      block.castShadow = true;
      g.add(block);
    });
    // The slot floor: a dark drop throat under the gap, so the opening reads as
    // depth rather than as a painted stripe.
    g.add(box(slotHalf * 2, 0.004, 0.055, M(0x0a0704, 0.98), 0, y - 0.004, T.lip + 0.030));

    // back wall
    var back = new THREE.Mesh(new THREE.BoxGeometry(w + 0.05, 0.135, 0.02), railMat);
    back.position.set(0, y + 0.055, T.z0 - 0.012);
    back.castShadow = back.receiveShadow = true;
    g.add(back);
    return g;
  }

  function buildPlate() {
    var D = G.Sim.DECK, T = D.table, y = D.y;
    var g = new THREE.Group();
    var drop = G.Sim.PLATE_DROP;

    // The bar is a slab whose TOP FACE sits at exactly `plateDrop`, which is the
    // height the simulation rests a carried coin at. Anything else and the coins
    // either sink into the bar or float above it -- and the whole point of this
    // bar is that a coin visibly lies on it and rides forward.
    var w = T.x1 - T.x0 - 0.03;
    var slab = M(0x8a6540, 0.55, 0.30);
    g.add(box(w, drop, 0.055, slab, 0, drop / 2, -0.014));

    // A dark seam right along the rib edge, so the boundary between "on the bar"
    // and "on the felt" is visible as the bar moves.
    g.add(box(w, drop * 0.55, 0.006, M(0x2c1d13, 0.9), 0, drop * 0.62, 0.013));

    // brass caps on both ends
    [-1, 1].forEach(function (side) {
      g.add(box(0.026, drop * 1.15, 0.062, M(0xd9a441, 0.40, 0.55),
        side * (w / 2 + 0.004), drop * 0.58, -0.014));
    });

    g.position.y = y;
    return g;
  }

'''
lines[start:end] = new.split("\n")

# --- fix sync: single plate mesh ---
txt = "\n".join(lines)
txt = txt.replace(
    "      plateMeshes.top.position.z = sim.front.top;\n      plateMeshes.bottom.position.z = sim.front.bottom;",
    "      plateMeshes.main.position.z = sim.front;")
# --- fix deck y lookups ---
txt = txt.replace("(G.Sim.DECKS[c.tier] || G.Sim.DECKS.bottom).y", "G.Sim.DECK.y")
txt = txt.replace("G.Sim.DECKS[tier]", "G.Sim.DECK")
txt = txt.replace("(G.Sim.DECKS && G.Sim.DECKS.bottom).y", "G.Sim.DECK.y")

io.open(path, "w", encoding="utf-8", newline="\n").write(txt)
print("ok")
