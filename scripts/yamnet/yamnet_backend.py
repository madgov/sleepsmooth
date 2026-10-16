"""Select the YAMNet feature source: YAMNET_BACKEND=numpy (default; scripts/yamnet/yamnet_np.py) or tflite (scripts/yamnet/yamnet_tfl.py, official TFLite file)."""
import os
if os.environ.get('YAMNET_BACKEND', 'numpy') == 'tflite':
    from yamnet_tfl import YamNet
else:
    from yamnet_np import YamNet
BACKEND = os.environ.get('YAMNET_BACKEND', 'numpy')
SCORES_ONLY = BACKEND == 'tflite'
