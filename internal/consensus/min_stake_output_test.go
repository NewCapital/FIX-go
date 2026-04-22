package consensus

import (
	"testing"

	"github.com/NewCapital/FIX-go/pkg/types"
	"github.com/sirupsen/logrus"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

// fakeSporkInactive is a minimal SporkInterface that reports every spork as
// inactive, simulating a fresh Go node that never received a spork broadcast.
type fakeSporkInactive struct{}

func (fakeSporkInactive) IsActive(int32) bool  { return false }
func (fakeSporkInactive) GetValue(int32) int64 { return 0 }

// buildLowVout1Block builds a minimal 2-tx PoS block whose coinstake vout[1]
// carries the supplied satoshi value (the rest of the tx fields are zeroed).
func buildLowVout1Block(vout1Value int64) *types.Block {
	coinbase := &types.Transaction{Version: 1}
	coinstake := &types.Transaction{
		Version: 1,
		Outputs: []*types.TxOutput{
			{Value: 0, ScriptPubKey: []byte{}},
			{Value: vout1Value, ScriptPubKey: []byte{0xac}},
		},
	}
	return &types.Block{
		Header:       &types.BlockHeader{Version: 4},
		Transactions: []*types.Transaction{coinbase, coinstake},
	}
}

// TestValidateMinStakeOutputMainnetForcedEnforcement reproduces the legacy
// CheckBlock() : stake under min. stake value rule in the Go validator on
// mainnet using a vout[1] value below FIX MinStakeAmount (100 FIX).
// Before the task m-enforce-stake-split-min-threshold fix the rule was
// spork-gated and a fresh Go node with SPORK_FIX_02_MIN_STAKE_AMOUNT OFF
// would silently accept blocks under the threshold. The fix makes mainnet
// enforcement unconditional past height 223000 regardless of spork state.
// Height 223000 matches legacy main.cpp:3969 and the
// legacy/src/chainparams.cpp:70 checkpoint "min stake enforcement".
func TestValidateMinStakeOutputMainnetForcedEnforcement(t *testing.T) {
	bv := createTestBlockValidator(t) // mainnet params
	// Spork manager absent / inactive: mainnet enforcement must still run.
	bv.SetSporkManager(fakeSporkInactive{})

	block := buildLowVout1Block(50 * 100000000)

	err := bv.validateMinStakeOutput(block, 223000)
	require.Error(t, err, "mainnet: vout[1] below MinStakeAmount must be rejected with or without spork")
	assert.Contains(t, err.Error(), "stake output value")

	// Boundary accept: vout[1] == MinStakeAmount is allowed.
	block.Transactions[1].Outputs[1].Value = int64(bv.params.MinStakeAmount)
	require.NoError(t, bv.validateMinStakeOutput(block, 223000))

	// Below the activation height the rule does not apply even on mainnet.
	block.Transactions[1].Outputs[1].Value = 50 * 100000000
	require.NoError(t, bv.validateMinStakeOutput(block, 222999),
		"mainnet below activation height: rule should not apply")
}

// TestValidateMinStakeOutputMainnetHeightBoundary is the dedicated off-by-one
// regression for the 223000 boundary. Guards against silent drift back to the
// previous (incorrect) 333500 constant. Matches legacy main.cpp:3969 which
// activates the rule at "nHeight >= 223000" on mainnet.
func TestValidateMinStakeOutputMainnetHeightBoundary(t *testing.T) {
	bv := createTestBlockValidator(t) // mainnet params
	bv.SetSporkManager(fakeSporkInactive{})

	// vout[1] below MinStakeAmount (50 FIX vs 100 FIX minimum).
	smallBlock := buildLowVout1Block(50 * 100000000)

	// Heights strictly below 223000 must NOT trigger the rule, even on
	// mainnet with a too-small vout[1]. Sample the boundary-1 height and
	// a much earlier height to ensure the rule really is gated.
	require.NoError(t, bv.validateMinStakeOutput(smallBlock, 222999),
		"height 222999 (just below gate): rule must not apply")
	require.NoError(t, bv.validateMinStakeOutput(smallBlock, 100000),
		"height 100000 (well before gate): rule must not apply")

	// Height exactly 223000 must trigger rejection (inclusive boundary).
	err := bv.validateMinStakeOutput(smallBlock, 223000)
	require.Error(t, err, "height 223000 (gate boundary, inclusive): rule must reject")
	assert.Contains(t, err.Error(), "stake output value")

	// Heights above the boundary must also reject.
	err = bv.validateMinStakeOutput(smallBlock, 1_487_789)
	require.Error(t, err, "height 1487789 (well above gate): rule must reject")
	assert.Contains(t, err.Error(), "stake output value")

	// Regression guard against the old 333500 constant: if the gate
	// regressed to 333500, heights in [223000, 333499] would silently
	// accept undersized vout[1]. Sample inside that window and require
	// rejection, directly catching a regression of the fix.
	err = bv.validateMinStakeOutput(smallBlock, 300000)
	require.Error(t, err, "height 300000 (inside the 223000-333499 divergence window): rule must reject")
	assert.Contains(t, err.Error(), "stake output value")
}

// TestValidateMinStakeOutputTestnetStillSporkGated guards against the
// consensus-divergence risk of forcing enforcement on networks where the
// spork was never activated. On testnet/regtest the rule must remain gated
// on SPORK_FIX_02_MIN_STAKE_AMOUNT, so a fresh node with the spork OFF
// (default) must NOT reject a coinstake with a small vout[1].
func TestValidateMinStakeOutputTestnetStillSporkGated(t *testing.T) {
	storage := NewMockStorage()
	params := types.TestnetParams()
	logger := logrus.New()
	pos := NewProofOfStake(storage, params, logger)
	bv := NewBlockValidator(pos, storage, params)
	bv.SetSporkManager(fakeSporkInactive{})

	block := buildLowVout1Block(50 * 100000000)

	// Testnet activation height per main.cpp:3969 is 192500.
	require.NoError(t, bv.validateMinStakeOutput(block, 192500),
		"testnet with spork OFF: rule must be skipped to match legacy testnet")

	// With spork active on testnet the rule engages and rejects the block.
	bv.SetSporkManager(fakeSporkAlwaysActive{})
	err := bv.validateMinStakeOutput(block, 192500)
	require.Error(t, err, "testnet with spork ON: rule must enforce")
	assert.Contains(t, err.Error(), "stake output value")
}

// fakeSporkAlwaysActive is a minimal SporkInterface that reports every spork
// as active. Used by the testnet test to verify spork-gated enforcement.
type fakeSporkAlwaysActive struct{}

func (fakeSporkAlwaysActive) IsActive(int32) bool  { return true }
func (fakeSporkAlwaysActive) GetValue(int32) int64 { return 0 }
