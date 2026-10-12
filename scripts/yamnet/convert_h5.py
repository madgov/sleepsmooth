"""One-off: read data/raw/yamnet/yamnet.h5 (untrusted data, read only) and write plain NumPy weights.

The environment's h5py is binary-incompatible with its NumPy 2.4. This script borrows the NumPy 1.26.4 copy that is already in the
local conda package cache (no install, no download) ONLY to read the HDF5 file, then saves an .npz that any NumPy can read.
Run:  python3 -I scripts/yamnet/convert_h5.py
"""
import sys
sys.path.insert(0, '/opt/anaconda3/pkgs/numpy-base-1.26.4-py312hbb3573c_0/lib/python3.12/site-packages')
import numpy as np, h5py, os  # noqa: E402
assert np.__version__.startswith('1.26'), np.__version__
ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '..'))
f = h5py.File(os.path.join(ROOT, 'data/raw/yamnet/yamnet.h5'), 'r')
out, names = {}, []
def visit(n, o):
    if isinstance(o, h5py.Dataset):
        out[n.replace('/', '__')] = np.asarray(o[()]).astype(np.float32)
        names.append((n, o.shape))
f.visititems(visit)
for n, s in names: print(n, s)
os.makedirs(os.path.join(ROOT, 'data/processed/yamnet'), exist_ok=True)
np.savez(os.path.join(ROOT, 'data/processed/yamnet/weights.npz'), **out)
