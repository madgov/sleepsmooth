# Building the ER-6 sample recording

Goal: one labeled sample WAV, at least 30 s long, used by the live demo. Clips in the Kaggle
snoring set and in ESC-50 are about 1 s each, so the sample is assembled from several clips.
Label shown in the app: "Sample audio assembled from public ESC-50 clips".

Agent C owns the data tooling and generates the file with ffmpeg. Do not generate audio from
the UI code. Suggested steps:

1. Pick about 12 ESC-50 clips (5 s each in ESC-50, CC BY-NC 3.0, attribution required) from
   quiet or ambient classes. Exclude the class "snoring".
2. Convert each to mono, 16 kHz (the app's SAMPLE_RATE): `ffmpeg -i in.wav -ac 1 -ar 16000 out.wav`.
3. Insert 2 to 3 seconds of near-silence between some clips so the quiet-period measure has
   something to find: `ffmpeg -f lavfi -i anullsrc=r=16000:cl=mono -t 3 gap.wav`.
4. Concatenate with the ffmpeg concat demuxer (`-f concat -safe 0 -i list.txt -c copy sample.wav`)
   until the total is 30 s or more (aim for 60 s).
5. Save as `public/sample/sample-audio.wav` and add an attribution file listing each clip's
   ESC-50 filename, author and license (see docs/SOURCES.md, section 3).
6. Verify the result decodes in the app and passes the quality gate (not silent, not clipped).

The precomputed numbers in `demoCase.ts` are separate, synthetic, and always flagged
isSynthetic. They are not the analysis of this file.
