# Batch stroke expansion with FontForge. Reads "src<TAB>dst" pairs from the
# file given as the first argument; FontForge expands strokes on import and
# removeOverlap merges the contours.
#   fontforge -lang=py -script scripts/experiment-fontforge.py jobs.txt
import sys
import fontforge

with open(sys.argv[1]) as f:
    jobs = [line.rstrip("\n").split("\t") for line in f if line.strip()]

for src, dst in jobs:
    try:
        font = fontforge.font()
        font.em = 1000
        g = font.createChar(65)
        g.importOutlines(src, ("handle_eraser", "correctdir"))
        g.removeOverlap()
        g.export(dst)
        font.close()
    except Exception as e:  # noqa: BLE001
        sys.stderr.write("%s: %s\n" % (src, e))
