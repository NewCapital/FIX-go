package types

import (
	"encoding/hex"
	"fmt"
)

// HardcodedGenesisBlock returns the exact hardcoded genesis block for mainnet.
// Values MUST match the FIX legacy C++ implementation (legacy/src/chainparams.cpp:214-231).
func HardcodedGenesisBlock() *Block {
	// Coinbase transaction. pszTimestamp:
	//   "Economist 2019/05/30 Facebook's planned new currency may be based on a blockchain"
	genesisTx := &Transaction{
		Version:  1,
		LockTime: 0,
		Inputs: []*TxInput{
			{
				PreviousOutput: Outpoint{
					Hash:  ZeroHash,
					Index: 0xffffffff,
				},
				ScriptSig: hexToBytes("04ffff001d01045145636f6e6f6d69737420323031392f30352f33302046616365626f6f6b277320706c616e6e6564206e65772063757272656e6379206d6179206265206261736564206f6e206120626c6f636b636861696e"),
				Sequence:  0xffffffff,
			},
		},
		Outputs: []*TxOutput{
			{
				Value:        1 * 100000000, // 1 FIX (legacy: 1 * COIN)
				ScriptPubKey: hexToBytes("4104f0cd5da4335ab317a47e6cb15b0fd73b996c74de4640ea0b3d2e30516767d4033e71de6f69eb8c0f7f9ce9b6fc3200832aeeb1b876135b897d58d713c4d03656ac"),
			},
		},
	}

	txHash := MustParseHash("17d377a8a6d988698164f5fc9ffa8d5d03d0d1187e3a0ed886c239b3eae4be2f")
	genesisTx.SetCanonicalHash(txHash)

	genesisBlock := &Block{
		Header: &BlockHeader{
			Version:               1,
			PrevBlockHash:         ZeroHash,
			MerkleRoot:            MustParseHash("17d377a8a6d988698164f5fc9ffa8d5d03d0d1187e3a0ed886c239b3eae4be2f"),
			Timestamp:             1559224740, // 2019-05-30 13:59:00 UTC
			Bits:                  0x1e0ffff0,
			Nonce:                 3617423,
			AccumulatorCheckpoint: ZeroHash,
		},
		Transactions: []*Transaction{genesisTx},
		Signature:    []byte{},
	}

	genesisHash := MustParseHash("000000428366d3a156c38c5061d74317d201781f539460aeeeaae1091de6e4cc")
	genesisBlock.SetCanonicalHash(genesisHash)

	return genesisBlock
}

// HardcodedMainnetGenesis returns the hardcoded genesis block for mainnet
func HardcodedMainnetGenesis() *Block {
	return HardcodedGenesisBlock()
}

// hexToBytes converts a hex string to bytes, panicking on error
func hexToBytes(hexStr string) []byte {
	bytes, err := hex.DecodeString(hexStr)
	if err != nil {
		panic(fmt.Sprintf("invalid hex string: %v", err))
	}
	return bytes
}
