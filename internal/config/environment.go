package config

import (
	"fmt"
	"os"
	"strconv"
	"strings"
)

// Environment variable constants
const (
	// Network settings - Basic
	EnvNetworkPort      = "FIX_NETWORK_PORT"
	EnvNetworkSeeds     = "FIX_NETWORK_SEEDS"
	EnvNetworkMaxPeers  = "FIX_NETWORK_MAX_PEERS"
	EnvTestNet          = "FIX_TESTNET"
	EnvListenAddr       = "FIX_LISTEN_ADDR"
	EnvExternalIP       = "FIX_EXTERNAL_IP"
	EnvNetworkTimeout   = "FIX_NETWORK_TIMEOUT"
	EnvNetworkKeepAlive = "FIX_NETWORK_KEEP_ALIVE"

	// Network settings - Core Connection (Legacy C++ Compatible)
	EnvNetworkListen   = "FIX_NETWORK_LISTEN"
	EnvNetworkDNS      = "FIX_NETWORK_DNS"
	EnvNetworkDNSSeed  = "FIX_NETWORK_DNS_SEED"
	EnvNetworkDiscover = "FIX_NETWORK_DISCOVER"

	// Network settings - Peer Management (Legacy C++ Compatible)
	EnvNetworkAddNodes    = "FIX_NETWORK_ADD_NODES"
	EnvNetworkSeedNodes   = "FIX_NETWORK_SEED_NODES"
	EnvNetworkConnectOnly = "FIX_NETWORK_CONNECT_ONLY"

	// Network settings - Ban Settings (Legacy C++ Compatible)
	EnvNetworkBanScore = "FIX_NETWORK_BAN_SCORE"
	EnvNetworkBanTime  = "FIX_NETWORK_BAN_TIME"

	// Network settings - Proxy/Tor (Legacy C++ Compatible)
	EnvNetworkProxy          = "FIX_NETWORK_PROXY"
	EnvNetworkOnionProxy     = "FIX_NETWORK_ONION_PROXY"
	EnvNetworkTorControl     = "FIX_NETWORK_TOR_CONTROL"
	EnvNetworkTorPassword    = "FIX_NETWORK_TOR_PASSWORD"
	EnvNetworkListenOnion    = "FIX_NETWORK_LISTEN_ONION"
	EnvNetworkProxyRandomize = "FIX_NETWORK_PROXY_RANDOMIZE"

	// Network settings - UPnP (Legacy C++ Compatible)
	EnvNetworkUPnP = "FIX_NETWORK_UPNP"

	// Network settings - Buffer Settings (Legacy C++ Compatible)
	EnvNetworkMaxReceiveBuffer = "FIX_NETWORK_MAX_RECEIVE_BUFFER"
	EnvNetworkMaxSendBuffer    = "FIX_NETWORK_MAX_SEND_BUFFER"

	// Network settings - Filtering (Legacy C++ Compatible)
	EnvNetworkOnlyNet = "FIX_NETWORK_ONLY_NET"

	// RPC settings
	EnvRPCEnabled    = "FIX_RPC_ENABLED"
	EnvRPCPort       = "FIX_RPC_PORT"
	EnvRPCHost       = "FIX_RPC_HOST"
	EnvRPCUsername   = "FIX_RPC_USERNAME"
	EnvRPCPassword   = "FIX_RPC_PASSWORD"
	EnvRPCMaxClients = "FIX_RPC_MAX_CLIENTS"

	// Masternode settings
	EnvMasternodeEnabled     = "FIX_MASTERNODE_ENABLED"
	EnvMasternodePrivateKey  = "FIX_MASTERNODE_PRIVATE_KEY"
	EnvMasternodeServiceAddr = "FIX_MASTERNODE_SERVICE_ADDR"
	EnvMasternodeMnConf      = "FIX_MASTERNODE_MNCONF"
	EnvMasternodeMnConfLock  = "FIX_MASTERNODE_MNCONFLOCK"

	// Staking settings
	EnvStakingEnabled        = "FIX_STAKING"
	EnvStakingReserveBalance = "FIX_RESERVE_BALANCE"

	// Logging settings
	EnvLoggingLevel  = "FIX_LOGGING_LEVEL"
	EnvLoggingFormat = "FIX_LOGGING_FORMAT"
	EnvLoggingOutput = "FIX_LOGGING_OUTPUT"

	// Data directory (legacy compatibility)
	EnvDataDir = "FIX_DATADIR"
)

// LoadEnvironmentOverrides loads configuration overrides from environment variables
func LoadEnvironmentOverrides() map[string]interface{} {
	overrides := make(map[string]interface{})

	// Network settings
	if val := GetEnvInt(EnvNetworkPort, 0); val != 0 {
		overrides["network.port"] = val
	}

	if val := GetEnvString(EnvNetworkSeeds, ""); val != "" {
		seeds := strings.Split(val, ",")
		for i, seed := range seeds {
			seeds[i] = strings.TrimSpace(seed)
		}
		overrides["network.seeds"] = seeds
	}

	if val := GetEnvInt(EnvNetworkMaxPeers, 0); val != 0 {
		overrides["network.maxPeers"] = val
	}

	if val := GetEnvString(EnvTestNet, ""); val != "" {
		overrides["network.testNet"] = GetEnvBool(EnvTestNet, false)
	}

	if val := GetEnvString(EnvListenAddr, ""); val != "" {
		overrides["network.listenAddr"] = val
	}

	if val := GetEnvString(EnvExternalIP, ""); val != "" {
		overrides["network.externalIP"] = val
	}

	if val := GetEnvInt(EnvNetworkTimeout, 0); val != 0 {
		overrides["network.timeout"] = val
	}

	if val := GetEnvInt(EnvNetworkKeepAlive, 0); val != 0 {
		overrides["network.keepAlive"] = val
	}

	// Network settings - Core Connection (Legacy C++ Compatible)
	if val := GetEnvString(EnvNetworkListen, ""); val != "" {
		overrides["network.listen"] = GetEnvBool(EnvNetworkListen, true)
	}

	if val := GetEnvString(EnvNetworkDNS, ""); val != "" {
		overrides["network.dns"] = GetEnvBool(EnvNetworkDNS, true)
	}

	if val := GetEnvString(EnvNetworkDNSSeed, ""); val != "" {
		overrides["network.dnsSeed"] = GetEnvBool(EnvNetworkDNSSeed, true)
	}

	if val := GetEnvString(EnvNetworkDiscover, ""); val != "" {
		overrides["network.discover"] = GetEnvBool(EnvNetworkDiscover, true)
	}

	// Network settings - Peer Management (Legacy C++ Compatible)
	if val := GetEnvString(EnvNetworkAddNodes, ""); val != "" {
		nodes := strings.Split(val, ",")
		for i, node := range nodes {
			nodes[i] = strings.TrimSpace(node)
		}
		overrides["network.addNodes"] = nodes
	}

	if val := GetEnvString(EnvNetworkSeedNodes, ""); val != "" {
		nodes := strings.Split(val, ",")
		for i, node := range nodes {
			nodes[i] = strings.TrimSpace(node)
		}
		overrides["network.seedNodes"] = nodes
	}

	if val := GetEnvString(EnvNetworkConnectOnly, ""); val != "" {
		nodes := strings.Split(val, ",")
		for i, node := range nodes {
			nodes[i] = strings.TrimSpace(node)
		}
		overrides["network.connectOnly"] = nodes
	}

	// Network settings - Ban Settings (Legacy C++ Compatible)
	if val := GetEnvInt(EnvNetworkBanScore, 0); val != 0 {
		overrides["network.banScore"] = val
	}

	if val := GetEnvInt(EnvNetworkBanTime, 0); val != 0 {
		overrides["network.banTime"] = val
	}

	// Network settings - Proxy/Tor (Legacy C++ Compatible)
	if val := GetEnvString(EnvNetworkProxy, ""); val != "" {
		overrides["network.proxy"] = val
	}

	if val := GetEnvString(EnvNetworkOnionProxy, ""); val != "" {
		overrides["network.onionProxy"] = val
	}

	if val := GetEnvString(EnvNetworkTorControl, ""); val != "" {
		overrides["network.torControl"] = val
	}

	if val := GetEnvString(EnvNetworkTorPassword, ""); val != "" {
		overrides["network.torPassword"] = val
	}

	if val := GetEnvString(EnvNetworkListenOnion, ""); val != "" {
		overrides["network.listenOnion"] = GetEnvBool(EnvNetworkListenOnion, true)
	}

	if val := GetEnvString(EnvNetworkProxyRandomize, ""); val != "" {
		overrides["network.proxyRandomize"] = GetEnvBool(EnvNetworkProxyRandomize, true)
	}

	// Network settings - UPnP (Legacy C++ Compatible)
	if val := GetEnvString(EnvNetworkUPnP, ""); val != "" {
		overrides["network.upnp"] = GetEnvBool(EnvNetworkUPnP, true)
	}

	// Network settings - Buffer Settings (Legacy C++ Compatible)
	if val := GetEnvInt(EnvNetworkMaxReceiveBuffer, 0); val != 0 {
		overrides["network.maxReceiveBuffer"] = val
	}

	if val := GetEnvInt(EnvNetworkMaxSendBuffer, 0); val != 0 {
		overrides["network.maxSendBuffer"] = val
	}

	// Network settings - Filtering (Legacy C++ Compatible)
	if val := GetEnvString(EnvNetworkOnlyNet, ""); val != "" {
		overrides["network.onlyNet"] = val
	}

	// RPC settings
	if val := GetEnvString(EnvRPCEnabled, ""); val != "" {
		overrides["rpc.enabled"] = GetEnvBool(EnvRPCEnabled, true)
	}

	if val := GetEnvInt(EnvRPCPort, 0); val != 0 {
		overrides["rpc.port"] = val
	}

	if val := GetEnvString(EnvRPCHost, ""); val != "" {
		overrides["rpc.host"] = val
	}

	if val := GetEnvString(EnvRPCUsername, ""); val != "" {
		overrides["rpc.username"] = val
	}

	if val := GetEnvString(EnvRPCPassword, ""); val != "" {
		overrides["rpc.password"] = val
	}

	if val := GetEnvInt(EnvRPCMaxClients, 0); val != 0 {
		overrides["rpc.maxClients"] = val
	}

	// Staking settings
	if val := GetEnvString(EnvStakingEnabled, ""); val != "" {
		overrides["staking.enabled"] = GetEnvBool(EnvStakingEnabled, false)
	}

	if os.Getenv(EnvStakingReserveBalance) != "" {
		overrides["staking.reserveBalance"] = GetEnvInt64(EnvStakingReserveBalance, 0)
	}

	// Masternode settings
	if val := GetEnvString(EnvMasternodeEnabled, ""); val != "" {
		overrides["masternode.enabled"] = GetEnvBool(EnvMasternodeEnabled, false)
	}

	if val := GetEnvString(EnvMasternodePrivateKey, ""); val != "" {
		overrides["masternode.privateKey"] = val
	}

	if val := GetEnvString(EnvMasternodeServiceAddr, ""); val != "" {
		overrides["masternode.serviceAddr"] = val
	}

	if val := GetEnvString(EnvMasternodeMnConf, ""); val != "" {
		overrides["masternode.mnConf"] = val
	}

	if os.Getenv(EnvMasternodeMnConfLock) != "" {
		overrides["masternode.mnConfLock"] = GetEnvBool(EnvMasternodeMnConfLock, true)
	}

	// Logging settings
	if val := GetEnvString(EnvLoggingLevel, ""); val != "" {
		overrides["logging.level"] = val
	}

	if val := GetEnvString(EnvLoggingFormat, ""); val != "" {
		overrides["logging.format"] = val
	}

	if val := GetEnvString(EnvLoggingOutput, ""); val != "" {
		overrides["logging.output"] = val
	}

	return overrides
}

// ApplyEnvironmentOverrides applies environment variable overrides to a configuration
func ApplyEnvironmentOverrides(config *Config) error {
	if config == nil {
		return fmt.Errorf("config cannot be nil")
	}

	overrides := LoadEnvironmentOverrides()
	if len(overrides) > 0 {
		return applyOverrides(config, overrides)
	}

	return nil
}

// LoadConfigWithEnvironment loads configuration from file and applies environment overrides
func LoadConfigWithEnvironment(path string) (*Config, error) {
	// Load base configuration
	config, err := LoadConfig(path)
	if err != nil {
		return nil, err
	}

	// Apply environment overrides
	if err := ApplyEnvironmentOverrides(config); err != nil {
		return nil, fmt.Errorf("failed to apply environment overrides: %w", err)
	}

	return config, nil
}

// GetEnvString gets a string environment variable with default value
func GetEnvString(key, defaultValue string) string {
	if value := os.Getenv(key); value != "" {
		return value
	}
	return defaultValue
}

// GetEnvInt gets an integer environment variable with default value
func GetEnvInt(key string, defaultValue int) int {
	if value := os.Getenv(key); value != "" {
		if intValue, err := strconv.Atoi(value); err == nil {
			return intValue
		}
	}
	return defaultValue
}

// GetEnvInt64 gets an int64 environment variable with default value
func GetEnvInt64(key string, defaultValue int64) int64 {
	if value := os.Getenv(key); value != "" {
		if intValue, err := strconv.ParseInt(value, 10, 64); err == nil {
			return intValue
		}
	}
	return defaultValue
}

// GetEnvBool gets a boolean environment variable with default value
func GetEnvBool(key string, defaultValue bool) bool {
	if value := os.Getenv(key); value != "" {
		switch strings.ToLower(value) {
		case "true", "1", "yes", "on", "enabled":
			return true
		case "false", "0", "no", "off", "disabled":
			return false
		}
	}
	return defaultValue
}

// GetEnvFloat64 gets a float64 environment variable with default value
func GetEnvFloat64(key string, defaultValue float64) float64 {
	if value := os.Getenv(key); value != "" {
		if floatValue, err := strconv.ParseFloat(value, 64); err == nil {
			return floatValue
		}
	}
	return defaultValue
}

// GetEnvStringSlice gets a comma-separated string slice from environment variable
func GetEnvStringSlice(key string, defaultValue []string) []string {
	if value := os.Getenv(key); value != "" {
		parts := strings.Split(value, ",")
		result := make([]string, len(parts))
		for i, part := range parts {
			result[i] = strings.TrimSpace(part)
		}
		return result
	}
	return defaultValue
}

// SetEnvFromConfig sets environment variables from a configuration (for testing)
func SetEnvFromConfig(config *Config) {
	// Network settings
	os.Setenv(EnvNetworkPort, strconv.Itoa(config.Network.Port))
	if len(config.Network.Seeds) > 0 {
		os.Setenv(EnvNetworkSeeds, strings.Join(config.Network.Seeds, ","))
	}
	os.Setenv(EnvNetworkMaxPeers, strconv.Itoa(config.Network.MaxPeers))
	os.Setenv(EnvTestNet, strconv.FormatBool(config.Network.TestNet))
	os.Setenv(EnvListenAddr, config.Network.ListenAddr)
	os.Setenv(EnvExternalIP, config.Network.ExternalIP)

	// RPC settings
	os.Setenv(EnvRPCEnabled, strconv.FormatBool(config.RPC.Enabled))
	os.Setenv(EnvRPCPort, strconv.Itoa(config.RPC.Port))
	os.Setenv(EnvRPCHost, config.RPC.Host)
	os.Setenv(EnvRPCUsername, config.RPC.Username)
	os.Setenv(EnvRPCPassword, config.RPC.Password)
	os.Setenv(EnvRPCMaxClients, strconv.Itoa(config.RPC.MaxClients))

	// Staking settings
	os.Setenv(EnvStakingEnabled, strconv.FormatBool(config.Staking.Enabled))
	os.Setenv(EnvStakingReserveBalance, strconv.FormatInt(config.Staking.ReserveBalance, 10))

	// Masternode settings
	os.Setenv(EnvMasternodeEnabled, strconv.FormatBool(config.Masternode.Enabled))
	os.Setenv(EnvMasternodePrivateKey, config.Masternode.PrivateKey)
	os.Setenv(EnvMasternodeServiceAddr, config.Masternode.ServiceAddr)
	os.Setenv(EnvMasternodeMnConf, config.Masternode.MnConf)
	os.Setenv(EnvMasternodeMnConfLock, strconv.FormatBool(config.Masternode.MnConfLock))

	// Logging settings
	os.Setenv(EnvLoggingLevel, config.Logging.Level)
	os.Setenv(EnvLoggingFormat, config.Logging.Format)
	os.Setenv(EnvLoggingOutput, config.Logging.Output)
}

// ClearEnvironmentOverrides clears all FIX environment variables (for testing)
func ClearEnvironmentOverrides() {
	envVars := []string{
		EnvNetworkPort, EnvNetworkSeeds, EnvNetworkMaxPeers, EnvTestNet,
		EnvListenAddr, EnvExternalIP,
		EnvRPCEnabled, EnvRPCPort, EnvRPCHost, EnvRPCUsername, EnvRPCPassword,
		EnvRPCMaxClients,
		EnvMasternodeEnabled, EnvMasternodePrivateKey,
		EnvMasternodeServiceAddr, EnvMasternodeMnConf, EnvMasternodeMnConfLock,
		EnvStakingEnabled, EnvStakingReserveBalance,
		EnvLoggingLevel, EnvLoggingFormat, EnvLoggingOutput,
		EnvDataDir,
	}

	for _, envVar := range envVars {
		os.Unsetenv(envVar)
	}
}

// LoadFromEnvironment loads configuration entirely from environment variables
func LoadFromEnvironment() (*Config, error) {
	// Start with defaults
	config := DefaultConfig()

	// Apply environment overrides
	if err := ApplyEnvironmentOverrides(config); err != nil {
		return nil, err
	}

	return config, nil
}

// GetEnvironmentOverrides returns all FIX_* environment variables
func GetEnvironmentOverrides() map[string]string {
	overrides := make(map[string]string)

	for _, env := range os.Environ() {
		if strings.HasPrefix(env, "FIX_") {
			parts := strings.SplitN(env, "=", 2)
			if len(parts) == 2 {
				overrides[parts[0]] = parts[1]
			}
		}
	}

	return overrides
}

// GetLegacyEnvironmentSupport returns mappings from legacy env vars to new ones
func GetLegacyEnvironmentSupport() map[string]string {
	return map[string]string{
		"FIX_PORT":     "FIX_NETWORK_PORT",
		"FIX_TESTNET":  "FIX_NETWORK_TESTNET",
		"FIX_DATADIR":  "FIX_DATABASE_PATH",
		"FIX_LOGLEVEL": "FIX_LOGGING_LEVEL",
	}
}

// EnvironmentVariable represents a supported environment variable
type EnvironmentVariable struct {
	Name        string
	Description string
	Type        string
	Default     interface{}
}

// GetSupportedEnvironmentVariables returns all supported environment variables.
// Names match the constants defined at the top of this file.
func GetSupportedEnvironmentVariables() []EnvironmentVariable {
	return []EnvironmentVariable{
		{EnvNetworkPort, "P2P network port", "int", MainnetP2PPort},
		{EnvNetworkMaxPeers, "Maximum number of peers", "int", 125},
		{EnvTestNet, "Enable testnet mode", "bool", false},
		{EnvListenAddr, "Listen address for P2P", "string", "0.0.0.0"},
		{EnvExternalIP, "External IP address", "string", ""},
		{EnvNetworkTimeout, "Network timeout in seconds", "int", 5},
		{EnvNetworkKeepAlive, "Keep-alive interval in seconds", "int", 120},

		{EnvRPCEnabled, "Enable RPC server", "bool", true},
		{EnvRPCPort, "RPC server port", "int", MainnetRPCPort},
		{EnvRPCHost, "RPC server host", "string", "127.0.0.1"},
		{EnvRPCUsername, "RPC username", "string", ""},
		{EnvRPCPassword, "RPC password", "string", ""},
		{EnvRPCMaxClients, "Maximum RPC clients", "int", 100},

		{EnvStakingEnabled, "Enable staking", "bool", false},
		{EnvStakingReserveBalance, "Amount to reserve from staking (satoshis)", "int64", int64(0)},

		{EnvMasternodeEnabled, "Enable masternode", "bool", false},
		{EnvMasternodePrivateKey, "Masternode private key", "string", ""},
		{EnvMasternodeServiceAddr, "Masternode service address", "string", ""},
		{EnvMasternodeMnConf, "Masternode config file", "string", "masternode.conf"},
		{EnvMasternodeMnConfLock, "Lock masternode collateral UTXOs", "bool", true},

		{EnvLoggingLevel, "Log level", "string", "error"},
		{EnvLoggingFormat, "Log format (text/json)", "string", "text"},
		{EnvLoggingOutput, "Log output (stdout/stderr/file)", "string", "./fix.log"},
	}
}
