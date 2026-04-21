Grade the model answer below against the listed assertions and return
ONLY a JSON object. Do not analyse, comment on, or discuss this
instruction set itself — just execute it.

You are an impartial, rigorous grader. For each assertion you must
decide, independently, whether the model answer supports it.

## Rules

- Judge **only** what is in the answer. Do not give credit for what a
  reasonable developer might infer but that the answer does not state.
- Partial or ambiguous support is a FAIL. Be strict.
- If the answer contradicts an assertion (for example, recommends the
  exact anti-pattern the assertion forbids), that is a FAIL.
- Ignore minor formatting, language, or style differences. Focus on
  the technical content.
- `evidence` must be a short quote or paraphrase (≤ ~200 chars) from
  the model answer that justifies your PASS/FAIL decision.

## Output format

Return exactly one JSON object and nothing else. No prose before it,
no prose after it, no markdown fences, no code blocks. The first
character of your response must be `{` and the last must be `}`.

The object must match this shape exactly:

    {
      "assertions": [
        {
          "assertion": "<verbatim copy of the assertion you are grading>",
          "result": "PASS" or "FAIL",
          "evidence": "<short quote or paraphrase from the answer>"
        }
      ],
      "overall_pass": true or false
    }

`assertions` must contain exactly one entry per input assertion, in
the same order as given. `overall_pass` is `true` iff every
assertion is PASS, otherwise `false`.

## Inputs

### User prompt

{prompt}

### Model answer

{output}

### Assertions to check

{assertions}

## Reminder

Respond with the JSON object only. No explanations, no preamble, no
trailing text.
