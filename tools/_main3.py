import io

path = r"C:\Users\osman_lam\Projects\WebGame\Coin Pusher\main.js"
s = io.open(path, encoding="utf-8").read()

def sub(old, new, label=''):
    global s
    assert old in s, "MISSING: " + label
    s = s.replace(old, new, 1)

# reset: shuttle counter gone
sub("""    app.state.paid = 0;
    app.state.shuttled = 0;""",
    """    app.state.paid = 0;""", "reset.shuttled")

# reset: no top pile readout
sub("""    UI.setBigCount(C.STAGES[0]);
    UI.setTopPile(0);""",
    """    UI.setBigCount(C.STAGES[0]);""", "reset.setTopPile")

# per-frame top pile repaint
sub("""    if ((frameNo++ & 15) === 0) paintTopPile();
""", "")

sub("""  function paintTopPile() {
    if (UI.setTopPile && Sim.countTier) UI.setTopPile(Sim.countTier('top'));
  }

""", "")

sub("""    applyStage(loaded ? UI.state.stageIdx : 0, loaded);
    paintTopPile();""",
    """    applyStage(loaded ? UI.state.stageIdx : 0, loaded);""", "boot.paintTopPile")

io.open(path, "w", encoding="utf-8", newline="\n").write(s)
print("part 3 ok")
