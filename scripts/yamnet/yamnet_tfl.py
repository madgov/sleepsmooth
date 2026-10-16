"""Official TFLite YAMNet (lite-model_yamnet_classification_tflite_1.tflite) as a drop-in for yamnet_np.YamNet, for scripts run with the
Python that has TensorFlow (~/tf_env, `tf.lite.Interpreter`, run read-only; nothing is installed). The model file is only opened by the interpreter.
It exposes the 521 class scores only: `embed` returns a dummy 1-column embedding (so nothing can accidentally train on embeddings) and the scores.
Input: 15600 float32 samples at 16 kHz in [-1, 1], exactly as the phone will feed it (no AGC, no preprocessing)."""
import os
import numpy as np

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '..'))
TFLITE = os.path.join(ROOT, 'data/raw/yamnet/lite-model_yamnet_classification_tflite_1.tflite')


class YamNet:
    def __init__(self):
        import tensorflow as tf
        self.it = tf.lite.Interpreter(model_path=TFLITE)
        self.it.allocate_tensors()
        self.i = self.it.get_input_details()[0]
        outs = self.it.get_output_details()
        self.o = ([d for d in outs if d['shape'][-1] == 521] or outs)[0]
        self.shape = [int(s) for s in self.i['shape']]
        assert int(np.prod(self.shape)) == 15600, self.shape

    def embed(self, x, return_logits=False):
        x = np.asarray(x, np.float32)
        out = np.empty((len(x), 521), np.float32)
        for k, w in enumerate(x):
            self.it.set_tensor(self.i['index'], np.ascontiguousarray(w).reshape(self.shape))
            self.it.invoke()
            out[k] = self.it.get_tensor(self.o['index']).reshape(-1)[:521]
        return np.zeros((len(x), 1), np.float32), out

    def embed_many(self, x, batch=128):
        return self.embed(x)
