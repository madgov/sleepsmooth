"""Export the TFLite-feature head (v3t) to model/tflite_retrain/model.v3t.json (same schema as src/audio/model/model.v3.json) from
data/processed_tflite/yamnet/trained.v3.json and model/tflite_retrain/metrics.v3.json. Does NOT touch src/. Run: python3 -I scripts/yamnet/export_tflite.py"""
import json, os
ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '..'))
T = json.load(open(os.path.join(ROOT, 'data/processed_tflite/yamnet/trained.v3.json')))
M = json.load(open(os.path.join(ROOT, 'model/tflite_retrain/metrics.v3.json')))
ent = T['chosen']['logreg_scores']
assert ent['feat'] == 'scores' and ent['kind'] == 'logreg'
r8 = lambda a: [[float('%.8g' % v) for v in row] for row in a]
layers = [dict(type='dense', weights=r8(w if hasattr(w[0], '__len__') else [w]), bias=[float('%.8g' % v) for v in (b if hasattr(b, '__len__') else [b])], activation=a)
          for w, b, a in zip(ent['net']['W'], ent['net']['b'], ent['net']['act'])]
model = dict(schema='sleepsmooth-yamnet-head/1', version='sleepsmooth-snore-yamnet-tflite-logreg_scores-0.4.0', kind='logreg_scores',
             input=dict(kind='class-score-logits', dim=521, windowSamples=15600, sampleRate=16000,
                        note='Trained on class scores from the OFFICIAL int8 TFLite YAMNet (lite-model_yamnet_classification_tflite_1.tflite, run with TensorFlow 2.16.2 tf.lite on x86_64), one 15600-sample patch per 1 s window. Must be fed scores from that same file. On-device (iPhone) agreement with the desktop TFLite run is NOT verified.'),
             norm=dict(mean=[float('%.8g' % v) for v in ent['norm']['mean']], std=[float('%.8g' % v) for v in ent['norm']['std']]),
             layers=layers, threshold=ent['threshold'], weightsHash='', trainedAt=M['generatedAt'], status='candidate-not-shipped',
             licenses=dict(trainingData='ESC-50 CC BY-NC 3.0 (non-commercial; weights are therefore non-commercial)', embeddingModel='YAMNet, Apache 2.0 (Google)', labels='AudioSet ontology/labels, CC BY 4.0'))
out = os.path.join(ROOT, 'model/tflite_retrain/model.v3t.json')
json.dump(model, open(out, 'w'))
print('wrote', out, 'threshold', model['threshold'])
