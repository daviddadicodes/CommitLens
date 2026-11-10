# Performance and costs

| Fixture | Transcription | Extraction | Evidence review | Total | Calls and retries | Estimated USD | USD/audio minute |
| --- | --- | --- | --- | --- | --- | --- | --- |
| Baseline | Unmeasured | Unmeasured | Unmeasured | Unmeasured | Unmeasured | Unmeasured | Unmeasured |
| Variant | Unmeasured | Unmeasured | Unmeasured | Unmeasured | Unmeasured | Unmeasured | Unmeasured |
| Ambiguous | Unmeasured | Unmeasured | Unmeasured | Unmeasured | Unmeasured | Unmeasured | Unmeasured |

No OpenAI requests ran during the evaluation attempt because the key was unavailable. With credentials, `npm run evaluate` records stage times, elapsed time, calls, retries and costs. The browser measures from Analyze to final result, including upload and network overhead. Audio preparation occurs before Analyze.

Estimates use returned billed tokens where available. Diarization uses USD 2.50 per million input and USD 10 per million output tokens. GPT-4.1 Mini uses USD 0.40 per million uncached input, USD 0.10 per million cached input, and USD 1.60 per million output tokens. Per-minute cost divides the total by the audio duration in minutes. When usage is unavailable, so is the total. Retries count toward timing and call totals. Any charges for failed attempts without usage are unmeasured. [Diarization pricing](https://developers.openai.com/api/docs/models/gpt-4o-transcribe-diarize) · [Text pricing](https://developers.openai.com/api/docs/models/gpt-4.1-mini)

Fixture synthesis was offline. There is no paid intermediary or runtime synthesis. Free credits do not enter estimates. Hosting costs are separate and unmeasured pending deployment.

## Live evaluation on November 9, 2026

| Fixture | Transcription | Extraction | Validation | Pipeline total | Calls / retries | Estimated cost |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
| Baseline | 26.44 s | 7.73 s | 3.93 s | 38.11 s | 3 / 0 | $0.02383 |
| Variant | 26.65 s | 6.85 s | 3.87 s | 37.37 s | 3 / 0 | $0.02392 |
| Ambiguous | 11.62 s | 3.38 s | 1.28 s | 16.29 s | 3 / 0 | $0.00920 |

The total estimated API cost was $0.05695. These are server-side pipeline measurements rather than browser upload-to-result measurements. Per-minute estimates were respectively $0.02437, $0.02451 and $0.02335. No paid synthesis or intermediary was used. Hosting remains unmeasured.

The final deadline and clarification retest took 39.70 s, 41.80 s and 14.12 s for baseline, variant and ambiguous. Estimated API costs were $0.02406, $0.02388 and $0.00961, or $0.05755 total. Each recording took three calls with zero retries.

## Clearer synthetic recordings

| Recording | Transcription | Extraction | Validation | Pipeline total | Estimated API cost |
| --- | ---: | ---: | ---: | ---: | ---: |
| Baseline | 16.86 s | 7.16 s | 3.71 s | 27.73 s | $0.01938 |
| Variant | 16.40 s | 6.65 s | 3.42 s | 26.48 s | $0.01992 |
| Ambiguous | 8.26 s | 3.22 s | 1.29 s | 12.76 s | $0.00844 |

The three recordings cost an estimated $0.04774 in OpenAI usage. Each used three calls with zero retries. These totals measure the server pipeline. ElevenLabs generation was performed separately and its cost was not measured.

## Ownership clarification regression on ElevenLabs fixtures

| Recording | Transcription | Extraction | Validation | Pipeline total | Estimated USD | USD/audio minute |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
| Baseline | 17.12 s | 6.97 s | 3.31 s | 27.40 s | 0.01955 | 0.02602 |
| Variant | 18.78 s | 5.38 s | 3.18 s | 27.35 s | 0.01961 | 0.02547 |
| Ambiguous | 8.52 s | 3.38 s | 1.31 s | 13.22 s | 0.00845 | 0.02772 |

The run used nine API calls with zero retries and an estimated total cost of USD 0.04761 using the rates above. The time column measures the server pipeline. ElevenLabs generated the test material separately. Its generation cost and hosted browser latency are still unmeasured.

## Fresh conversation test

The 40.91-second fresh recording took 25.84 seconds through the live server pipeline. Transcription took 15.83 s, extraction 6.76 s and validation 3.25 s. Three API calls and zero retries cost an estimated USD 0.01602, or USD 0.02350 per audio minute, using the rates above. Offline eSpeak NG synthesis incurred no API cost. This was a local server evaluation.

## Cancellation follow-up

| Recording | Pipeline seconds | Estimated USD | USD/audio minute |
| --- | ---: | ---: | ---: |
| Clear baseline | 28.01 | 0.01995 | 0.02655 |
| Clear variant | 25.46 | 0.01977 | 0.02568 |
| Clear ambiguous | 11.00 | 0.00849 | 0.02787 |
| Museum replay | 22.10 | 0.01656 | 0.02429 |
| Park holdout | 18.41 | 0.01407 | 0.02602 |

All runs used three API calls each with zero retries. Total estimated API cost was USD 0.07885. These measurements exclude hosted browser latency. The museum and park test audio was generated offline.

## Independent transcription comparison

A separate test of `gpt-transcribe` on the museum and park recordings took 2.26 s and 1.67 s respectively for the transcription calls. The API reported 41 and 33 seconds of audio. At the published USD 0.0045 per audio minute, the estimated total was USD 0.00555, assuming billing matches the returned duration. These figures do not include a commitment extraction or review call. The model is not used by the application pipeline. [Model pricing](https://developers.openai.com/api/docs/models/gpt-transcribe)
