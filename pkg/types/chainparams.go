package types

import (
	"math/big"
	"strings"
	"time"

	"github.com/NewCapital/FIX-go/pkg/crypto"
)

// mustCreateDevScriptPubKey converts a Base58 address to scriptPubKey or panics
// Used for initializing dev fund address in chain parameters
func mustCreateDevScriptPubKey(addressStr string) []byte {
	addr, err := crypto.DecodeAddress(addressStr)
	if err != nil {
		panic("invalid dev fund address: " + err.Error())
	}
	return addr.CreateScriptPubKey()
}

// MasternodeTier represents the different masternode tiers
type MasternodeTier int

const (
	MasternodeTierBronze MasternodeTier = iota
	MasternodeTierSilver
	MasternodeTierGold
	MasternodeTierPlatinum
)

// ChainParams defines the parameters for a specific blockchain network
type ChainParams struct {
	// Network identification
	Name          string   // Network name (mainnet, testnet, regtest)
	NetMagicBytes [4]byte  // Magic bytes for network protocol
	DefaultPort   int      // Default P2P port
	DNSSeeds      []string // DNS seeds for peer discovery

	// PoS parameters
	StakeMinAge           time.Duration // Minimum age for coins to stake
	StakeModifierInterval time.Duration // Stake modifier update interval
	MaxFutureBlockTime    time.Duration // Maximum time a block can be from the future
	CoinbaseMaturity      uint32        // Blocks until coinbase outputs can be spent
	MinStakeAmount        int64         // Minimum amount required to stake (in satoshis)

	// Block parameters
	TargetSpacing      time.Duration // Target time between blocks
	MaxBlockSize       uint32        // Maximum block size in bytes
	DifficultyInterval uint32        // Blocks between difficulty adjustments
	PowLimit           uint32        // Proof-of-work difficulty limit (compact format)
	PowLimitBig        *big.Int      // Proof-of-work difficulty limit as big integer
	MinBlockVersion    uint32        // Minimum block version
	MinBlockInterval   time.Duration // Minimum time between blocks
	GenesisTime        int64         // Genesis block timestamp

	// Activation heights for protocol upgrades
	LastPOWBlock                 uint32 // Last proof-of-work block height
	ModifierUpgradeBlock         uint32 // Block height for stake modifier v2 upgrade
	ZerocoinStartHeight          uint32 // Block height when Zerocoin becomes active
	ZerocoinStartTime            int64  // Timestamp when Zerocoin becomes active
	BlockEnforceSerialRange      uint32 // Enforce serial range starting this block
	BlockRecalculateAccumulators uint32 // Trigger recalculation of accumulators
	BlockFirstFraudulent         uint32 // First block that bad serials emerged
	BlockLastGoodCheckpoint      uint32 // Last valid accumulator checkpoint
	BlockEnforceInvalidUTXO      uint32 // Start enforcing the invalid UTXO's
	InvalidAmountFiltered        int64  // Amount of invalid coins filtered (in satoshis)
	BlockZerocoinV2              uint32 // Block that zerocoin v2 becomes active
	EnforceNewSporkKey           int64  // Timestamp - sporks after this must use new key
	RejectOldSporkKey            int64  // Timestamp - fully reject old spork key after this
	// Masternode tiers and their collateral requirements
	MasternodeTiers map[MasternodeTier]int64

	// Reward parameters (in satoshis)
	BlockReward      int64  // Base block reward
	MasternodeReward int64  // Masternode reward percentage (basis points)
	StakeReward      int64  // Stake reward percentage (basis points)
	DevFundReward    int64  // Development fund percentage (basis points)
	DevAddress       []byte // Development fund payout address (scriptPubKey)

	// Genesis block parameters
	GenesisHash       Hash   // Genesis block hash
	GenesisTimestamp  uint32 // Genesis block timestamp
	GenesisNonce      uint32 // Genesis block nonce
	InitialDifficulty uint32 // Genesis block difficulty (compact format)
	InitialReward     int64  // Initial block reward in satoshis

	// Spork keys (for network governance)
	SporkPubKey    string // Current spork public key (hex)
	SporkPubKeyOld string // Old spork public key for backward compatibility (hex)

	// Note: AssumeValidHash and AssumeValidHeight removed
	// We now use dynamic depth-based validation (last 50 blocks fully validated)
}

// Standard reward percentages (in basis points, 1% = 100 bp)
const (
	DefaultBlockReward      = 5000000000 // 50 FIX in satoshis
	DefaultMasternodeReward = 8000       // 80%
	DefaultStakeReward      = 1000       // 10%
	DefaultDevFundReward    = 1000       // 10%
)

// MaxSupply is the FIX maximum coin supply (legacy chainparams.cpp:174).
// 1 billion FIX in satoshis.
const MaxSupply int64 = 1_000_000_000 * 100_000_000

// BIP44 coin types (legacy chainparams.cpp:254, 384).
const (
	BIP44CoinTypeMainnet uint32 = 336
	BIP44CoinTypeTestnet uint32 = 1
)

// GetTierCollateral returns the collateral requirement for a specific masternode tier
func (cp *ChainParams) GetTierCollateral(tier MasternodeTier) int64 {
	if collateral, exists := cp.MasternodeTiers[tier]; exists {
		return collateral
	}
	return 0
}

// IsValidTier checks if the given collateral amount corresponds to a valid tier
func (cp *ChainParams) IsValidTier(collateral int64) bool {
	for _, requiredCollateral := range cp.MasternodeTiers {
		if collateral == requiredCollateral {
			return true
		}
	}
	return false
}

// GetTierFromCollateral returns the masternode tier for a given collateral amount
func (cp *ChainParams) GetTierFromCollateral(collateral int64) (MasternodeTier, bool) {
	for tier, requiredCollateral := range cp.MasternodeTiers {
		if collateral == requiredCollateral {
			return tier, true
		}
	}
	return MasternodeTierBronze, false
}

// GetTierRewardPercentage returns the reward percentage for a specific tier
func (cp *ChainParams) GetTierRewardPercentage(tier MasternodeTier) int64 {
	switch tier {
	case MasternodeTierBronze:
		return 1000 // 10%
	case MasternodeTierSilver:
		return 2000 // 20%
	case MasternodeTierGold:
		return 3000 // 30%
	case MasternodeTierPlatinum:
		return 4000 // 40%
	default:
		return 0
	}
}

// MainnetParams returns the chain parameters for the main network.
// All values match FIX legacy C++ (legacy/src/chainparams.cpp Main class).
func MainnetParams() *ChainParams {
	return &ChainParams{
		Name:          "mainnet",
		NetMagicBytes: [4]byte{0x74, 0x2c, 0x4d, 0x64}, // FIX mainnet pchMessageStart (legacy chainparams.cpp:157-160)
		DefaultPort:   17464,                           // FIX mainnet P2P port (legacy chainparams.cpp:162)
		DNSSeeds: []string{
			// FIX mainnet seeds (refreshed 2026-04-15)
			"45.77.206.161",
			"45.77.64.171",
			"207.148.67.25",
			"45.32.36.145",
			"108.61.221.138",
			"149.28.255.224",
			"207.246.73.248",
			"216.238.117.200",
			"149.28.166.62",
			"65.20.68.219",
			"158.247.254.3",
			"139.84.245.134",
		},

		// PoS parameters (FIX legacy)
		StakeMinAge:           3 * time.Hour,    // legacy: nStakeMinAge = 3 * 60 * 60
		StakeModifierInterval: 60 * time.Second, // legacy: MODIFIER_INTERVAL = 60
		MaxFutureBlockTime:    2 * time.Hour,
		CoinbaseMaturity:      60,                // legacy: nMaturity
		MinStakeAmount:        12000 * 100000000, // 100 FIX (legacy chainparams.cpp:186 nStakeMinInput)

		// Block parameters
		TargetSpacing:      2 * time.Minute,                 // 120s (legacy: nTargetSpacing)
		MaxBlockSize:       1000000,                         // 1MB
		DifficultyInterval: 2016,                            // ~2 weeks at 1 minute blocks
		PowLimit:           0x1e0fffff,                      // Max PoW target (compact format)
		PowLimitBig:        powLimitFromCompact(0x1e0fffff), // ~uint256(0) >> 20

		// Activation heights (from legacy chainparams.cpp:170-202)
		LastPOWBlock:                 400,
		ModifierUpgradeBlock:         200,
		ZerocoinStartHeight:          15000000,
		ZerocoinStartTime:            4070908800,
		BlockEnforceSerialRange:      895400,
		BlockRecalculateAccumulators: 6569605,
		BlockFirstFraudulent:         891737,
		BlockLastGoodCheckpoint:      891730,
		BlockEnforceInvalidUTXO:      902850,
		InvalidAmountFiltered:        268200 * 100000000,
		BlockZerocoinV2:              104153160,
		EnforceNewSporkKey:           1547424000, // 2019-01-14 00:00:00 UTC
		RejectOldSporkKey:            1547510400, // 2019-01-15 00:00:00 UTC

		// Masternode tiers (amounts in satoshis) — legacy chainparams.cpp:176-185
		MasternodeTiers: map[MasternodeTier]int64{
			MasternodeTierBronze:   100000000000000,   // 1M FIX
			MasternodeTierSilver:   500000000000000,   // 5M FIX
			MasternodeTierGold:     2000000000000000,  // 20M FIX
			MasternodeTierPlatinum: 10000000000000000, // 100M FIX
		},

		// Rewards
		BlockReward:      DefaultBlockReward,
		MasternodeReward: DefaultMasternodeReward,
		StakeReward:      DefaultStakeReward,
		DevFundReward:    DefaultDevFundReward,
		DevAddress:       mustCreateDevScriptPubKey("FCoB1M2CxxN1fAezRAZC31AWtMBZ3zSvyF"), // FIX mainnet dev fund (legacy chainparams.cpp:245)

		// Genesis block parameters (legacy chainparams.cpp:214-231)
		GenesisHash:       MustParseHash("000000428366d3a156c38c5061d74317d201781f539460aeeeaae1091de6e4cc"),
		GenesisTimestamp:  1559224740, // 2019-05-30 13:59:00 UTC
		GenesisNonce:      3617423,
		InitialDifficulty: 0x1e0ffff0,
		InitialReward:     1 * 100000000, // 1 FIX (legacy: 1 * COIN)

		// Spork keys (legacy chainparams.cpp:268-269 — FIX uses single key for both fields)
		SporkPubKey:    "046a1535627b95db35cb8a13703ef86c3c381e787c604ff50620e5d6e97bfc02e466a8699c7c7ab742a5b1b559dc180facb8a406da2d9ecff0f00923371d8beae7",
		SporkPubKeyOld: "046a1535627b95db35cb8a13703ef86c3c381e787c604ff50620e5d6e97bfc02e466a8699c7c7ab742a5b1b559dc180facb8a406da2d9ecff0f00923371d8beae7",

		// DYNAMIC VALIDATION: depth-based validation (last 50 blocks fully validated).
	}
}

// TestnetParams returns the chain parameters for the test network.
// All values match FIX legacy C++ (legacy/src/chainparams.cpp Testnet class).
func TestnetParams() *ChainParams {
	params := MainnetParams()
	params.Name = "testnet"
	params.NetMagicBytes = [4]byte{0x44, 0x6a, 0xa4, 0xcc} // legacy chainparams.cpp:308-311
	params.DefaultPort = 5447                              // legacy chainparams.cpp:313
	params.DNSSeeds = []string{
		// FIX legacy testnet seeds (legacy chainparams.cpp:362-370)
		"46.19.210.197",  // Germany
		"46.19.214.68",   // Singapore
		"142.93.145.197", // Toronto
		"159.65.84.118",  // London
		"167.99.223.138", // Amsterdam
		"68.183.161.44",  // San Francisco
		"46.19.212.68",   // LA
		"46.19.213.68",   // Miami
		"46.19.209.68",   // New York
	}

	// Testnet timing parameters
	params.TargetSpacing = 2 * time.Minute // 120s (same as mainnet)
	params.CoinbaseMaturity = 15           // legacy: nMaturity testnet

	// Testnet collateral — same as mainnet
	params.MasternodeTiers = map[MasternodeTier]int64{
		MasternodeTierBronze:   100000000000000,   // 1M FIX
		MasternodeTierSilver:   500000000000000,   // 5M FIX
		MasternodeTierGold:     2000000000000000,  // 20M FIX
		MasternodeTierPlatinum: 10000000000000000, // 100M FIX
	}

	// Testnet genesis (legacy chainparams.cpp:351-355)
	params.GenesisHash = MustParseHash("000002849e7ad33536de6c50b3efb55fe8f20f219de408be70a6614c105e6bff")
	params.GenesisTimestamp = 1559224740 // same as mainnet per legacy
	params.GenesisNonce = 6529523

	// Testnet dev address (legacy chainparams.cpp:373)
	params.DevAddress = mustCreateDevScriptPubKey("XiAHWrbngwovQPdtWzuehx4BL4dvCFKSW3")

	// Testnet spork keys (legacy chainparams.cpp:396-397 — single key for both fields)
	params.SporkPubKey = "04c9ac467e88caca60e5048efa9d254098422a877f1ffcbb506c4e2b3786b8ae16ae45b586e4106661e4f157da64eeb1486b19940a25511ebcbd07bc8c2f85fdca"
	params.SporkPubKeyOld = "04c9ac467e88caca60e5048efa9d254098422a877f1ffcbb506c4e2b3786b8ae16ae45b586e4106661e4f157da64eeb1486b19940a25511ebcbd07bc8c2f85fdca"

	// Testnet activation heights (legacy chainparams.cpp:338-349)
	params.ZerocoinStartHeight = 200
	params.ZerocoinStartTime = 4070908800 // legacy: disabled (year 2099)
	params.BlockEnforceSerialRange = 1
	params.BlockRecalculateAccumulators = 9908000
	params.BlockFirstFraudulent = 9891737
	params.BlockLastGoodCheckpoint = 9891730
	params.BlockEnforceInvalidUTXO = 9902850
	params.InvalidAmountFiltered = 0
	params.BlockZerocoinV2 = 444020 // legacy chainparams.cpp:346
	params.ModifierUpgradeBlock = 51197

	return params
}

// RegtestParams returns the chain parameters for regression testing.
// Values match FIX legacy C++ (legacy/src/chainparams.cpp RegTest class).
func RegtestParams() *ChainParams {
	params := TestnetParams()
	params.Name = "regtest"
	params.NetMagicBytes = [4]byte{0x2a, 0xfc, 0xc7, 0xca} // legacy chainparams.cpp:421-424
	params.DefaultPort = 5467                              // legacy chainparams.cpp:438
	params.DNSSeeds = []string{}                           // no DNS seeds for regtest

	// Timing parameters
	params.StakeMinAge = 1 * time.Minute
	params.TargetSpacing = 2 * time.Minute
	params.CoinbaseMaturity = 1
	params.DifficultyInterval = 10

	// Minimal collateral for regression testing
	params.MasternodeTiers = map[MasternodeTier]int64{
		MasternodeTierBronze:   100000000,   // 1 FIX
		MasternodeTierSilver:   500000000,   // 5 FIX
		MasternodeTierGold:     2000000000,  // 20 FIX
		MasternodeTierPlatinum: 10000000000, // 100 FIX
	}

	// Regtest genesis (legacy chainparams.cpp:433-435)
	params.GenesisTimestamp = 1537120201
	params.GenesisNonce = 12345
	params.InitialDifficulty = 0x207fffff

	return params
}

// DefaultChainParams returns the default chain parameters (mainnet)
func DefaultChainParams() *ChainParams {
	return MainnetParams()
}

// MustParseHash parses a hex-encoded hash string and panics on error
// Used for initializing hardcoded genesis hashes
// Bitcoin/FIX convention: hash strings are in little-endian (display format)
func MustParseHash(hexStr string) Hash {
	// Remove 0x prefix if present
	if strings.HasPrefix(hexStr, "0x") || strings.HasPrefix(hexStr, "0X") {
		hexStr = hexStr[2:]
	}

	hash, err := NewHashFromString(hexStr)
	if err != nil {
		panic("invalid genesis hash: " + err.Error())
	}

	return hash
}

// powLimitFromCompact converts a compact difficulty representation to big.Int
// Compact format: 0x1e0ffff0 = 0x0ffff0 * 2^(8*(0x1e - 3))
func powLimitFromCompact(compact uint32) *big.Int {
	// Extract size and mantissa from compact representation
	size := compact >> 24
	mantissa := compact & 0x00ffffff

	// Check for negative or overflow
	if mantissa > 0x7fffff {
		return big.NewInt(0)
	}

	// Calculate result
	result := big.NewInt(int64(mantissa))
	if size <= 3 {
		result.Rsh(result, uint(8*(3-size)))
	} else {
		result.Lsh(result, uint(8*(size-3)))
	}

	return result
}
