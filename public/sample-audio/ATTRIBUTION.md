# Attribution: public/sample-audio/esc50-sample.wav

Label shown in the app: "Sample audio assembled from public ESC-50 clips".

Assembled by `scripts/build-sample-audio.ts` (ffmpeg, mono 16 kHz 16-bit) from ESC-50 clips in **fold 5 only**
(held out from model training), with 2.5 s of digital silence between some clips. Order below is playback order
(gaps omitted). Snoring clips are real recordings; the arrangement is artificial and is not an overnight recording.

Dataset: Piczak, K. J. "ESC: Dataset for Environmental Sound Classification", ACM MM 2015,
https://github.com/karolpiczak/ESC-50. Each clip was uploaded to Freesound by its author; the per-clip author
and license are in the ESC-50 `LICENSE` file. License of every clip used: **CC BY-NC 3.0**
(https://creativecommons.org/licenses/by-nc/3.0/), non-commercial use only, attribution required.

| ESC-50 file | Class | Freesound src_file id | License |
|---|---|---|---|
| 5-213293-A-23.wav | breathing | 213293 (https://freesound.org/s/213293/) | CC BY-NC 3.0 |
| 5-216368-A-28.wav | snoring | 216368 (https://freesound.org/s/216368/) | CC BY-NC 3.0 |
| 5-233312-A-28.wav | snoring | 233312 (https://freesound.org/s/233312/) | CC BY-NC 3.0 |
| 5-181766-A-10.wav | rain | 181766 (https://freesound.org/s/181766/) | CC BY-NC 3.0 |
| 5-234145-A-28.wav | snoring | 234145 (https://freesound.org/s/234145/) | CC BY-NC 3.0 |
| 5-201194-A-38.wav | clock_tick | 201194 (https://freesound.org/s/201194/) | CC BY-NC 3.0 |
| 5-235874-A-28.wav | snoring | 235874 (https://freesound.org/s/235874/) | CC BY-NC 3.0 |
| 5-117773-A-16.wav | wind | 117773 (https://freesound.org/s/117773/) | CC BY-NC 3.0 |
| 5-194932-A-7.wav | insects | 194932 (https://freesound.org/s/194932/) | CC BY-NC 3.0 |

The clips were converted to mono 16 kHz and concatenated; no other processing was applied.
