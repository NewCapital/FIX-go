package consensus

import (
	"fmt"
	"math/big"
	"testing"

	"github.com/NewCapital/FIX-go/pkg/types"
)

func TestMaxTargetPoWConversion(t *testing.T) {
	bits := GetBitsFromTarget(MaxTargetPoW)
	fmt.Printf("MaxTargetPoW converts to bits: 0x%x\n", bits)

	// Convert back
	target := GetTargetFromBits(bits)
	fmt.Printf("MaxTargetPoW: %x\n", MaxTargetPoW.Bytes())
	fmt.Printf("Converted back: %x\n", target.Bytes())

	// Test specific values
	bits1e := uint32(0x1e0fffff)
	bits1f := uint32(0x1f00ffff)

	target1e := GetTargetFromBits(bits1e)
	target1f := GetTargetFromBits(bits1f)

	fmt.Printf("0x1e0fffff -> target: %x\n", target1e.Bytes())
	fmt.Printf("0x1f00ffff -> target: %x\n", target1f.Bytes())

	// Test genesis bits
	genesisTarget := GetTargetFromBits(0x1e0ffff0)
	fmt.Printf("Genesis 0x1e0ffff0 -> target: %x\n", genesisTarget.Bytes())
}

func TestMaxTargetPoSConversion(t *testing.T) {
	bits := GetBitsFromTarget(MaxTargetPoS)
	if bits != 0x1e00ffff {
		t.Fatalf("MaxTargetPoS compact mismatch: got 0x%08x, want 0x1e00ffff", bits)
	}

	legacyLimit := new(big.Int).Rsh(new(big.Int).Sub(new(big.Int).Lsh(big.NewInt(1), 256), big.NewInt(1)), 24)
	if MaxTargetPoS.Cmp(legacyLimit) != 0 {
		t.Fatalf("MaxTargetPoS value mismatch: got %x, want %x", MaxTargetPoS, legacyLimit)
	}
}

func TestCalculateNextTargetCapsAtLegacyPoSLimit(t *testing.T) {
	storage := NewMockStorage()
	prevPrev := &types.Block{Header: &types.BlockHeader{
		Timestamp: 1000,
		Bits:      0x1e01e80f,
	}}
	if err := storage.StoreBlockWithHeight(prevPrev, 1487458); err != nil {
		t.Fatalf("failed to store prev-prev block: %v", err)
	}

	prev := &types.BlockHeader{
		Timestamp: 1120,
		Bits:      0x1e01e80f,
	}
	current := &types.BlockHeader{
		Timestamp: 1240,
	}

	calculator := NewTargetCalculator(types.MainnetParams(), nil, storage, nil)
	target, err := calculator.CalculateNextTarget(prev, current, 1487460)
	if err != nil {
		t.Fatalf("CalculateNextTarget failed: %v", err)
	}

	if bits := GetBitsFromTarget(target); bits != 0x1e00ffff {
		t.Fatalf("target was not capped at legacy PoS limit: got 0x%08x, want 0x1e00ffff", bits)
	}
}

func TestCalculateNextTargetEmergencyDifficultyDrop(t *testing.T) {
	prev := &types.BlockHeader{
		Timestamp: 1000,
		Bits:      0x1d004000,
	}
	current := &types.BlockHeader{
		Timestamp: 1000 + 2*TargetSpacingSeconds*EmergencyDifficultyDelayFactor,
	}

	calculator := NewTargetCalculator(types.MainnetParams(), nil, nil, nil)
	target, err := calculator.CalculateNextTarget(prev, current, EmergencyDifficultyStartPrevHeight+1)
	if err != nil {
		t.Fatalf("CalculateNextTarget failed: %v", err)
	}

	expected := GetTargetFromBits(prev.Bits)
	expected.Lsh(expected, 4)
	if target.Cmp(expected) != 0 {
		t.Fatalf("emergency target mismatch: got %x, want %x", target, expected)
	}
}
