import io

path = r"C:\Users\osman_lam\Projects\WebGame\Coin Pusher\main.js"
s = io.open(path, encoding="utf-8").read()

def sub(old, new, label):
    global s
    assert old in s, "MISSING: " + label
    s = s.replace(old, new, 1)

# 1. state: drop the shuttle counter
sub("""    paid: 0,
    shuttled: 0,
    started: false""",
    """    paid: 0,
    started: false""", "state.shuttled")

# 2. applyStage: no onShuttle any more
sub("""    Sim.onBigPayout = onBigPayout;
    Sim.onLost = onLost;
    Sim.onShuttle = onShuttle;
    Sim.seedPile(56 + idx * 4);""",
    """    Sim.onBigPayout = onBigPayout;
    Sim.onLost = onLost;
    Sim.seedPile(56 + idx * 4);""", "applyStage.onShuttle")

# 3. prop spawn: one deck now
sub("""      // Prizes live on the lower deck: that is the only deck that pays out,
      // and a prize on the upper deck would ride down as scrap.
      var T = Sim.DECKS.bottom.table, by = Sim.DECKS.bottom.y;
      var x = T.x0 + 0.10 + Math.random() * (T.x1 - T.x0 - 0.20);
      var z = T.z0 + 0.10 + Math.random() * 0.10;
      var c = Sim.spawn(x, z, 'prop', id, 'bottom');""",
    """      // Prizes surface near the back of the one deck, so they have the whole
      // table to be shoved across before they reach the payout slot.
      var T = Sim.DECK.table, by = Sim.DECK.y;
      var x = T.x0 + 0.10 + Math.random() * (T.x1 - T.x0 - 0.20);
      var z = T.z0 + 0.10 + Math.random() * 0.10;
      var c = Sim.spawn(x, z, 'prop', id);""", "maybeSurfaceProp")

io.open(path, "w", encoding="utf-8", newline="\n").write(s)
print("part 1 ok")
