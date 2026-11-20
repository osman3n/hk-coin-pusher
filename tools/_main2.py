import io

path = r"C:\Users\osman_lam\Projects\WebGame\Coin Pusher\main.js"
s = io.open(path, encoding="utf-8").read()

def sub(old, new, label=''):
    global s
    assert old in s, "MISSING: " + label
    s = s.replace(old, new, 1)

# remove the now-dead onShuttle block
sub("""  // A coin riding the upper deck is not paid, not lost, and used to be silent:
  // the top deck read as scenery. A dry tick as it leaves, throttled, so a
  // cascade does not turn into a burst of noise.
  var lastShuttle = 0;
  function onShuttle(coin) {
    app.state.shuttled++;
    var now = performance.now();
    if (now - lastShuttle < 55) return;
    lastShuttle = now;
    UI.shuttlePing();
  }

""", "")

io.open(path, "w", encoding="utf-8", newline="\n").write(s)
print("part 2 ok")
