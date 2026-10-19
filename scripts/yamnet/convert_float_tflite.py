"""Convert Google's official YAMNet Keras weights (data/raw/yamnet/yamnet.h5, md5 verified against Google's storage object, see docs/YAMNET_INTEGRATION.md)
into a FLOAT32 TFLite file with no quantisation: mobile/assets/models/yamnet_float32.tflite.

Graph: input float32 [15600] (16 kHz mono, [-1, 1]; one 0.975 s patch, exactly what scripts/yamnet/yamnet_np.py consumes) -> frames 400/hop 160 (96) -> Hann (periodic)
-> real DFT as two matmuls (cos / sin, 512-point zero padded, 257 bins; TFLite builtins only, no RFFT/Flex ops) -> magnitude -> 64 mel bands (125-7500 Hz, tf.signal
mel matrix) -> log(x + 0.001) -> the 14-layer MobileNet-style tower (BatchNorm folded by the converter) -> global mean -> 521-way logits -> sigmoid.
Output float32 [1, 521] class scores. Needs TensorFlow + h5py (the existing ~/tf_env; run it with -I, nothing is installed):
  ~/tf_env/bin/python -I scripts/yamnet/convert_float_tflite.py
The .h5 is only read as data (h5py); nothing from data/raw is executed."""
import hashlib, os
import numpy as np
import h5py
import tensorflow as tf

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '..'))
H5 = os.path.join(ROOT, 'data/raw/yamnet/yamnet.h5')
OUT = os.path.join(ROOT, 'mobile/assets/models/yamnet_float32.tflite')
LAYERS = [(1, 2), (0, 1), (0, 2), (0, 1), (0, 2), (0, 1), (0, 2), (0, 1), (0, 1), (0, 1), (0, 1), (0, 1), (0, 2), (0, 1)]
PATCH, WIN, HOP, FFT, BINS = 15600, 400, 160, 512, 257

w = {}
with h5py.File(H5, 'r') as f:
    f.visititems(lambda n, o: w.__setitem__(n.replace('/', '__'), np.asarray(o[()]).astype(np.float32)) if isinstance(o, h5py.Dataset) else None)

n = np.arange(WIN)
hann = (0.5 - 0.5 * np.cos(2 * np.pi * n / WIN)).astype(np.float32)
k = np.arange(BINS)
ang = 2 * np.pi * np.outer(n, k) / FFT
C = (hann[:, None] * np.cos(ang)).astype(np.float32)       # (400, 257) window folded into the DFT matrices
S = (hann[:, None] * -np.sin(ang)).astype(np.float32)
IDX = (np.arange(96)[:, None] * HOP + np.arange(WIN)[None, :]).astype(np.int32)   # (96, 400)
MEL = tf.signal.linear_to_mel_weight_matrix(64, BINS, 16000, 125.0, 7500.0).numpy().astype(np.float32)   # (257, 64)


def bn(h, prefix, i):
    q = f'layer{i}/{prefix}/bn/layer{i}/{prefix}/bn/'.replace('/', '__')
    return tf.nn.batch_normalization(h, w[q + 'moving_mean:0'], w[q + 'moving_variance:0'], w[q + 'beta:0'], None, 1e-4)


@tf.function(input_signature=[tf.TensorSpec([PATCH], tf.float32, name='waveform')])
def yamnet_scores(x):
    fr = tf.gather(x, IDX)                                   # (96, 400)
    re, im = tf.matmul(fr, C), tf.matmul(fr, S)
    mag = tf.sqrt(re * re + im * im)
    h = tf.math.log(tf.matmul(mag, MEL) + 0.001)[None, :, :, None]       # (1, 96, 64, 1)
    for i, (full, st) in enumerate(LAYERS, 1):
        if full:
            h = tf.nn.relu(bn(tf.nn.conv2d(h, w[f'layer{i}__conv__layer{i}__conv__kernel:0'], st, 'SAME'), 'conv', i))
        else:
            h = tf.nn.relu(bn(tf.nn.depthwise_conv2d(h, w[f'layer{i}__depthwise_conv__layer{i}__depthwise_conv__depthwise_kernel:0'], [1, st, st, 1], 'SAME'), 'depthwise_conv', i))
            h = tf.nn.relu(bn(tf.nn.conv2d(h, w[f'layer{i}__pointwise_conv__layer{i}__pointwise_conv__kernel:0'], 1, 'SAME'), 'pointwise_conv', i))
    e = tf.reduce_mean(h, axis=[1, 2])                       # (1, 1024)
    return tf.identity(tf.sigmoid(e @ w['logits__logits__kernel:0'] + w['logits__logits__bias:0']), name='scores')


conv = tf.lite.TFLiteConverter.from_concrete_functions([yamnet_scores.get_concrete_function()])
conv.optimizations = []                                      # NO quantisation
conv.target_spec.supported_ops = [tf.lite.OpsSet.TFLITE_BUILTINS]   # builtins only: fail loudly if a Flex op sneaks in
blob = conv.convert()
os.makedirs(os.path.dirname(OUT), exist_ok=True)
open(OUT, 'wb').write(blob)
print(f'wrote {OUT}\n  bytes {len(blob)}\n  sha256 {hashlib.sha256(blob).hexdigest()}\n  tensorflow {tf.__version__}\n  h5 md5 {hashlib.md5(open(H5, "rb").read()).hexdigest()}')
