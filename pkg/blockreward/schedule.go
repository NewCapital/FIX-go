// Package blockreward provides the canonical FIX block subsidy schedule.
//
// This is the single source of truth for block rewards across the consensus,
// blockchain, and masternode packages. Direct port of legacy
// legacy/src/main.cpp:1880-1928 GetBlockValue.
package blockreward

import "github.com/NewCapital/FIX-go/pkg/types"

// Coin is one FIX in satoshis.
const Coin int64 = 100_000_000

// Bootstrap-phase boundaries from legacy main.cpp:1887.
//
//	if (nHeight < ((NetworkID() == MAIN) ? 20000 : 1000)) nSubsidy = 3 * COIN;
const (
	MainnetBootstrapEnd uint32 = 20000
	TestnetBootstrapEnd uint32 = 1000
)

// Schedule returns the block subsidy in satoshis for the given height,
// using bootstrapEnd as the upper bound (exclusive) of the 3-FIX phase.
//
// Pass MainnetBootstrapEnd or TestnetBootstrapEnd, or — for callers that
// have ChainParams in hand — use ForParams which selects the boundary
// from params.Name.
func Schedule(height, bootstrapEnd uint32) int64 {
	switch {
	case height < 1:
		// Genesis premine (legacy main.cpp:1885-1886).
		return 500_000_000 * Coin
	case height < bootstrapEnd:
		// Bootstrap phase (legacy main.cpp:1887-1888).
		return 3 * Coin
	case height < 633333:
		// Main inflation phase: 15220.70 FIX (legacy main.cpp:1891-1892).
		// Encoded as exact integer to avoid float64 rounding (15220.70 is
		// not representable exactly in binary float; multiplying by 1e8
		// and casting to int64 truncates to 1_522_069_999_999 on most
		// platforms, which would fork the chain on every block in this
		// phase).
		return 1_522_070_000_000
	case height < 638888:
		return 8000 * Coin
	case height < 644444:
		return 4000 * Coin
	case height < 649999:
		return 2000 * Coin
	case height < 655555:
		return 1000 * Coin
	case height < 661111:
		return 500 * Coin
	case height < 666669:
		return 250 * Coin
	case height < 672222:
		return 125 * Coin
	case height < 677777:
		return 60 * Coin
	case height < 683333:
		return 30 * Coin
	case height < 688888:
		return 15 * Coin
	case height < 694444:
		return 8 * Coin
	case height < 699999:
		return 4 * Coin
	case height < 908010:
		return 2 * Coin
	case height < 6569605:
		return 100 * Coin
	default:
		return 0
	}
}

// Mainnet returns the block subsidy for the mainnet schedule.
func Mainnet(height uint32) int64 {
	return Schedule(height, MainnetBootstrapEnd)
}

// Testnet returns the block subsidy for the testnet schedule.
func Testnet(height uint32) int64 {
	return Schedule(height, TestnetBootstrapEnd)
}

// ForParams returns the block subsidy for the network described by params.
// Selects the bootstrap boundary from params.Name; defaults to mainnet for
// any unrecognized network (regtest, custom).
func ForParams(height uint32, params *types.ChainParams) int64 {
	if params != nil && params.Name == "testnet" {
		return Testnet(height)
	}
	return Mainnet(height)
}
