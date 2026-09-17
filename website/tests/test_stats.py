"""Hand-checked fixtures for the estimators in pipeline/stats.py."""
import sys
from pathlib import Path

import numpy as np
import pytest

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "pipeline"))
import stats as S  # noqa: E402

nan = np.nan


def test_prevalence_and_interval():
    r = S.prevalence([1, 0, 1, 1, nan])
    assert r["n"] == 4 and r["n_pos"] == 3 and r["prev"] == 0.75
    half = 1.959963984540054 * np.sqrt(0.75 * 0.25 / 4)
    assert r["lo"] == pytest.approx(0.75 - half) and r["hi"] == pytest.approx(0.75 + half)


def test_modal_matches_r_round_half_even():
    assert list(S.modal([0, 1 / 3, 2 / 3, 1, 0.5])) == [0, 0, 1, 1, 0]


def test_human_majority_ties_positive():
    out = S.human_majority([0.5, 1 / 3, 2 / 3, nan])
    assert list(out[:3]) == [1, 0, 1] and np.isnan(out[3])


def test_cohens_kappa():
    # 2x2: n11=20, n10=5, n01=10, n00=15 -> po=.7, pe=.5*.6+.5*.4=.5, kappa=.4
    a = np.array([1] * 25 + [0] * 25)
    b = np.array([1] * 20 + [0] * 5 + [1] * 10 + [0] * 15)
    assert S.cohens_kappa(a, b) == pytest.approx(0.4)
    assert np.isnan(S.cohens_kappa([1, 1], [1, 1]))


def test_fleiss_kappa_binary():
    # Perfect agreement with mixed prevalence -> 1.
    assert S.fleiss_kappa_binary([0, 3, 3, 0]) == pytest.approx(1.0)
    # Classic check: n_pos = [1, 2] -> P_i = 1/3 each, p_bar = .5, P_e = .5 -> kappa = -1/3
    assert S.fleiss_kappa_binary([1, 2]) == pytest.approx(-1 / 3)


def test_krippendorff_alpha_binary():
    krippendorff = pytest.importorskip("krippendorff")
    rng = np.random.default_rng(1)
    m = rng.integers(0, 2, size=(200, 3)).astype(float)
    m[rng.random(m.shape) < 0.1] = nan
    ref = krippendorff.alpha(reliability_data=m.T, level_of_measurement="nominal")
    assert S.krippendorff_alpha_binary(m) == pytest.approx(ref)


def test_pairwise_matrix_matches_scalar_functions():
    rng = np.random.default_rng(2)
    L = rng.integers(0, 2, size=(300, 4)).astype(float)
    L[rng.random(L.shape) < 0.05] = nan
    P = S.pairwise_matrix(L)
    for i in range(4):
        for j in range(4):
            if i == j:
                continue
            ok = np.isfinite(L[:, i]) & np.isfinite(L[:, j])
            assert P["n"][i, j] == ok.sum()
            assert P["kappa"][i, j] == pytest.approx(S.cohens_kappa(L[:, i], L[:, j]))
            assert P["n10"][i, j] == np.sum((L[ok, i] == 1) & (L[ok, j] == 0))
            assert P["n11"][i, j] + P["n10"][i, j] + P["n01"][i, j] + P["n00"][i, j] == ok.sum()
