# Test results

The expectations in `tests/expected.json` were written before running the evaluator. They are used exclusively in tests.

| Fixture | Duration | Expected result | Live result |
| --- | ---: | --- | --- |
| Baseline | 58.65 s | Jordan Ellis completes homepage wireframes by Friday after a revision. Maya Chen sends the launch checklist Wednesday. The budget review is agreed for next Monday with no owner. Newsletter cancelled, pricing-page redesign excluded, and webinar vendor unresolved. No calendar date is established. | Unmeasured |
| Variant | 58.57 s | The same outcomes with Maya's checklist due Tuesday. | Unmeasured |
| Ambiguous | 23.65 s | Vendor handoff needs clarification or remains open. Jordan's conditional answer creates no active task. | Unmeasured |

The recordings contain original fictional dialogue. Offline eSpeak NG synthesized Maya with `en-us+f3` and Jordan with `en-us+m3`. The variant reuses all baseline turns except Maya's checklist deadline. Run `npm run fixtures` to regenerate them.

## Checks run

- TypeScript and the production build passed.
- Five local checks passed covering schema validation, exact quotes and timestamps, invalid dates, withheld verdicts, canonical non-silent WAVs, and HTTP input and credential errors.
- Headless Microsoft Edge accepted the real baseline WAV, decoded the original audio and displayed the missing-key error. A synthetic UI-only response exercised evidence seek, stop and replay on the actual WAV and checked outcome filters, transcript search, speaker switching, source-row highlighting and horizontal overflow at 390 px. This browser test did not exercise model output.
- Live evaluation stopped before calling OpenAI because `OPENAI_API_KEY` was unavailable. Live false positives, false negatives, owner and deadline accuracy, and semantic evidence validity are unmeasured.

The live evaluator checks title patterns, statuses, dates, owners, revision history, and transcript evidence. It reports false positives and negatives separately and counts a cancelled task returned as active as an error. Review close paraphrases manually when a title misses an expected pattern. Listen to the source clips to judge transcription and semantic support.

## Live evaluation on November 9, 2026

The three recordings were processed with OpenAI. Baseline and variant each found two of three expected active tasks. The transcript rendered “launch checklist” as “lunch checklist” and “review budget” as “renew budget”. Both also classified the unaccepted pricing-page proposal as open. Neither retained the cancelled newsletter as active. The deadline fields were incorrect, and the variant invented an absolute date for the budget review. The ambiguous recording produced no false active task but missed the expected open or clarification item. Exact transcript and timestamp checks reported no errors, but those checks cannot establish transcription or semantic accuracy. See tests/actual-results.json for the detailed results.

This run exposed material extraction failures and does not establish that the prototype meets the requested accuracy. Earlier rows marked unmeasured describe the status before this run.

## Deadline and clarification retest

The final live baseline recovered all three expected active tasks, owners and deadlines. The variant retained Friday and moved the checklist to Tuesday, but the automatic matcher flagged “Home Page wire frames” and the transcription error “lunch checklist”. The ambiguous recording returned a clarification and no active task, but its title contained the misheard “Menger hand off”, so the evaluator marked the expected topic missing. Baseline and variant both added a redundant clarification about the unassigned budget task. No evidence alignment errors or invented absolute dates were observed on this run. The strict evaluator still exited with failures. All six local tests passed.

## Clearer synthetic recordings

The three user-supplied ElevenLabs MP3s were converted with the same browser audio preparation code CommitLens uses for uploads. The normalized WAVs are in tests/clear. Run npm run evaluate -- --clear to reproduce this evaluation with the original expectations. The original WAVs and their results remain available for comparison.

Baseline passed every check. Variant recovered all three active tasks, owners and deadlines, including the checklist move to Tuesday. It added one extra clarification about assigning the already-agreed budget review, which caused the strict evaluator to exit with a failure. The ambiguous handoff passed and produced no active task. There were no missed expected items and no quote or timestamp alignment errors across 71 checked clips. These checks compare the cited text and bounds with the transcript. The new files still need a manual browser playback check.

## Ownership clarification regression

After updating extraction and review to distinguish an agreed collective task with no named owner from a conditional handoff, the strict live evaluator passed all three ElevenLabs fixtures. It found six expected active tasks across baseline and variant, with all six owner and deadline fields correct, including the intentionally empty budget owner. It reported zero false positives, zero false negatives, zero cancelled tasks retained as active, and zero alignment errors across 71 clips. The ambiguous fixture produced one clarification and no active task. See `tests/actual-clear-results.json` for the latest measured run.

## Fresh conversation test

This 40.91-second fictional museum discussion uses two non-overlapping English voices who introduce themselves. The dialogue and expected outcomes were written before generating the audio or running analysis. Regenerate it with `npm run fixtures -- --fresh` and run the separate live test with `npm run evaluate -- --fresh`. The packaged `tests/fresh.wav` can also be uploaded directly in the browser. See `tests/fresh-dialogue.json`, `tests/fresh-expected.json` and `tests/actual-fresh-results.json`.

| Case | Expected | Actual |
| --- | --- | --- |
| Floor plan | Owen Reed will send it by Thursday. Wednesday was only proposed. Thursday stays relative. | One active task, correctly due Thursday, with speaker B as owner. Both spoken names were garbled in transcription. |
| Display cases | Cancelled, with the original Friday agreement and later cancellation in history. | Excluded from active tasks, but displayed as a decision instead of a cancelled task. |
| Opening room | Open question. | Open question. |
| Souvenir postcards | Excluded suggestion. | Excluded suggestion. |

The strict evaluator failed on the named owner and cancellation status. It found no unsupported active task or quote and timestamp alignment errors across 17 clips. The floor-plan confirmation at 0:10.10 to 0:12.90 supports Thursday. The Wednesday proposal and reply at 0:13.75 to 0:18.95 contain no agreement to change it. The cancellation text was recognizable in the transcript, so the status error arose in extraction and review rather than from missing words in the transcript.

## Cancellation follow-up

Extraction and evidence review now distinguish a task withdrawal from a standalone decision. In the museum replay, the display-case order moved from Decision to Cancelled with earlier and later evidence. Thursday stayed the active floor-plan deadline. Speaker B remained unresolved, and the run surfaced a redundant Wednesday clarification. The first run is archived in `tests/history/actual-fresh-first-run.json`; the replay is in `tests/actual-fresh-results.json`.

A separate 32.44-second park discussion was written after the prompt change, with expectations set before generation or analysis. In the park test, printing maps was correctly marked cancelled, the gate question stayed open, and the app recovered Ben Miller and Tuesday. It misheard "bus" as "box", so the strict evaluator flagged the resulting active task and missed the expected bus task. The park fixture therefore verifies the cancellation change while exposing a separate transcription error. The packaged recording is `tests/holdout.wav`, with `holdout-dialogue.json`, `holdout-expected.json` and `actual-holdout-results.json` in the same folder. Run `npm run evaluate -- --holdout` to reproduce. The six local tests and all three clearer ElevenLabs live tests passed after the cancellation change.

## Independent transcription comparison

The recommended `gpt-transcribe` model was tested separately on the two synthetic recordings with the existing scripts as ground truth. On the park recording, it heard "book the bus" correctly where the diarization model heard "book the box", but it misheard Anna Smith's introduction as Ben Smith. On the museum recording, it failed to recover Nina Brooks and Owen Reed, and rendered "I'll order" as "I ordered". The two responses are recorded in `tests/transcription-comparison.json`. Run `node server/launch.mjs tests/compare-transcription.mjs` with a configured key to reproduce. This is an exploratory transcription comparison, not a run of the app's full commitments pipeline. It supports further work on handling conflicting transcripts but does not establish that a second pass resolves the problem.
