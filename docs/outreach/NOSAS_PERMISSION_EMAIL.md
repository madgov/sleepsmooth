# NoSAS permission request: draft (DO NOT SEND without the user's review)

Nothing has been sent. The user sends it, from their own address, after filling the TODOs.

## Who to write to: NOT VERIFIED
- Paper: Marti-Soler H, Hirotsu C, Marques-Vidal P, Vollenweider P, Waeber G, Preisig M, Tafti M, Tufik SB, Bittencourt L, Tufik S, Haba-Rubio J, Heinzer R. The NoSAS score for screening of sleep-disordered breathing: a derivation and validation study. Lancet Respir Med 2016;4(9):742-748. doi:10.1016/S2213-2600(16)30075-3.
- Where we looked on 2026-10-15:
  - https://iris.unil.ch/handle/iris/57504 (University of Lausanne repository). It lists the 12 authors in the order above and the units "UNIL/CHUV/Unisanté", but **gives no corresponding author, email or postal address**. Its licence field says "Tous les droits reservés" (all rights reserved) and the record is restricted to UNIL.
  - https://www.thelancet.com/journals/lanres/article/PIIS2213-2600(16)30075-3/fulltext returned HTTP 403 to our fetch tool, so the correspondence line was not read.
  - PubMed returned no readable record to our fetch tool.
- **Action for the user:** open the Lancet article page in a browser and read the "Correspondence to" line; use that address. The senior (last) author is Raphael Heinzer, but we have **not verified** that he is the corresponding author or what his institutional email is. Do not guess an address. Alternative: the author directory of the Center for Investigation and Research in Sleep, Lausanne University Hospital (CHUV) (unverified), or the publisher's "request permissions" route (RightsLink) for the figure/table text.
- `docs/SOURCES.md` records that no licence or permission requirement was found for the published scoring formula (residual uncertainty low but nonzero) and recommends emailing the corresponding author. Log any reply there.

## Draft

**To:** TODO corresponding author email (from the Lancet page)
**Cc:** TODO (optional: co-authors)
**Subject:** Permission request: using the NoSAS score in a free, non-diagnostic sleep-information app

Dear Dr. TODO,

I am writing about the NoSAS score (Marti-Soler et al., Lancet Respir Med 2016;4:742-748). I am TODO name, building SleepSmooth, a small app that helps adults organise what they notice about their sleep and prepare for a conversation with a clinician. It is informational only. It does not diagnose, and it states clearly that a low score cannot rule out sleep apnea.

We would like to include the five NoSAS items (neck circumference, body mass index, snoring, age over 55, male sex) and the published scoring (0 to 17, cutoff 8) exactly as published, with a full citation to your paper. The app would:
- show the total and whether it is at or above the published cutoff, in plain language, and always state that the score is not a diagnosis and is being used outside the populations in which it was validated;
- never combine the score with other data into a risk estimate;
- keep answers on the user's phone (to be confirmed before release, TODO);
- be distributed through the Apple App Store as TODO free / paid.

We could not find licensing terms for reuse of the instrument. Could you tell us:
1. Whether we may use the NoSAS items and scoring in this way, and under what conditions (attribution text, non-commercial only, fees, anything you prefer we avoid)?
2. Whether you would like us to describe the score in particular words?
3. Whether there is a preferred version or translation to use?

If you would rather we did not use it, we will remove it and show only the user's own reported symptoms. We would be grateful for a reply either way and will keep it on file.

Thank you for the work on the score.

Kind regards,
TODO name, TODO role, TODO contact

## Log (fill in after sending)
| Date sent | To | Reply date | Outcome | Conditions |
|---|---|---|---|---|
| | | | | |

## If permission is refused or there is no reply before launch: fallback

A single flag hides NoSAS everywhere. In `src/content/claims.ts`:

```ts
export const NOSAS_ENABLED: boolean = true;   // set to false to hide NoSAS
```

When `false` (implemented and typechecked in this pass; both web and iPhone):
- iPhone questionnaire and onboarding skip the six NoSAS questions (height, weight, neck, snoring, age, sex); review rows and the onboarding "About" card omit NoSAS.
- Web questionnaire opens at the symptom checklist.
- The evidence engine does not produce a NoSAS item and does not list it as "missing"; the rules treat it as unanswered, so no cutoff-based "worth discussing" headline can come from NoSAS.
- The Checks tab omits the NoSAS row.
- Only user-reported symptoms, the red-flag question, the optional partner notes and sound observations remain.

**Not covered by the flag (check when using it):** the Sources/model-card pages still mention NoSAS in citation text; the demo case and summary text builders still pass the demo answers to code that now ignores them; the `Sources` page header; the web Info view's NoSAS section; saved answers that users already entered remain in storage. Search for `NoSAS` and remove those references if permission is refused. Re-run the full test suite with the flag off before shipping; this pass only ran it with the flag on.
