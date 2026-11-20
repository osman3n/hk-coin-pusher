import io

path = r"C:\Users\osman_lam\Projects\WebGame\Coin Pusher\main.js"
s = io.open(path, encoding="utf-8").read()

def sub(old, new, label=''):
    global s
    assert old in s, "MISSING: " + label
    s = s.replace(old, new, 1)

# aim-slot colour: read the live sim value
sub("""    var payW = (Sim.DECKS && Sim.DECKS.bottom && Sim.DECKS.bottom.payW) || 0.31;
    var inSlot = Math.abs(aim.x) <= payW;""",
    """    var payW = Sim.PAY_W;
    var inSlot = Math.abs(aim.x) <= payW;""", "paintAimSlot")

# gutter strips: one deck
sub("""    var bot = (G.Sim.DECKS && G.Sim.DECKS.bottom) || {};
    var payW = (typeof bot.payW === 'number') ? bot.payW : 0.31;
    var tw = 0.56;                            // one table half-width
    var gW = tw - payW;                       // width the gutter occupies
    var gz0 = (bot.table && typeof bot.table.z0 === 'number') ? bot.table.z0 : -0.44;""",
    """    var dk = G.Sim.DECK;
    var payW = dk.payW;
    var tw = (dk.table.x1 - dk.table.x0) / 2;  // one table half-width
    var gW = tw - payW;                       // width the gutter occupies
    var gz0 = dk.table.z0;""", "gutterStrips")

io.open(path, "w", encoding="utf-8", newline="\n").write(s)
print("part 4 ok")
