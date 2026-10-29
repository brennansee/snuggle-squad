Peek-a-Boo! artwork.

HOW IT WORKS
  originals/<name>.png   Your art on a flat bright-green (#00FF00) background. Keep these.
  <name>.webp            Game-ready copies: green removed, trimmed, resized. The game uses these.

To turn new or updated originals into game-ready files, run (needs: pip install pillow numpy):
  python3 tools/remove-green.py

The game looks for these (anything missing is drawn with a simple stand-in):

  background.jpg         The scene (landscape, about 1920x1080). Optional: the Pillow Patch HQ art is used until then.
  pillow.webp            The pillow everyone hides under.

  peek-searching.webp    Looking around with her binoculars
  peek-hmm.webp          "Hmm, not here" (head-scratch)
  peek-startled.webp     Jumping with fright
  peek-fallen.webp       Landed on her bum, dazed
  peek-cheer.webp        Cheering

  boo-pop.webp           Bursting out with a big "BOO!"
  boo-giggle.webp        Giggling
  boo-peek.webp          Just his ears and eyes, peeking over a pillow (the hint)

The silly items under the wrong pillows (duck, sock, toast, snail, toothbrush, slipper,
teddy, fish) are drawn in code in js/peekaboo.js. To use artwork instead, add a transparent
item-duck.png, item-sock.png, item-toast.png, item-snail.png, item-toothbrush.png,
item-slipper.png, item-teddy.png or item-fish.png here.

Tips for new poses: keep every Peek pose on the same size canvas with her feet in the same place
(same for Boo), so swapping poses doesn't make them jump around. The script trims each set of
poses to one shared box, so they stay lined up.

Optional voice clips (in the audio/ folder at the top of the site):
  audio/boo.mp3          Someone shouting "BOO!"
  audio/giggle.mp3       A giggle
