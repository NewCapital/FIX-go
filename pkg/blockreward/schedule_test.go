package blockreward

import (
	"testing"

	"github.com/NewCapital/FIX-go/pkg/types"
)

// TestMainnetSchedule verifies the mainnet schedule matches legacy
// legacy/src/main.cpp:1880-1928 GetBlockValue exactly.
//
// Regression guard for h-fix-block-reward-schedule: the previous Go port had
// every phase-out threshold shifted by ~+77778 blocks, causing dev-fund
// validation to reject mainnet block 634000 (Go expected 1522.07 FIX dev
// reward, real chain pays 800 FIX since the per-block subsidy already dropped
// to 8000 FIX at height 633333).
func TestMainnetSchedule(t *testing.T) {
	cases := []struct {
		height uint32
		want   int64
		note   string
	}{
		{0, 500_000_000 * Coin, "genesis premine (legacy main.cpp:1885-1886)"},
		{1, 3 * Coin, "first reward block: 3 FIX (mainnet bootstrap)"},
		{19999, 3 * Coin, "last height in 3 FIX bootstrap phase"},
		{20000, 1_522_070_000_000, "first height paying 15220.70 FIX"},
		{633332, 1_522_070_000_000, "last height of 15220.70 FIX phase"},
		{633333, 8000 * Coin, "phase-out begins: 8000 FIX"},
		{634000, 8000 * Coin, "regression: previously returned 15220.70 FIX"},
		{638887, 8000 * Coin, "last height of 8000 FIX phase"},
		{638888, 4000 * Coin, "4000 FIX phase begins"},
		{644443, 4000 * Coin, "last height of 4000 FIX phase"},
		{644444, 2000 * Coin, "2000 FIX phase begins"},
		{649998, 2000 * Coin, "last height of 2000 FIX phase"},
		{649999, 1000 * Coin, "1000 FIX phase begins"},
		{655554, 1000 * Coin, "last height of 1000 FIX phase"},
		{655555, 500 * Coin, "500 FIX phase begins"},
		{661110, 500 * Coin, "last height of 500 FIX phase"},
		{661111, 250 * Coin, "250 FIX phase begins"},
		{666668, 250 * Coin, "last height of 250 FIX phase"},
		{666669, 125 * Coin, "125 FIX phase begins"},
		{672221, 125 * Coin, "last height of 125 FIX phase"},
		{672222, 60 * Coin, "60 FIX phase begins"},
		{677776, 60 * Coin, "last height of 60 FIX phase"},
		{677777, 30 * Coin, "30 FIX phase begins"},
		{683332, 30 * Coin, "last height of 30 FIX phase"},
		{683333, 15 * Coin, "15 FIX phase begins"},
		{688887, 15 * Coin, "last height of 15 FIX phase"},
		{688888, 8 * Coin, "8 FIX phase begins"},
		{694443, 8 * Coin, "last height of 8 FIX phase"},
		{694444, 4 * Coin, "4 FIX phase begins"},
		{699998, 4 * Coin, "last height of 4 FIX phase"},
		{699999, 2 * Coin, "2 FIX phase begins"},
		{908009, 2 * Coin, "last height of 2 FIX phase"},
		{908010, 100 * Coin, "100 FIX phase begins"},
		{6569604, 100 * Coin, "last height of 100 FIX phase"},
		{6569605, 0, "rewards end"},
		{10_000_000, 0, "well past final phase: still zero"},
	}

	for _, c := range cases {
		got := Mainnet(c.height)
		if got != c.want {
			t.Errorf("Mainnet(%d) = %d, want %d (%s)", c.height, got, c.want, c.note)
		}
	}
}

// TestTestnetSchedule covers the only mainnet/testnet divergence: the 3-FIX
// bootstrap phase ends at 1000 on testnet (vs 20000 on mainnet, legacy
// main.cpp:1887). Beyond bootstrap, the schedule is identical.
func TestTestnetSchedule(t *testing.T) {
	cases := []struct {
		height uint32
		want   int64
		note   string
	}{
		{0, 500_000_000 * Coin, "genesis premine"},
		{1, 3 * Coin, "first reward block: 3 FIX"},
		{999, 3 * Coin, "last height of testnet 3 FIX phase"},
		{1000, 1_522_070_000_000, "first height paying 15220.70 FIX on testnet"},
		{19999, 1_522_070_000_000, "still 15220.70 FIX on testnet (mainnet would still be 3 FIX)"},
		{20000, 1_522_070_000_000, "boundary parity with mainnet for 15220.70 phase"},
		{633332, 1_522_070_000_000, "end of 15220.70 phase, identical to mainnet"},
		{633333, 8000 * Coin, "phase-out begins identically to mainnet"},
		{634000, 8000 * Coin, "regression height parity with mainnet"},
		{6569605, 0, "rewards end identically to mainnet"},
	}

	for _, c := range cases {
		got := Testnet(c.height)
		if got != c.want {
			t.Errorf("Testnet(%d) = %d, want %d (%s)", c.height, got, c.want, c.note)
		}
	}
}

// TestForParamsRoutesByName verifies ForParams selects the testnet schedule
// only for params.Name == "testnet" and otherwise (mainnet, regtest, nil)
// uses the mainnet schedule.
func TestForParamsRoutesByName(t *testing.T) {
	mainnet := &types.ChainParams{Name: "mainnet"}
	testnet := &types.ChainParams{Name: "testnet"}
	regtest := &types.ChainParams{Name: "regtest"}

	// Inside the bootstrap-divergent range, mainnet returns 3 FIX, testnet
	// returns 15220.70 FIX. Anything outside testnet returns mainnet.
	const probe uint32 = 5000

	if got := ForParams(probe, mainnet); got != 3*Coin {
		t.Errorf("ForParams(%d, mainnet) = %d, want %d (3 FIX)", probe, got, 3*Coin)
	}
	if got := ForParams(probe, testnet); got != 1_522_070_000_000 {
		t.Errorf("ForParams(%d, testnet) = %d, want %d (15220.70 FIX)", probe, got, int64(1_522_070_000_000))
	}
	if got := ForParams(probe, regtest); got != 3*Coin {
		t.Errorf("ForParams(%d, regtest) = %d, want %d (mainnet default)", probe, got, 3*Coin)
	}
	if got := ForParams(probe, nil); got != 3*Coin {
		t.Errorf("ForParams(%d, nil) = %d, want %d (mainnet default)", probe, got, 3*Coin)
	}
}
