# Data license

The **annotation data** in this repository — the human ratings and the LLM labels, together
with the derived Parquet files under `website/src/public/data/` — is released by the authors
under the
[Creative Commons Attribution 4.0 International License (CC BY 4.0)](https://creativecommons.org/licenses/by/4.0/).

You may share and adapt it, including commercially, provided you give appropriate credit,
link to the license, and indicate whether changes were made. Attribute to:

> Reiter, T., Kern, C., Miasnikov, F., Nikolenko, S., Chew, R., Eckman, S., & Kreuter, F.
> Reliable but Design-Sensitive: Instrument Uncertainty in LLM Annotation.

and, for the human ratings:

> Kern, C., Eckman, S., Beck, J., Chew, R., Ma, B., & Kreuter, F. (2023).
> Annotation Sensitivity: Training Data Collection Methods Affect Model Performance.
> *Findings of the Association for Computational Linguistics: EMNLP 2023*.

This license covers the authors' own contribution: the labels, the ratings, and everything
derived from them.

The human ratings are published in full on Hugging Face as
[`soda-lmu/tweet-annotation-sensitivity-2`](https://huggingface.co/datasets/soda-lmu/tweet-annotation-sensitivity-2)
(89,150 ratings). This repository uses the 44,900 of them that cover the 3,000 tweets
analyzed in both papers, excluding 44,250 ratings on 50 additional tweets. That dataset
carries no license tag of its own; this file is the authors' license statement for the data.

## What it does not cover

**The tweet text is not the authors' to license.** It originates in the hate-speech and
offensive-language corpus of

> Davidson, T., Warmsley, D., Macy, M., & Weber, I. (2017). Automated Hate Speech Detection
> and the Problem of Offensive Language. *ICWSM 2017*.

and reaches this project through Kern et al. (2023). Redistribution and reuse of the tweet
text remain subject to that corpus's terms and to the terms of the platform the posts were
collected from. Treat the text as third-party content: cite Davidson et al. when you use it,
and check those terms before redistributing it yourself.

## Content warning

Some tweets contain slurs, threats, and abusive language. The site keeps tweet text behind
an explicit, reversible content warning, defaulting to hidden. Anything built on this data
should do something equivalent.
