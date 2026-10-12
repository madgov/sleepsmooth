"""Pure-NumPy YAMNet (inference only), built from Google's official Keras weights (Apache 2.0).

Why this exists: no TensorFlow / TFLite / ONNX runtime is installed locally and installing one needs approval. The architecture
(MobileNetV1-style, 14 layers, then a 521-way logits layer) and the audio frontend follow Google's published `params.py`/`features.py`/
`yamnet.py` (tensorflow/models research/audioset/yamnet). This is a re-implementation: it has been sanity checked on ESC-50 class
agreement (scripts/yamnet/sanity.py) but NOT compared bit-for-bit with the official TFLite output. Treat embeddings as "YAMNet-like".

Input: 15600 float32 samples at 16 kHz (0.975 s) in [-1, 1] -> 96 log-mel frames x 64 bands -> one patch.
Outputs per patch: 1024-d embedding (global average pool of the last layer), 521 class scores (sigmoid of logits).
"""
import os
import numpy as np

SR = 16000
PATCH_SAMPLES = 15600           # 96 frames: (15600 - 400) / 160 + 1
STFT_WIN, STFT_HOP, FFT = 400, 160, 512
MEL_BANDS, MEL_MIN, MEL_MAX, LOG_OFFSET = 64, 125.0, 7500.0, 0.001
BN_EPS = 1e-4

# (kernel, stride, out_channels) ; layer1 is a full conv, layers 2..14 are depthwise-separable
LAYERS = [(1, 2, 32), (0, 1, 64), (0, 2, 128), (0, 1, 128), (0, 2, 256), (0, 1, 256), (0, 2, 512),
          (0, 1, 512), (0, 1, 512), (0, 1, 512), (0, 1, 512), (0, 1, 512), (0, 2, 1024), (0, 1, 1024)]


def _mel_matrix():
    n_bins = FFT // 2 + 1
    hz = np.linspace(0.0, SR / 2.0, n_bins)[1:]  # tf.signal.linear_to_mel_weight_matrix zeroes the DC bin
    mel = lambda f: 1127.0 * np.log(1.0 + f / 700.0)
    edges = np.linspace(mel(MEL_MIN), mel(MEL_MAX), MEL_BANDS + 2)
    lo, ce, hi = edges[:-2], edges[1:-1], edges[2:]
    m = mel(hz)[:, None]
    w = np.maximum(0.0, np.minimum((m - lo) / (ce - lo), (hi - m) / (hi - ce)))
    return np.vstack([np.zeros((1, MEL_BANDS)), w]).astype(np.float32)


_MEL = _mel_matrix()
_HANN = (0.5 - 0.5 * np.cos(2 * np.pi * np.arange(STFT_WIN) / STFT_WIN)).astype(np.float32)  # periodic Hann


def log_mel_patch(x):
    """x: (B, 15600) float32 -> (B, 96, 64) log-mel (magnitude spectrogram, log(mel + 0.001))."""
    B = x.shape[0]
    n_frames = (x.shape[1] - STFT_WIN) // STFT_HOP + 1
    idx = np.arange(STFT_WIN)[None, :] + STFT_HOP * np.arange(n_frames)[:, None]
    frames = x[:, idx] * _HANN                                   # (B, F, 400)
    mag = np.abs(np.fft.rfft(frames, n=FFT, axis=-1)).astype(np.float32)  # (B, F, 257)
    return np.log(mag @ _MEL + LOG_OFFSET).astype(np.float32)


def _same_pad(n, k, s):
    out = -(-n // s)
    total = max((out - 1) * s + k - n, 0)
    return total // 2, total - total // 2, out


class YamNet:
    def __init__(self, weights_path=None):
        if weights_path is None:
            root = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '..'))
            weights_path = os.path.join(root, 'data/processed/yamnet/weights.npz')
        w = np.load(weights_path)
        g = lambda k: w[k]
        self.layers = []
        for i, (full, stride, cout) in enumerate(LAYERS, start=1):
            def bn(prefix):
                p = f'layer{i}/{prefix}/bn/layer{i}/{prefix}/bn/'.replace('/', '__')
                beta, mean, var = g(p + 'beta:0'), g(p + 'moving_mean:0'), g(p + 'moving_variance:0')
                scale = 1.0 / np.sqrt(var + BN_EPS)
                return scale.astype(np.float32), (beta - mean * scale).astype(np.float32)  # y = x*scale + shift
            if full:
                k = g(f'layer{i}__conv__layer{i}__conv__kernel:0')           # (3,3,1,32)
                s, b = bn('conv')
                self.layers.append(('conv', stride, k.reshape(9, -1) * 1.0, s, b))
            else:
                dk = g(f'layer{i}__depthwise_conv__layer{i}__depthwise_conv__depthwise_kernel:0')[..., 0]  # (3,3,C)
                ds, db = bn('depthwise_conv')
                pk = g(f'layer{i}__pointwise_conv__layer{i}__pointwise_conv__kernel:0')[0, 0]            # (Cin,Cout)
                ps, pb = bn('pointwise_conv')
                # fold BN scale into the weights
                self.layers.append(('sep', stride, dk * ds, db, pk * ps, pb))
        self.Wl = g('logits__logits__kernel:0')
        self.bl = g('logits__logits__bias:0')

    def _conv1(self, x, stride, k, s, b):
        B, H, W, _ = x.shape
        pt, pb_, oh = _same_pad(H, 3, stride)
        pl, pr, ow = _same_pad(W, 3, stride)
        xp = np.pad(x, ((0, 0), (pt, pb_), (pl, pr), (0, 0)))
        cols = [xp[:, dy:dy + stride * (oh - 1) + 1:stride, dx:dx + stride * (ow - 1) + 1:stride, 0] for dy in range(3) for dx in range(3)]
        col = np.stack(cols, axis=-1)                              # (B,oh,ow,9)
        return np.maximum(col @ (k * s) + b, 0)

    def _sep(self, x, stride, dk, db, pk, pb):
        B, H, W, C = x.shape
        pt, pb_, oh = _same_pad(H, 3, stride)
        pl, pr, ow = _same_pad(W, 3, stride)
        xp = np.pad(x, ((0, 0), (pt, pb_), (pl, pr), (0, 0)))
        acc = np.zeros((B, oh, ow, C), np.float32)
        for dy in range(3):
            for dx in range(3):
                acc += xp[:, dy:dy + stride * (oh - 1) + 1:stride, dx:dx + stride * (ow - 1) + 1:stride, :] * dk[dy, dx]
        acc = np.maximum(acc + db, 0)
        return np.maximum(acc @ pk + pb, 0)

    def embed(self, x, return_logits=False):
        """x: (B, 15600) float32. Returns (embeddings (B,1024), scores (B,521))."""
        h = log_mel_patch(np.asarray(x, np.float32))[..., None]    # (B,96,64,1)
        for L in self.layers:
            h = self._conv1(h, L[1], L[2], L[3], L[4]) if L[0] == 'conv' else self._sep(h, *L[1:])
        emb = h.mean(axis=(1, 2))
        logits = emb @ self.Wl + self.bl
        return emb.astype(np.float32), (logits if return_logits else 1.0 / (1.0 + np.exp(np.clip(-logits, -60.0, 60.0)))).astype(np.float32)

    def embed_many(self, x, batch=128):
        embs, scs = [], []
        for i in range(0, len(x), batch):
            e, s = self.embed(x[i:i + batch])
            embs.append(e); scs.append(s)
        return np.concatenate(embs), np.concatenate(scs)


def window_to_patch(win):
    """A 1 s (16000-sample) analysis window -> the centered 15600 samples YAMNet expects (offset 200)."""
    n = len(win)
    if n < 16000:
        win = np.pad(win, (0, 16000 - n))
    return win[200:200 + PATCH_SAMPLES]


def read_wav_f32(path):
    """Minimal RIFF reader for the mono float32 / PCM16 files ffmpeg writes in data/processed/clips."""
    b = open(path, 'rb').read()
    assert b[:4] == b'RIFF' and b[8:12] == b'WAVE'
    pos, fmt, bits = 12, 1, 16
    while pos + 8 <= len(b):
        cid, size = b[pos:pos + 4], int.from_bytes(b[pos + 4:pos + 8], 'little')
        body = pos + 8
        if cid == b'fmt ':
            fmt = int.from_bytes(b[body:body + 2], 'little'); bits = int.from_bytes(b[body + 14:body + 16], 'little')
        elif cid == b'data':
            raw = b[body:body + size]
            if fmt == 3 and bits == 32:
                return np.frombuffer(raw, '<f4').astype(np.float32)
            if fmt == 1 and bits == 16:
                return (np.frombuffer(raw, '<i2').astype(np.float32) / 32768.0)
            raise ValueError(f'unsupported wav fmt {fmt}/{bits}')
        pos = body + size + (size & 1)
    raise ValueError('no data chunk')
