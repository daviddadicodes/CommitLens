# CommitLens submission

- Live demo URL · Pending deployment
- Repository URL · Pending GitHub push
- Walkthrough video URL · Pending recording

## Included

Audio upload and playback, streaming stage updates, an OpenAI analysis pipeline, evidence review and playback, timing and cost instrumentation, three reproducible fixtures, and a live evaluator. The local build and six automated tests passed. Browser upload and live analysis were confirmed locally. The final live test set used three clearer recordings generated in ElevenLabs. All three passed the strict live evaluator after the ownership clarification fix. Pipeline latency was 13.22 to 27.40 seconds per recording, with estimated OpenAI usage of USD 0.04761 total. Hosted verification is pending. Replace the diarization model before its February 2027 shutdown and test the replacement with noisy and overlapping speech.

## Walkthrough outline (2 minutes 40 seconds)

- **0:00–0:25** · Upload the baseline recording and start analysis.
- **0:25–0:55** · Explain the three processing stages. Show a saved live result if the new run is still processing.
- **0:55–1:30** · Play the wireframe deadline evidence and the earlier agreement from history.
- **1:30–2:05** · Show the cancellation, unassigned budget task, unresolved vendor and excluded proposal.
- **2:05–2:40** · Compare the variant's changed deadline, show the ambiguous handoff and point to the timing and cost report.

## Development log

- Checked official model compatibility, pricing and deployment limits.
- Implemented time-aligned WAV conversion and kept playback on the original file.
- Wrote expected results, then generated the fixture audio offline.
- Built and tested the local app. The live evaluation requires a configured OpenAI project key.

- Logged approximately 15 minutes of local implementation and verification, from the initial workspace check to the final browser check.

The first live evaluation revealed transcription errors, incorrect deadline fields, an invented absolute date and a missed clarification. Deadline validation and review prompts were updated before the final retest. The initial time log covers the first implementation and verification session. Later debugging and retest time was not tracked.

## What failed on the original recordings

The first live run on the eSpeak fixtures misheard "launch checklist" as "lunch checklist" and "review budget" as "renew budget". Baseline and variant each missed one of three expected active tasks in the evaluator. The pipeline also treated a tentative pricing-page suggestion as an open question, produced incorrect deadline fields and an unsupported calendar date, and missed the expected ambiguous handoff. These were observed on the original recordings. Some failures arose in extraction or validation, so recording quality alone does not explain them.

To check the AI output, compare the known script with the transcript and then check the extracted state against the expected list. In the checklist example, a quote could match the transcript exactly and still be wrong against the script. Deadline and clarification validation were tightened, and the three clearer ElevenLabs recordings later passed the strict evaluator. The original failures remain part of the delivery record.

## Fresh conversation result

The separate 40.91-second museum fixture kept the agreed Thursday deadline when Wednesday was only proposed. It correctly reported the open room question and excluded the postcard suggestion. It failed strict evaluation because the synthetic audio's introduction for Owen Reed was mistranscribed and the system fell back to speaker B. The display-case order stayed out of active tasks but was labeled a decision instead of cancelled. The unmodified pipeline was tested against expectations set before the run. The detailed comparison and reproduction commands are in TEST_RESULTS.md. Pipeline time was 25.84 seconds and estimated API cost was USD 0.01602. The next improvements are checking name recovery on varied speech and tightening the cancellation audit when a topic contains an earlier commitment.

## Cancellation follow-up

The museum replay and the new park recording both classified an earlier commitment as cancelled after a later withdrawal. The clearer ElevenLabs regression set passed all three cases again. The museum still returned Speaker B and an unnecessary deadline clarification. The new park recording exposed "bus" mistranscribed as "box", so neither offline synthetic case passed every strict check. The first museum run and both follow-up outputs are packaged. See TEST_RESULTS.md and PERFORMANCE.md for the exact outcomes and measurements.

## Additional transcription investigation

A separate comparison with `gpt-transcribe` recovered "bus" in the park test but misheard a speaker name, and it made name and verb-tense errors in the museum test. Its two transcription requests cost an estimated USD 0.00555 combined and took 2.26 and 1.67 seconds. The comparison is included for reproduction and is not part of the application's processing. A future implementation could flag substantive disagreements for the user to review against the audio, then measure whether that improves outcomes across fresh recordings.

The results view reminds users to listen to the evidence for names, tasks and deadlines because transcription can mishear words. This supports review but does not automatically detect or correct a misheard word.
