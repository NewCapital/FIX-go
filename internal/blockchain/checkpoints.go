package blockchain

import (
	"fmt"

	"github.com/NewCapital/FIX-go/pkg/types"
)

// Checkpoint represents a blockchain checkpoint
type Checkpoint struct {
	Height uint32
	Hash   types.Hash
}

// CheckpointManager manages blockchain checkpoints for consensus validation
type CheckpointManager struct {
	checkpoints map[uint32]types.Hash
	badBlocks   map[uint32]types.Hash // Blacklisted blocks
	lastHeight  uint32
}

// NewCheckpointManager creates a new checkpoint manager with hardcoded checkpoints
func NewCheckpointManager(network string) *CheckpointManager {
	cm := &CheckpointManager{
		checkpoints: make(map[uint32]types.Hash),
		badBlocks:   make(map[uint32]types.Hash),
		lastHeight:  0,
	}

	switch network {
	case "mainnet":
		cm.loadMainnetCheckpoints()
	case "testnet":
		cm.loadTestnetCheckpoints()
	case "regtest":
		// No checkpoints for regtest
	}

	return cm
}

// loadMainnetCheckpoints loads the hardcoded mainnet checkpoints from FIX legacy chainparams.cpp:55-93.
func (cm *CheckpointManager) loadMainnetCheckpoints() {
	checkpoints := []Checkpoint{
		{0, types.MustParseHash("000000428366d3a156c38c5061d74317d201781f539460aeeeaae1091de6e4cc")}, // genesis
		{8680, types.MustParseHash("14f995ab768b0081e79880d121e47c594c92da552580233e91b09991966dc0ba")},
		{10000, types.MustParseHash("dc3aa2f99360505cac010d7dfeaec876d407e46474c2d95d39fe3f671c2ea57e")},
		{50000, types.MustParseHash("735787e35b83aa74f23fdfefd0394c7376d13578761edf9b5f2e5938e4bac661")},
		{100000, types.MustParseHash("590423e112f6fc5697e76018b3efd135c4c0675f2afac75958d36b863819b8e0")},
		{128771, types.MustParseHash("13ae08ef23f7e3a374014d41b9674650470a3d073b4fb1d73fb08ce1ad4bd5f2")},
		{150000, types.MustParseHash("16aaad4e853bafe9c874888e5a964b85caaa135e52750badc0029da25bfb6539")},
		{180000, types.MustParseHash("1e75fb201ccacbec7778d0225d4afc36c8d1fc1355181d4bd8f431e51930c505")},
		{205547, types.MustParseHash("7d645caf64dbd949682f492efba6c8f93e95b6da06932a5612a9f33f4fdc75a7")},
		{220870, types.MustParseHash("78af47364586abb9ca5919524740cdb406c6acba4b0c0b442ca7e16a4d477103")},
		{221961, types.MustParseHash("7a38a37b90a09843c60b921e603c70310cfe47f3dcbf9af18490fe6d29a86885")},
		{221962, types.MustParseHash("dd6bac54bccfe62d51ab95e29f0b72fb3a30f25a7a1bdea44881f833247abe66")}, // known split
		{222280, types.MustParseHash("76473a9ef532e6eb61c214f258b5c2328d211b36041ec245fb9db682129cdbd8")},
		{223000, types.MustParseHash("7a48e2590b17c67e17c8bd71aae9ff240d92dea5c1d889d9ac0b44ba3d93b9a4")}, // min stake enforcement
		{223090, types.MustParseHash("2d82005d70894c5bc7d15e965faed7bffcda9a0fad535673bfea38237db3eff5")},
		{223460, types.MustParseHash("c0aebe9999f1fdd1f1dc908ecddbf4c1f1c94ad54c7f34cf596ce6b8dca466c5")},
		{240000, types.MustParseHash("694996ac2425e7e1f3a8d0dc64a550354fe352ad92d6a89127cddba6209573cb")},
		{250000, types.MustParseHash("770220fe034632ab77ae732390308328f98d7b3dd214851b907a74607f5a3f6a")},
		{264400, types.MustParseHash("b0568911a34d78138f2e3873457bea6c16a9fd98cb05f4dfeb87c39c768e5d36")},
		{285995, types.MustParseHash("5ec97787dd77fc97dcdf2708e07561c31a49e9d104824f36e933a2a3da7c148a")},
		{300000, types.MustParseHash("04439d73a64502015c058af5096706d83ece1989da12247e6b9bea9a093e4807")},
		{400000, types.MustParseHash("0c4bf326b115482a22faac9cf7e25901c70279c0c461d50d18974761251c16ab")},
		{500000, types.MustParseHash("e4fed8d4d06e7aab50a2ce4dd92d42214e07e558f105275cb6adf7455353fd51")},
		{600000, types.MustParseHash("a4ba1e07d11bd279a77474aec2533b3e20f241271c8ce7033ce8c6c7bb85dc15")},
		{614023, types.MustParseHash("a73967277c5987be9bae93425d2f6a207c536bb08fa29c6a8ce8d58710561bf4")},
		{700000, types.MustParseHash("783ee4ffa301e67dbe1cc24036c6ab8db001215d843f3735831065efdf0eb526")},
		{800000, types.MustParseHash("dcee34f8cd4089c531f4f051e36ddad0cbea7fe128d79e5fa6796f23b104b262")},
		{824630, types.MustParseHash("3111b3dd3c58adab1d5abfffda313ffc4efba1f51f087ae0862957a819dff918")},
		{825649, types.MustParseHash("ddec372c78f2eee285d2327e96567e8af31a70cf6161ce549e16c0017d6251be")}, // known split
		{825650, types.MustParseHash("c8302ddfb70417cdd0191e34ed8faea8187e21cb2ea09ce22afe3b4b9cf9f9a8")},
		{825750, types.MustParseHash("ee24b6bc13070142920c094a98addac999d6299cdb8310e9ffacc7886f634411")},
		{836310, types.MustParseHash("a8d822d912c28ef2a78ad20b6668bb884e511709d505c03d74cf586abc90d434")}, // 2nd split
		{836311, types.MustParseHash("b6820e4d2e620c4aee20b84d364cf24018c371f0749d1b4e27cb6c6259ee2816")},
		{836336, types.MustParseHash("38e72b56695ce0bd094457fbbc4cd75b9b3e7a0c8fdd80ad1c77cd228209441e")},
		{836337, types.MustParseHash("5f518cc640587a8e29fad49ad2b0b1dec90273e8fd982df936ccf0217742e7b5")}, // decision point
		{836525, types.MustParseHash("90f481c53230d9f0bc5608a23551e527c6e08bf35dcc7dfc72e928b2f7b3df82")},
		{837694, types.MustParseHash("b5243f49b8e9112ef2614ef4e86f6d57b080cf51429f117fee910b484253a4da")},
	}

	for _, checkpoint := range checkpoints {
		cm.checkpoints[checkpoint.Height] = checkpoint.Hash
		if checkpoint.Height > cm.lastHeight {
			cm.lastHeight = checkpoint.Height
		}
	}

	// FIX legacy has no banned/bad blocks list — leave badBlocks empty.
}

// loadTestnetCheckpoints loads testnet checkpoints from FIX legacy chainparams.cpp:106-112.
func (cm *CheckpointManager) loadTestnetCheckpoints() {
	checkpoints := []Checkpoint{
		{0, types.MustParseHash("000002849e7ad33536de6c50b3efb55fe8f20f219de408be70a6614c105e6bff")},
		{5000, types.MustParseHash("c6b04dcafad808edfd8dca95be127809f4fcd40aa194728e895a86c6c0c80b2d")},
		{9200, types.MustParseHash("73ff600a73400badcc9b5f09f3bc3db917906e5188975806c3fff4a2f7524ec8")},
		{10000, types.MustParseHash("32dd5d45b7904772a5311dbbc4e25aab7efafa3401465a123cd2f1aefbc422f2")},
		{11000, types.MustParseHash("735ec49a6b2cec9595723133d932540ef55bf937f9ec0ca1f50cb6ccc39a1872")},
		{12000, types.MustParseHash("67e93f3c2a06a91f8c57f990f0fdedd521e8c1be8f7386f887b78beee0988be6")},
	}
	for _, c := range checkpoints {
		cm.checkpoints[c.Height] = c.Hash
		if c.Height > cm.lastHeight {
			cm.lastHeight = c.Height
		}
	}
}

// ValidateCheckpoint checks if a block at the given height matches the expected checkpoint
func (cm *CheckpointManager) ValidateCheckpoint(height uint32, hash types.Hash) error {
	// Check if this is a blacklisted block
	if badHash, exists := cm.badBlocks[height]; exists {
		if hash == badHash {
			return fmt.Errorf("block %d with hash %s is blacklisted", height, hash)
		}
	}

	// Check if we have a checkpoint for this height
	if expectedHash, exists := cm.checkpoints[height]; exists {
		if hash != expectedHash {
			return fmt.Errorf("checkpoint mismatch at height %d: expected %s, got %s",
				height, expectedHash, hash)
		}
	}

	return nil
}

// GetCheckpoint returns the checkpoint at the given height if it exists
func (cm *CheckpointManager) GetCheckpoint(height uint32) (types.Hash, bool) {
	hash, exists := cm.checkpoints[height]
	return hash, exists
}

// GetLastCheckpointHeight returns the height of the last checkpoint
func (cm *CheckpointManager) GetLastCheckpointHeight() uint32 {
	return cm.lastHeight
}

// IsCheckpointHeight returns true if the given height has a checkpoint
func (cm *CheckpointManager) IsCheckpointHeight(height uint32) bool {
	_, exists := cm.checkpoints[height]
	return exists
}

// IsBadBlock checks if a block hash is in the bad blocks list
func (cm *CheckpointManager) IsBadBlock(height uint32, hash types.Hash) bool {
	if badHash, exists := cm.badBlocks[height]; exists {
		return hash == badHash
	}
	return false
}

// GetCheckpoints returns all checkpoints
func (cm *CheckpointManager) GetCheckpoints() map[uint32]types.Hash {
	return cm.checkpoints
}

// GetNearestCheckpoint returns the nearest checkpoint at or before the given height
func (cm *CheckpointManager) GetNearestCheckpoint(height uint32) (uint32, types.Hash, bool) {
	var nearestHeight uint32
	var nearestHash types.Hash
	found := false

	for checkHeight, checkHash := range cm.checkpoints {
		if checkHeight <= height && checkHeight > nearestHeight {
			nearestHeight = checkHeight
			nearestHash = checkHash
			found = true
		}
	}

	return nearestHeight, nearestHash, found
}
