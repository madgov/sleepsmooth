"""Acoustic-type grouping of the ESC-50 NEGATIVE classes, shared by the error analysis and the synthetic nights.
One primary type per class (a judgement call, not a measurement); classes that straddle two types are listed in STRADDLE."""
TYPE = {}
for _t, _names in {
    'breathing/respiratory': ['breathing', 'coughing', 'sneezing'],
    'speech-like vocal': ['laughing', 'crying_baby'],
    'animal': ['dog', 'rooster', 'pig', 'cow', 'frog', 'cat', 'hen', 'insects', 'sheep', 'crow', 'chirping_birds', 'crickets'],
    'transient/impact': ['door_wood_knock', 'mouse_click', 'keyboard_typing', 'door_wood_creaks', 'can_opening', 'glass_breaking', 'clock_tick',
                         'footsteps', 'clapping', 'crackling_fire', 'fireworks', 'water_drops'],
    'tonal': ['clock_alarm', 'siren', 'car_horn', 'church_bells'],
    'mechanical/fan': ['vacuum_cleaner', 'washing_machine', 'engine', 'train', 'helicopter', 'chainsaw', 'airplane', 'hand_saw'],
    'weather/water/other ambient': ['rain', 'sea_waves', 'wind', 'thunderstorm', 'pouring_water', 'toilet_flush', 'brushing_teeth', 'drinking_sipping'],
}.items():
    for _n in _names:
        TYPE[_n] = _t
STRADDLE = {'crickets': 'animal, but a tonal chirp', 'water_drops': 'transient, but also water', 'crackling_fire': 'transient crackle, also ambient',
            'coughing': 'respiratory, also transient', 'brushing_teeth': 'ambient, but rhythmic scrubbing', 'hand_saw': 'mechanical, but rhythmic'}
# Bedroom-relevant negatives as listed in model/MODEL_CARD.md
BEDROOM = ['breathing', 'coughing', 'sneezing', 'clock_tick', 'clock_alarm', 'rain', 'wind', 'crackling_fire', 'footsteps', 'door_wood_creaks',
           'door_wood_knock', 'keyboard_typing', 'mouse_click', 'brushing_teeth', 'vacuum_cleaner', 'washing_machine', 'toilet_flush',
           'drinking_sipping', 'laughing', 'crying_baby', 'thunderstorm', 'insects', 'cat', 'dog']
