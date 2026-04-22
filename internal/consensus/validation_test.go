package consensus

import (
	"testing"

	"github.com/NewCapital/FIX-go/pkg/crypto"
	"github.com/NewCapital/FIX-go/pkg/types"
	"github.com/sirupsen/logrus"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

// createTestBlockValidator creates a BlockValidator for testing
func createTestBlockValidator(t *testing.T) *BlockValidator {
	storage := NewMockStorage()
	params := types.MainnetParams()
	logger := logrus.New()
	pos := NewProofOfStake(storage, params, logger)
	return NewBlockValidator(pos, storage, params)
}

// createSignedPoSBlock creates a PoS block with a valid signature
// The block has:
// - tx[0]: coinbase (empty inputs)
// - tx[1]: coinstake with P2PK output
func createSignedPoSBlock(t *testing.T, keyPair *crypto.KeyPair) *types.Block {
	// Create coinbase transaction (tx[0])
	coinbase := &types.Transaction{
		Version: 1,
		Inputs: []*types.TxInput{{
			PreviousOutput: types.Outpoint{Hash: types.ZeroHash, Index: 0xffffffff},
			ScriptSig:      []byte{0x04, 0xff, 0xff, 0x00, 0x1d}, // coinbase script
		}},
		Outputs: []*types.TxOutput{{
			Value:        0,            // PoS coinbase typically has 0 value
			ScriptPubKey: []byte{0x00}, // dummy
		}},
	}

	// Create coinstake transaction (tx[1])
	// First output is empty (marker), second output has the pubkey
	pubKeyBytes := keyPair.Public.CompressedBytes()

	// P2PK scriptPubKey: <pubkey_len> <pubkey> OP_CHECKSIG
	// For compressed pubkey: 0x21 (33) + pubkey + 0xAC (OP_CHECKSIG)
	scriptPubKey := make([]byte, 35)
	scriptPubKey[0] = 33 // length of compressed pubkey
	copy(scriptPubKey[1:34], pubKeyBytes)
	scriptPubKey[34] = 0xAC // OP_CHECKSIG

	coinstake := &types.Transaction{
		Version: 1,
		Inputs: []*types.TxInput{{
			PreviousOutput: types.Outpoint{Hash: types.Hash{0x01, 0x02, 0x03}, Index: 0},
			ScriptSig:      []byte{0x00}, // placeholder
		}},
		Outputs: []*types.TxOutput{
			{Value: 0, ScriptPubKey: []byte{}},              // Empty first output (coinstake marker)
			{Value: 1000000000, ScriptPubKey: scriptPubKey}, // Stake output with pubkey
		},
	}

	// Create block header
	header := &types.BlockHeader{
		Version:       4,
		PrevBlockHash: types.Hash{0x01},
		MerkleRoot:    types.Hash{0x02},
		Timestamp:     1600000000,
		Bits:          0x1d00ffff,
		Nonce:         12345,
	}

	block := &types.Block{
		Header:       header,
		Transactions: []*types.Transaction{coinbase, coinstake},
	}

	// Sign the block hash with the private key
	blockHash := block.Header.Hash()
	signature, err := keyPair.Private.Sign(blockHash[:])
	require.NoError(t, err, "Failed to sign block")

	// Convert signature to DER format for block
	block.Signature = signatureToDER(signature)

	return block
}

// signatureToDER converts a crypto.Signature to DER format
func signatureToDER(sig *crypto.Signature) []byte {
	// DER format: 0x30 [total-length] 0x02 [R-length] [R] 0x02 [S-length] [S]
	rBytes := sig.R.Bytes()
	sBytes := sig.S.Bytes()

	// Prepend 0x00 if high bit is set (to indicate positive number)
	if len(rBytes) > 0 && rBytes[0]&0x80 != 0 {
		rBytes = append([]byte{0x00}, rBytes...)
	}
	if len(sBytes) > 0 && sBytes[0]&0x80 != 0 {
		sBytes = append([]byte{0x00}, sBytes...)
	}

	// Build DER signature
	der := make([]byte, 0, 6+len(rBytes)+len(sBytes))
	der = append(der, 0x30)                            // SEQUENCE tag
	der = append(der, byte(4+len(rBytes)+len(sBytes))) // Total length
	der = append(der, 0x02)                            // INTEGER tag for R
	der = append(der, byte(len(rBytes)))               // R length
	der = append(der, rBytes...)                       // R value
	der = append(der, 0x02)                            // INTEGER tag for S
	der = append(der, byte(len(sBytes)))               // S length
	der = append(der, sBytes...)                       // S value

	return der
}

// TestValidateBlockSignature_PoWBlockEmptySignature tests that PoW blocks with empty signatures pass
func TestValidateBlockSignature_PoWBlockEmptySignature(t *testing.T) {
	bv := createTestBlockValidator(t)

	// Create a PoW block (only 1 transaction - coinbase)
	block := &types.Block{
		Header: &types.BlockHeader{
			Version:   4,
			Timestamp: 1600000000,
			Bits:      0x1d00ffff,
		},
		Transactions: []*types.Transaction{{
			Version: 1,
			Inputs:  []*types.TxInput{{PreviousOutput: types.Outpoint{Hash: types.ZeroHash, Index: 0xffffffff}}},
			Outputs: []*types.TxOutput{{Value: 5000000000}},
		}},
		Signature: []byte{}, // Empty signature for PoW
	}

	err := bv.validateBlockSignature(block)
	assert.NoError(t, err, "PoW block with empty signature should pass")
}

// TestValidateBlockSignature_PoWBlockNonEmptySignature tests that PoW blocks with non-empty signatures fail
func TestValidateBlockSignature_PoWBlockNonEmptySignature(t *testing.T) {
	bv := createTestBlockValidator(t)

	// Create a PoW block with a signature (should fail)
	block := &types.Block{
		Header: &types.BlockHeader{
			Version:   4,
			Timestamp: 1600000000,
			Bits:      0x1d00ffff,
		},
		Transactions: []*types.Transaction{{
			Version: 1,
			Inputs:  []*types.TxInput{{PreviousOutput: types.Outpoint{Hash: types.ZeroHash, Index: 0xffffffff}}},
			Outputs: []*types.TxOutput{{Value: 5000000000}},
		}},
		Signature: []byte{0x30, 0x44}, // Non-empty signature
	}

	err := bv.validateBlockSignature(block)
	assert.Error(t, err, "PoW block with non-empty signature should fail")
	assert.Contains(t, err.Error(), "PoW block must have empty signature")
}

// TestValidateBlockSignature_PoSBlockMissingSignature tests that PoS blocks without signatures fail
func TestValidateBlockSignature_PoSBlockMissingSignature(t *testing.T) {
	bv := createTestBlockValidator(t)

	// Create a PoS block without signature
	coinbase := &types.Transaction{
		Version: 1,
		Inputs:  []*types.TxInput{{PreviousOutput: types.Outpoint{Hash: types.ZeroHash, Index: 0xffffffff}}},
		Outputs: []*types.TxOutput{{Value: 0}},
	}
	coinstake := &types.Transaction{
		Version: 1,
		Inputs:  []*types.TxInput{{PreviousOutput: types.Outpoint{Hash: types.Hash{0x01}, Index: 0}}},
		Outputs: []*types.TxOutput{
			{Value: 0, ScriptPubKey: []byte{}},
			{Value: 1000000000, ScriptPubKey: []byte{0x21, 0x02}}, // incomplete but enough for test
		},
	}

	block := &types.Block{
		Header: &types.BlockHeader{
			Version:   4,
			Timestamp: 1600000000,
			Bits:      0x1d00ffff,
		},
		Transactions: []*types.Transaction{coinbase, coinstake},
		Signature:    []byte{}, // Missing signature
	}

	err := bv.validateBlockSignature(block)
	assert.Error(t, err, "PoS block without signature should fail")
	assert.Contains(t, err.Error(), "signature is missing")
}

// TestValidateBlockSignature_PoSBlockValidP2PK tests PoS block with valid P2PK signature
func TestValidateBlockSignature_PoSBlockValidP2PK(t *testing.T) {
	bv := createTestBlockValidator(t)

	// Generate a key pair
	keyPair, err := crypto.GenerateKeyPair()
	require.NoError(t, err, "Failed to generate key pair")

	// Create signed PoS block
	block := createSignedPoSBlock(t, keyPair)

	err = bv.validateBlockSignature(block)
	assert.NoError(t, err, "PoS block with valid P2PK signature should pass")
}

// TestValidateBlockSignature_PoSBlockInvalidSignature tests PoS block with corrupted signature
func TestValidateBlockSignature_PoSBlockInvalidSignature(t *testing.T) {
	bv := createTestBlockValidator(t)

	// Generate a key pair
	keyPair, err := crypto.GenerateKeyPair()
	require.NoError(t, err, "Failed to generate key pair")

	// Create signed PoS block
	block := createSignedPoSBlock(t, keyPair)

	// Corrupt the signature
	if len(block.Signature) > 10 {
		block.Signature[10] ^= 0xFF // Flip some bits
	}

	err = bv.validateBlockSignature(block)
	assert.Error(t, err, "PoS block with corrupted signature should fail")
	assert.Contains(t, err.Error(), "invalid block signature")
}

// TestValidateBlockSignature_PoSBlockWrongKey tests PoS block signed with wrong key
func TestValidateBlockSignature_PoSBlockWrongKey(t *testing.T) {
	bv := createTestBlockValidator(t)

	// Generate two different key pairs
	keyPair1, err := crypto.GenerateKeyPair()
	require.NoError(t, err, "Failed to generate key pair 1")

	keyPair2, err := crypto.GenerateKeyPair()
	require.NoError(t, err, "Failed to generate key pair 2")

	// Create block with keyPair1's pubkey but sign with keyPair2
	block := createSignedPoSBlock(t, keyPair1)

	// Re-sign with different key
	blockHash := block.Header.Hash()
	wrongSig, err := keyPair2.Private.Sign(blockHash[:])
	require.NoError(t, err, "Failed to sign with wrong key")
	block.Signature = signatureToDER(wrongSig)

	err = bv.validateBlockSignature(block)
	assert.Error(t, err, "PoS block signed with wrong key should fail")
	assert.Contains(t, err.Error(), "invalid block signature")
}

// TestValidateBlockSignature_PoSBlockInsufficientOutputs tests PoS block with missing outputs
func TestValidateBlockSignature_PoSBlockInsufficientOutputs(t *testing.T) {
	bv := createTestBlockValidator(t)

	// Create a PoS block with coinstake that has only 1 output
	coinbase := &types.Transaction{
		Version: 1,
		Inputs:  []*types.TxInput{{PreviousOutput: types.Outpoint{Hash: types.ZeroHash, Index: 0xffffffff}}},
		Outputs: []*types.TxOutput{{Value: 0}},
	}
	coinstake := &types.Transaction{
		Version: 1,
		Inputs:  []*types.TxInput{{PreviousOutput: types.Outpoint{Hash: types.Hash{0x01}, Index: 0}}},
		Outputs: []*types.TxOutput{
			{Value: 0, ScriptPubKey: []byte{}}, // Only one output
		},
	}

	block := &types.Block{
		Header: &types.BlockHeader{
			Version:   4,
			Timestamp: 1600000000,
			Bits:      0x1d00ffff,
		},
		Transactions: []*types.Transaction{coinbase, coinstake},
		Signature:    []byte{0x30, 0x44, 0x02, 0x20}, // Some signature bytes
	}

	err := bv.validateBlockSignature(block)
	assert.Error(t, err, "PoS block with insufficient coinstake outputs should fail")
	assert.Contains(t, err.Error(), "at least 2 outputs")
}

// TestValidateBlockSignature_PoSBlockUncompressedPubKey tests P2PK with uncompressed pubkey
func TestValidateBlockSignature_PoSBlockUncompressedPubKey(t *testing.T) {
	bv := createTestBlockValidator(t)

	// Generate a key pair
	keyPair, err := crypto.GenerateKeyPair()
	require.NoError(t, err, "Failed to generate key pair")

	// Create coinbase
	coinbase := &types.Transaction{
		Version: 1,
		Inputs:  []*types.TxInput{{PreviousOutput: types.Outpoint{Hash: types.ZeroHash, Index: 0xffffffff}}},
		Outputs: []*types.TxOutput{{Value: 0}},
	}

	// Use uncompressed pubkey (65 bytes)
	pubKeyBytes := keyPair.Public.Bytes() // Uncompressed

	// P2PK scriptPubKey with uncompressed key: 0x41 (65) + pubkey + 0xAC
	scriptPubKey := make([]byte, 67)
	scriptPubKey[0] = 65 // length of uncompressed pubkey
	copy(scriptPubKey[1:66], pubKeyBytes)
	scriptPubKey[66] = 0xAC // OP_CHECKSIG

	coinstake := &types.Transaction{
		Version: 1,
		Inputs:  []*types.TxInput{{PreviousOutput: types.Outpoint{Hash: types.Hash{0x01}, Index: 0}}},
		Outputs: []*types.TxOutput{
			{Value: 0, ScriptPubKey: []byte{}},
			{Value: 1000000000, ScriptPubKey: scriptPubKey},
		},
	}

	header := &types.BlockHeader{
		Version:   4,
		Timestamp: 1600000000,
		Bits:      0x1d00ffff,
	}

	block := &types.Block{
		Header:       header,
		Transactions: []*types.Transaction{coinbase, coinstake},
	}

	// Sign the block
	blockHash := block.Header.Hash()
	signature, err := keyPair.Private.Sign(blockHash[:])
	require.NoError(t, err, "Failed to sign block")
	block.Signature = signatureToDER(signature)

	err = bv.validateBlockSignature(block)
	assert.NoError(t, err, "PoS block with valid uncompressed P2PK signature should pass")
}

// TestValidateBlockSignature_PoSBlockValidP2PKH tests PoS block with valid P2PKH signature
func TestValidateBlockSignature_PoSBlockValidP2PKH(t *testing.T) {
	bv := createTestBlockValidator(t)

	// Generate a key pair
	keyPair, err := crypto.GenerateKeyPair()
	require.NoError(t, err, "Failed to generate key pair")

	// Create coinbase
	coinbase := &types.Transaction{
		Version: 1,
		Inputs:  []*types.TxInput{{PreviousOutput: types.Outpoint{Hash: types.ZeroHash, Index: 0xffffffff}}},
		Outputs: []*types.TxOutput{{Value: 0}},
	}

	// Create P2PKH scriptPubKey: OP_DUP OP_HASH160 <20-byte-hash> OP_EQUALVERIFY OP_CHECKSIG
	pubKeyBytes := keyPair.Public.CompressedBytes()
	pubKeyHash := crypto.Hash160(pubKeyBytes)

	scriptPubKey := make([]byte, 25)
	scriptPubKey[0] = 0x76 // OP_DUP
	scriptPubKey[1] = 0xA9 // OP_HASH160
	scriptPubKey[2] = 0x14 // Push 20 bytes
	copy(scriptPubKey[3:23], pubKeyHash)
	scriptPubKey[23] = 0x88 // OP_EQUALVERIFY
	scriptPubKey[24] = 0xAC // OP_CHECKSIG

	// Create scriptSig containing signature + pubkey (for P2PKH)
	// Format: <sig_len> <sig> <pubkey_len> <pubkey>
	// The extractPubKeyFromScriptSig expects 2 elements: first is sig, second is pubkey
	// Use a dummy signature (71 bytes is typical DER sig length)
	dummySig := make([]byte, 71)
	for i := range dummySig {
		dummySig[i] = byte(i)
	}

	// Build scriptSig: <71> <71-byte-dummy-sig> <33> <33-byte-pubkey>
	scriptSig := make([]byte, 0, 1+71+1+33)
	scriptSig = append(scriptSig, 71)             // Push 71 bytes (sig)
	scriptSig = append(scriptSig, dummySig...)    // Dummy signature
	scriptSig = append(scriptSig, 33)             // Push 33 bytes (pubkey)
	scriptSig = append(scriptSig, pubKeyBytes...) // Actual pubkey

	coinstake := &types.Transaction{
		Version: 1,
		Inputs: []*types.TxInput{{
			PreviousOutput: types.Outpoint{Hash: types.Hash{0x01}, Index: 0},
			ScriptSig:      scriptSig,
		}},
		Outputs: []*types.TxOutput{
			{Value: 0, ScriptPubKey: []byte{}},
			{Value: 1000000000, ScriptPubKey: scriptPubKey},
		},
	}

	header := &types.BlockHeader{
		Version:   4,
		Timestamp: 1600000000,
		Bits:      0x1d00ffff,
	}

	block := &types.Block{
		Header:       header,
		Transactions: []*types.Transaction{coinbase, coinstake},
	}

	// Sign the block
	blockHash := block.Header.Hash()
	signature, err := keyPair.Private.Sign(blockHash[:])
	require.NoError(t, err, "Failed to sign block")
	block.Signature = signatureToDER(signature)

	err = bv.validateBlockSignature(block)
	assert.Error(t, err, "PoS block with P2PKH coinstake should be rejected (legacy compliance: must use P2PK)")
	assert.Contains(t, err.Error(), "P2PKH coinstake outputs not supported")
}

// TestValidateBlockSignature_UnsupportedScriptFormat tests unsupported scriptPubKey format
func TestValidateBlockSignature_UnsupportedScriptFormat(t *testing.T) {
	bv := createTestBlockValidator(t)

	// Create a PoS block with unsupported scriptPubKey format
	coinbase := &types.Transaction{
		Version: 1,
		Inputs:  []*types.TxInput{{PreviousOutput: types.Outpoint{Hash: types.ZeroHash, Index: 0xffffffff}}},
		Outputs: []*types.TxOutput{{Value: 0}},
	}

	// Create invalid scriptPubKey (not P2PK, not P2PKH)
	invalidScript := []byte{0x00, 0x14, 0x01, 0x02, 0x03, 0x04} // Some random bytes

	coinstake := &types.Transaction{
		Version: 1,
		Inputs:  []*types.TxInput{{PreviousOutput: types.Outpoint{Hash: types.Hash{0x01}, Index: 0}}},
		Outputs: []*types.TxOutput{
			{Value: 0, ScriptPubKey: []byte{}},
			{Value: 1000000000, ScriptPubKey: invalidScript},
		},
	}

	block := &types.Block{
		Header: &types.BlockHeader{
			Version:   4,
			Timestamp: 1600000000,
			Bits:      0x1d00ffff,
		},
		Transactions: []*types.Transaction{coinbase, coinstake},
		Signature:    []byte{0x30, 0x44, 0x02, 0x20}, // Some signature bytes
	}

	err := bv.validateBlockSignature(block)
	assert.Error(t, err, "PoS block with unsupported scriptPubKey should fail")
	assert.Contains(t, err.Error(), "unsupported scriptPubKey format")
}

// buildPoSBlockForTarget constructs a minimal PoS block with the given header.
// IsProofOfStake requires 2 transactions with tx[1] being a coinstake.
func buildPoSBlockForTarget(t *testing.T, header *types.BlockHeader) *types.Block {
	t.Helper()
	coinbase := &types.Transaction{
		Version: 1,
		Inputs: []*types.TxInput{{
			PreviousOutput: types.Outpoint{Hash: types.ZeroHash, Index: 0xffffffff},
			ScriptSig:      []byte{0x00},
		}},
		Outputs: []*types.TxOutput{{Value: 0, ScriptPubKey: []byte{0x00}}},
	}
	coinstake := &types.Transaction{
		Version: 1,
		Inputs: []*types.TxInput{{
			PreviousOutput: types.Outpoint{Hash: types.Hash{0xaa}, Index: 0},
			ScriptSig:      []byte{0x00},
		}},
		Outputs: []*types.TxOutput{
			{Value: 0, ScriptPubKey: []byte{}},
			{Value: 1000000000, ScriptPubKey: []byte{0x21, 0x02}},
		},
	}
	block := &types.Block{
		Header:       header,
		Transactions: []*types.Transaction{coinbase, coinstake},
	}
	// Sanity check: tolerance branch is only exercised for PoS blocks; if
	// IsProofOfStake ever tightens its definition, failing loudly here is
	// preferable to silent test vacuity.
	require.True(t, block.IsProofOfStake(), "fixture must produce a PoS block")
	return block
}

// setupEmergencyToleranceFixture wires a BlockValidator with prev and prev-prev
// blocks around the legacy emergency activation height and returns the validator,
// the pre-computed expected bits for the block at currentHeight, and the prev hash
// so tests can craft the current header.
func setupEmergencyToleranceFixture(t *testing.T, currentHeight uint32, prevBits uint32, prevTs, prevPrevTs uint32) (*BlockValidator, uint32, types.Hash) {
	t.Helper()

	storage := NewMockStorage()
	params := types.MainnetParams()
	logger := logrus.New()
	pos := NewProofOfStake(storage, params, logger)
	bv := NewBlockValidator(pos, storage, params)

	// prev-prev block (needed by CalculateNextTarget for nActualSpacing).
	prevPrev := &types.Block{Header: &types.BlockHeader{
		Version:   4,
		Timestamp: prevPrevTs,
		Bits:      prevBits,
	}}
	require.NoError(t, storage.StoreBlockWithHeight(prevPrev, currentHeight-2))

	// prev block.
	prev := &types.Block{Header: &types.BlockHeader{
		Version:       4,
		PrevBlockHash: prevPrev.Header.Hash(),
		Timestamp:     prevTs,
		Bits:          prevBits,
	}}
	require.NoError(t, storage.StoreBlockWithHeight(prev, currentHeight-1))

	mockBC := NewMockBlockchain(storage)
	mockBC.blocks[prev.Header.Hash()] = prev
	mockBC.blocksByHeight[currentHeight-1] = prev
	mockBC.blocks[prevPrev.Header.Hash()] = prevPrev
	mockBC.blocksByHeight[currentHeight-2] = prevPrev
	pos.SetBlockchain(mockBC)

	// Compute expected bits the same way validation.go will.
	expectedBits, err := pos.CalculateNextWorkRequired(&types.BlockHeader{
		PrevBlockHash: prev.Header.Hash(),
		Timestamp:     prevTs + uint32(2*TargetSpacingSeconds*EmergencyDifficultyDelayFactor),
	}, currentHeight)
	require.NoError(t, err)

	return bv, expectedBits, prev.Header.Hash()
}

// TestValidateTarget_EmergencyToleranceAcceptsEasierBlock verifies that a PoS
// block at the legacy emergency-activation height with a gap exceeding the
// emergency threshold is accepted when its target is at least as easy as the
// computed emergency target (bnActual >= bnRequired). Mirrors legacy
// CheckWork tolerance at legacy/src/main.cpp:4080-4097.
func TestValidateTarget_EmergencyToleranceAcceptsEasierBlock(t *testing.T) {
	currentHeight := uint32(EmergencyDifficultyStartPrevHeight + 1) // 1487458
	prevTs := uint32(1_700_000_000)
	prevPrevTs := prevTs - uint32(TargetSpacingSeconds)            // normal spacing
	gap := uint32(2 * TargetSpacingSeconds * EmergencyDifficultyDelayFactor) // well above threshold
	curTs := prevTs + gap

	bv, expectedBits, prevHash := setupEmergencyToleranceFixture(t, currentHeight, 0x1d004000, prevTs, prevPrevTs)

	// Craft an "easier" actual target by raising it past the expected target but
	// still within MaxTargetPoS. MaxTargetPoS compact = 0x1e00ffff is always
	// the easiest allowed value; if expected is below it, using MaxTargetPoS
	// bits yields actualTarget >= expectedTarget.
	actualBits := uint32(0x1e00ffff)
	require.Less(t, GetTargetFromBits(expectedBits).Cmp(GetTargetFromBits(actualBits)), 1,
		"expected target must be <= MaxTargetPoS for this test to exercise tolerance")

	block := buildPoSBlockForTarget(t, &types.BlockHeader{
		Version:       4,
		PrevBlockHash: prevHash,
		Timestamp:     curTs,
		Bits:          actualBits,
	})

	err := bv.ValidateTarget(block, currentHeight)
	assert.NoError(t, err, "tolerance path should accept easier-than-required block")
}

// TestValidateTarget_EmergencyToleranceRejectsHarderBlock verifies that when the
// block's actual target is harder than the computed emergency target AND does
// not match the unpatched-miner ppcoin expected value, validation rejects.
func TestValidateTarget_EmergencyToleranceRejectsHarderBlock(t *testing.T) {
	currentHeight := uint32(EmergencyDifficultyStartPrevHeight + 1)
	prevTs := uint32(1_700_000_000)
	prevPrevTs := prevTs - uint32(TargetSpacingSeconds)
	gap := uint32(2 * TargetSpacingSeconds * EmergencyDifficultyDelayFactor)
	curTs := prevTs + gap

	bv, expectedBits, prevHash := setupEmergencyToleranceFixture(t, currentHeight, 0x1d004000, prevTs, prevPrevTs)

	// Craft a "harder" actual target with bits unlikely to match any expected
	// computation (neither emergency nor ppcoin). 0x1b000fff is three exponent
	// steps below the expected emergency result and well below plain ppcoin
	// result for the same prev.
	actualBits := uint32(0x1b000fff)
	require.Greater(t, GetTargetFromBits(expectedBits).Cmp(GetTargetFromBits(actualBits)), 0,
		"expected target must be > actual (harder) for this test to exercise strict rejection")

	block := buildPoSBlockForTarget(t, &types.BlockHeader{
		Version:       4,
		PrevBlockHash: prevHash,
		Timestamp:     curTs,
		Bits:          actualBits,
	})

	err := bv.ValidateTarget(block, currentHeight)
	require.Error(t, err, "strict check must reject harder-than-required block after tolerance fails")
	assert.Contains(t, err.Error(), "difficulty target mismatch")
}

// TestValidateTarget_EmergencyToleranceAcceptsUnpatchedPpcoinBlock verifies the
// dual-acceptance path for blocks mined by unpatched legacy nodes during the
// emergency window. Such blocks carry plain ppcoin bits even though the
// patched algorithm would have returned the emergency (MaxTargetPoS) cap.
// Corresponds to the real-world block 1487458 on FIX mainnet.
func TestValidateTarget_EmergencyToleranceAcceptsUnpatchedPpcoinBlock(t *testing.T) {
	currentHeight := uint32(EmergencyDifficultyStartPrevHeight + 1) // 1487458
	prevTs := uint32(1_700_000_000)
	prevPrevTs := prevTs - uint32(TargetSpacingSeconds)
	gap := uint32(2 * TargetSpacingSeconds * EmergencyDifficultyDelayFactor)
	curTs := prevTs + gap

	bv, expectedBits, prevHash := setupEmergencyToleranceFixture(t, currentHeight, 0x1d004000, prevTs, prevPrevTs)

	// Compute the no-emergency ppcoin bits the validator will compare against.
	ppcoinBits, err := bv.pos.CalculateNextWorkRequiredNoEmergency(&types.BlockHeader{
		PrevBlockHash: prevHash,
		Timestamp:     curTs,
	}, currentHeight)
	require.NoError(t, err)
	require.NotEqual(t, expectedBits, ppcoinBits,
		"emergency and ppcoin bits must differ for this test to exercise the unpatched path")

	block := buildPoSBlockForTarget(t, &types.BlockHeader{
		Version:       4,
		PrevBlockHash: prevHash,
		Timestamp:     curTs,
		Bits:          ppcoinBits,
	})

	err = bv.ValidateTarget(block, currentHeight)
	assert.NoError(t, err, "unpatched ppcoin block must be accepted during emergency window")
}

// TestValidateTarget_EmergencyToleranceInactiveBelowActivationHeight verifies
// that the tolerance branch does not apply for PoS blocks before the legacy
// emergency-activation height and the strict nBits check is enforced.
func TestValidateTarget_EmergencyToleranceInactiveBelowActivationHeight(t *testing.T) {
	currentHeight := uint32(EmergencyDifficultyStartPrevHeight) // 1487457 -> prevHeight = 1487456, below activation
	prevTs := uint32(1_700_000_000)
	prevPrevTs := prevTs - uint32(TargetSpacingSeconds)
	gap := uint32(2 * TargetSpacingSeconds * EmergencyDifficultyDelayFactor)
	curTs := prevTs + gap

	bv, _, prevHash := setupEmergencyToleranceFixture(t, currentHeight, 0x1d004000, prevTs, prevPrevTs)

	// Pick bits unlikely to match the computed expected bits to force the strict
	// path. MaxTargetPoS compact is the easy extreme; if it happens to match
	// expected the test would falsely pass, but setup prev bits are intentionally
	// hard (0x1d004000) so expected will not be 0x1e00ffff here.
	actualBits := uint32(0x1e00ffff)

	block := buildPoSBlockForTarget(t, &types.BlockHeader{
		Version:       4,
		PrevBlockHash: prevHash,
		Timestamp:     curTs,
		Bits:          actualBits,
	})

	err := bv.ValidateTarget(block, currentHeight)
	require.Error(t, err, "tolerance must NOT apply below activation height; strict check must reject")
	assert.Contains(t, err.Error(), "difficulty target mismatch")
}
