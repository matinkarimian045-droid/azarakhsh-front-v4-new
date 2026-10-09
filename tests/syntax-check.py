"""Compatibility entry point: source, server and compiled syntax checks."""
from pathlib import Path
import subprocess
import sys
ROOT=Path(__file__).resolve().parents[1]
sys.exit(subprocess.call(['node',str(ROOT/'tools/check-syntax.cjs')],cwd=ROOT))
