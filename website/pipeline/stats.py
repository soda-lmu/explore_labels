"""Agreement and prevalence estimators.

Ports of the helpers in data_work/src/00_utils.R so the website reproduces the
paper's numbers. Inputs are 0/1 arrays; NaN marks a missing label.
"""
from __future__ import annotations

import numpy as np

Z95 = 1.959963984540054


def prevalence(y) -> dict:
    """Mean of a binary vector with a nominal (simple random sampling) 95% interval."""
    y = np.asarray(y, dtype=float)
    y = y[np.isfinite(y)]
    n = int(y.size)
    if n == 0:
        return {"n": 0, "n_pos": 0, "prev": np.nan, "lo": np.nan, "hi": np.nan}
    p = float(y.mean())
    se = np.sqrt(p * (1 - p) / n)
    return {"n": n, "n_pos": int(y.sum()), "prev": p, "lo": p - Z95 * se, "hi": p + Z95 * se}


def modal(mean_label):
    """Modal label from a mean over runs, matching R's round() (half to even).

    With three runs the mean is 0, 1/3, 2/3 or 1. A cell with one missing run
    can give 0.5, which R rounds to 0. numpy.round has the same rule.
    """
    return np.round(np.asarray(mean_label, dtype=float))


def human_majority(mean_rating):
    """Human majority label: 1 if at least half of the non-missing ratings are 1."""
    m = np.asarray(mean_rating, dtype=float)
    out = (m >= 0.5).astype(float)
    out[~np.isfinite(m)] = np.nan
    return out


def fleiss_kappa_binary(n_pos, n_raters: int = 3) -> float:
    n_pos = np.asarray(n_pos, dtype=float)
    n = n_raters
    if n < 2 or n_pos.size == 0:
        return np.nan
    p_bar = np.mean(n_pos / n)
    p_i = (n_pos * (n_pos - 1) + (n - n_pos) * (n - n_pos - 1)) / (n * (n - 1))
    p_e = p_bar**2 + (1 - p_bar) ** 2
    if np.isclose(1 - p_e, 0):
        return np.nan
    return float((np.mean(p_i) - p_e) / (1 - p_e))


def cohens_kappa(a, b) -> float:
    a = np.asarray(a, dtype=float)
    b = np.asarray(b, dtype=float)
    ok = np.isfinite(a) & np.isfinite(b)
    a, b = a[ok], b[ok]
    if a.size == 0:
        return np.nan
    po = np.mean(a == b)
    pe = a.mean() * b.mean() + (1 - a.mean()) * (1 - b.mean())
    if np.isclose(1 - pe, 0):
        return np.nan
    return float((po - pe) / (1 - pe))


def krippendorff_alpha_binary(m) -> float:
    """Nominal Krippendorff's alpha for an items x raters 0/1 matrix with NaN."""
    m = np.asarray(m, dtype=float)
    ok = np.isfinite(m)
    k = ok.sum(axis=1)
    keep = k >= 2
    m, ok, k = m[keep], ok[keep], k[keep]
    if m.shape[0] == 0:
        return np.nan
    ones = np.where(ok, m, 0).sum(axis=1)
    zeros = k - ones
    # Ordered pairs of disagreeing values within a unit: 2 * ones * zeros.
    do_num = np.sum(2 * ones * zeros / (k - 1))
    do_den = k.sum()
    do = do_num / do_den
    n = do_den
    p1 = ones.sum() / n
    de = 2 * p1 * (1 - p1) * n / (n - 1)
    if de <= 0:
        return np.nan
    return float(1 - do / de)


def pairwise_matrix(labels: np.ndarray) -> dict[str, np.ndarray]:
    """All pairwise comparisons between the columns of an items x instruments matrix.

    Returns square matrices for n (shared non-missing items), raw agreement,
    Cohen's kappa and the four transition counts (row instrument -> column
    instrument). Computed with matrix products so 90 instruments take
    milliseconds.
    """
    L = np.asarray(labels, dtype=float)
    ok = np.isfinite(L).astype(float)
    x = np.where(np.isfinite(L), L, 0.0)
    nx = 1 - x
    x *= ok
    nx *= ok
    n = ok.T @ ok
    n11 = x.T @ x          # positive on both
    n10 = x.T @ nx         # positive on row, negative on column
    n01 = nx.T @ x
    n00 = nx.T @ nx
    with np.errstate(invalid="ignore", divide="ignore"):
        po = (n11 + n00) / n
        pa = (n11 + n10) / n
        pb = (n11 + n01) / n
        pe = pa * pb + (1 - pa) * (1 - pb)
        kappa = (po - pe) / (1 - pe)
    kappa[np.isclose(1 - pe, 0)] = np.nan
    return {"n": n, "agree": po, "kappa": kappa, "n11": n11, "n10": n10, "n01": n01, "n00": n00,
            "prev_a": pa, "prev_b": pb}
