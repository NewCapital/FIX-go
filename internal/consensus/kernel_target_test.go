package consensus

import (
	"encoding/hex"
	"math/big"
	"testing"

	"github.com/NewCapital/FIX-go/pkg/types"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

// legacyStakeTargetHitReference is a reference implementation mirroring legacy
// kernel.cpp:286-293 stakeTargetHit + uint256.cpp:76-89 operator*= exactly.
// Used by the cross-check test to verify StakeTargetHit matches legacy
// (a*b) mod 2^256 semantics.
//
// Legacy code:
//
//	uint256 bnCoinDayWeight = uint256(nValueIn) / 100;
//	return hashProofOfStake < (bnCoinDayWeight * bnTargetPerCoinDay);
//
// The multiplication silently truncates to 256 bits.
func legacyStakeTargetHitReference(kernelHash types.Hash, nValueIn int64, target *big.Int) bool {
	if nValueIn <= 0 || target == nil || target.Sign() <= 0 {
		return false
	}
	// weight = nValueIn / 100 (integer division, matches legacy)
	weight := big.NewInt(nValueIn / 100)
	if weight.Sign() <= 0 {
		return false
	}
	// effectiveTarget = (weight * target) mod 2^256 -- legacy uint256 wrap
	effective := new(big.Int).Mul(weight, target)
	mask := new(big.Int).Lsh(big.NewInt(1), 256)
	effective.Mod(effective, mask)

	// hash in the same numerical representation as legacy uint256 (reversed bytes)
	reversed := kernelHash.Reverse()
	hashVal := new(big.Int).SetBytes(reversed[:])

	return hashVal.Cmp(effective) < 0
}

// hashFromHex decodes a big-endian hex string to types.Hash. The input is the
// hex as printed in logs (e.g. Go's staking_worker kernel_hash). types.Hash
// stores bytes in the same order as SHA-256 output, so hex[0..1] becomes
// kernelHash[0].
func hashFromHex(t *testing.T, s string) types.Hash {
	t.Helper()
	b, err := hex.DecodeString(s)
	require.NoError(t, err)
	require.Len(t, b, 32)
	var h types.Hash
	copy(h[:], b)
	return h
}

// TestStakeTargetHit_LegacyOverflowReproducedCase1 pins the live reproducer
// captured at mainnet height 1,487,789/1,487,792 on 2026-04-16. A Go-staked
// block with this exact kernel hash and block-header bits was accepted by the
// Go validator but rejected by legacy peers with
// "CheckProofOfStake() : INFO: check kernel failed". Before the uint256 mod fix
// Go computed the exact product target*weight and the comparison accepted the
// block; after the fix Go must apply mod 2^256 and reject the same kernel,
// matching legacy.
//
// Live evidence:
//
//	kernel_hash=d5b10897750837f1b8683b2112ce61fd006cb7bd4026bdd267790db7936f60d8
//	block header bits = 0x1d05f676 (difficulty ~0.168)
//	vout[1] = 39086.1 FIX (stake-return ≈ staker reward of 10 FIX + stake input)
//	Plausible nValueIn (satoshis) ≈ (vout[1] - 10 FIX) * 1e8 = 3907610000000
//
// Reference: team-management/tasks/done/?-research-stake-target-comparison-divergence.md
func TestStakeTargetHit_LegacyOverflowReproducedCase1(t *testing.T) {
	kernelHash := hashFromHex(t, "d5b10897750837f1b8683b2112ce61fd006cb7bd4026bdd267790db7936f60d8")
	target := GetTargetFromBits(0x1d05f676)
	require.NotNil(t, target)
	require.Greater(t, target.Sign(), 0)

	// Bracket plausible nValueIn values around vout[1]=39086.10 FIX.
	// Staker reward in FIX PoS coinstake split is small (~10 FIX for block
	// reward of 100 FIX), so real nValueIn is close to vout[1].
	const satPerFIX int64 = 100_000_000
	cases := []struct {
		label     string
		nValueIn  int64 // satoshis
		weightOut int64 // expected weight = nValueIn / 100
	}{
		{"vout1 as-is (39086.10 FIX)", 39086_10_000_000, 39086_100_000},
		{"minus 1 FIX (39085.10 FIX)", 39085_10_000_000, 39085_100_000},
		{"minus 10 FIX (39076.10 FIX)", 39076_10_000_000, 39076_100_000},
		{"minus 90 FIX (38996.10 FIX)", 38996_10_000_000, 38996_100_000},
		{"minus 100 FIX (38986.10 FIX)", 38986_10_000_000, 38986_100_000},
	}

	for _, tc := range cases {
		t.Run(tc.label, func(t *testing.T) {
			require.Equal(t, tc.weightOut, tc.nValueIn/100, "sanity: weight derivation")

			// Under the legacy (mod 2^256) semantics -- which the fix enforces --
			// this kernel hash DOES NOT satisfy the target. Go must reject.
			got := StakeTargetHit(kernelHash, tc.nValueIn/100, target)
			assert.False(t, got,
				"Case 1 reproducer: legacy rejects this kernel, Go must also reject after the mod-2^256 fix. "+
					"If this assertion fails (got=true), Go has regressed to the pre-fix overflow bug "+
					"from task ?-research-stake-target-comparison-divergence.")

			// Cross-check that the exact-arithmetic formula -- which is what Go
			// used BEFORE the fix -- would have accepted this kernel. This
			// documents the divergence that the fix closes.
			exactProduct := new(big.Int).Mul(target, big.NewInt(tc.nValueIn/100))
			reversed := kernelHash.Reverse()
			hashVal := new(big.Int).SetBytes(reversed[:])
			preFixWouldAccept := hashVal.Cmp(exactProduct) < 0
			assert.True(t, preFixWouldAccept,
				"Case 1 divergence: exact-product comparison (the old Go behaviour) accepts this kernel "+
					"while legacy's uint256-wrap comparison rejects. This is the Go-only divergence the fix closes.")

			// Also cross-check against the reference legacy implementation.
			legacy := legacyStakeTargetHitReference(kernelHash, tc.nValueIn, target)
			assert.Equal(t, got, legacy,
				"StakeTargetHit must match legacy reference implementation exactly")
		})
	}
}

// TestStakeTargetHit_256BitBoundary picks target and stakeWeight such that the
// exact product straddles the 2^256 boundary, and verifies the fixed
// StakeTargetHit produces the same result as a hand-computed
// (target * weight) mod 2^256 comparison. This guards the mod-2^256 semantics
// directly.
func TestStakeTargetHit_256BitBoundary(t *testing.T) {
	// target slightly below 2^255
	target := new(big.Int).Lsh(big.NewInt(1), 255) // 2^255
	// weight = 3 pushes product to 3*2^255 = 2^256 + 2^255, which wraps to 2^255 under mod 2^256.
	stakeWeight := int64(3)

	exactProduct := new(big.Int).Mul(target, big.NewInt(stakeWeight))
	require.True(t, exactProduct.BitLen() > 256, "test setup: exact product must exceed 2^256")

	mask := new(big.Int).Lsh(big.NewInt(1), 256)
	wrapped := new(big.Int).Mod(exactProduct, mask)
	require.LessOrEqual(t, wrapped.BitLen(), 256, "test setup: wrapped product must fit in 256 bits")

	// Case A: kernel hash numerically just below the wrapped product -> should accept under both
	// legacy and fixed semantics.
	hashBelow := new(big.Int).Sub(wrapped, big.NewInt(1))
	hashBelowTypesHash := bigIntToReversedHash(t, hashBelow)
	acceptedBelow := StakeTargetHit(hashBelowTypesHash, stakeWeight, target)
	assert.True(t, acceptedBelow,
		"hash just below wrapped product must be accepted (after mod 2^256)")

	// Case B: kernel hash numerically above wrapped product but below exact product ->
	// legacy rejects (wrap), pre-fix Go accepts (exact). Fixed Go must reject.
	hashBetween := new(big.Int).Add(wrapped, new(big.Int).Lsh(big.NewInt(1), 250))
	require.Less(t, hashBetween.Cmp(exactProduct), 0, "test setup: hashBetween must be < exact product")
	require.Greater(t, hashBetween.Cmp(wrapped), 0, "test setup: hashBetween must be > wrapped product")
	require.Less(t, hashBetween.BitLen(), 257, "test setup: hashBetween must fit in 256 bits")

	hashBetweenTypesHash := bigIntToReversedHash(t, hashBetween)
	acceptedBetween := StakeTargetHit(hashBetweenTypesHash, stakeWeight, target)
	assert.False(t, acceptedBetween,
		"hash in divergence range (above wrapped, below exact product) must be rejected to match legacy")
}

// TestStakeTargetHit_MatchesLegacyUint256Wrap cross-checks the fixed
// StakeTargetHit against the reference legacy implementation across a table
// of (nValueIn, target, kernelHash) tuples including edge cases.
func TestStakeTargetHit_MatchesLegacyUint256Wrap(t *testing.T) {
	// Build a selection of targets from different compact-bits values that are
	// relevant to FIX mainnet (easier) and some harder edge cases.
	targetEasyPoS := GetTargetFromBits(0x1e00ffff) // PoS limit: easiest possible
	targetLivePoS := GetTargetFromBits(0x1d05f676) // live mainnet difficulty at time of bug
	targetHard := GetTargetFromBits(0x1b000fff)    // harder target (small product)
	require.NotNil(t, targetEasyPoS)
	require.NotNil(t, targetLivePoS)
	require.NotNil(t, targetHard)

	// Range of plausible nValueIn (in satoshis).
	nValueIns := []int64{
		100 * 100_000_000,       // 100 FIX (min stake)
		1000 * 100_000_000,      // 1K FIX
		39_086 * 100_000_000,    // live case 1
		100_000 * 100_000_000,   // split threshold
		1_000_000 * 100_000_000, // 1M FIX (max tier)
	}

	// Varied kernel hashes. Live cases plus a couple of boundary values.
	kernelHashes := []types.Hash{
		hashFromHex(t, "d5b10897750837f1b8683b2112ce61fd006cb7bd4026bdd267790db7936f60d8"),
		hashFromHex(t, "648ec567ea61a0d5a844f6529c66363a47ec9ae0a8606d929c3d363180f0f418"),
		hashFromHex(t, "0000000000000000000000000000000000000000000000000000000000000001"), // tiny hash
		hashFromHex(t, "ffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff"), // max hash
		hashFromHex(t, "8000000000000000000000000000000000000000000000000000000000000000"), // mid
	}

	targets := map[string]*big.Int{
		"PoS-limit":  targetEasyPoS,
		"live-bits":  targetLivePoS,
		"hard-bits":  targetHard,
		"target=1":   big.NewInt(1),
		"target=max": new(big.Int).Sub(new(big.Int).Lsh(big.NewInt(1), 256), big.NewInt(1)),
	}

	total := 0
	for tname, target := range targets {
		for _, nv := range nValueIns {
			for i, kh := range kernelHashes {
				got := StakeTargetHit(kh, nv/100, target)
				want := legacyStakeTargetHitReference(kh, nv, target)
				assert.Equal(t, want, got,
					"mismatch for target=%s nValueIn=%d hash_idx=%d: want %v got %v",
					tname, nv, i, want, got)
				total++
			}
		}
	}
	require.GreaterOrEqual(t, total, 10, "coverage check: at least 10 combinations")
}

// TestStakeTargetHit_RejectsInvalidInputs keeps the existing validator contract
// explicit: zero/negative weight, nil target, and zero target all reject.
func TestStakeTargetHit_RejectsInvalidInputs(t *testing.T) {
	kernelHash := hashFromHex(t, "0000000000000000000000000000000000000000000000000000000000000001")
	target := GetTargetFromBits(0x1d05f676)

	assert.False(t, StakeTargetHit(kernelHash, 0, target), "weight=0 must reject")
	assert.False(t, StakeTargetHit(kernelHash, -1, target), "negative weight must reject")
	assert.False(t, StakeTargetHit(kernelHash, 1_000_000, nil), "nil target must reject")
	assert.False(t, StakeTargetHit(kernelHash, 1_000_000, big.NewInt(0)), "zero target must reject")
	assert.False(t, StakeTargetHit(kernelHash, 1_000_000, big.NewInt(-1)), "negative target must reject")
}

// bigIntToReversedHash converts a big.Int numerical value into the types.Hash
// representation that StakeTargetHit expects, inverting the Reverse() applied
// inside StakeTargetHit. Returns the 32-byte Hash such that SetBytes of its
// reversed bytes reproduces the input big.Int.
func bigIntToReversedHash(t *testing.T, n *big.Int) types.Hash {
	t.Helper()
	require.GreaterOrEqual(t, n.Sign(), 0, "negative input not representable")
	require.LessOrEqual(t, n.BitLen(), 256, "input exceeds 256 bits")
	b := n.Bytes()
	// Pad to 32 bytes (big-endian, high zeros)
	paddedBE := make([]byte, 32)
	copy(paddedBE[32-len(b):], b)
	// types.Hash after Reverse() should equal paddedBE, so types.Hash itself is
	// the reversal of paddedBE.
	var h types.Hash
	for i := 0; i < 32; i++ {
		h[i] = paddedBE[31-i]
	}
	return h
}
