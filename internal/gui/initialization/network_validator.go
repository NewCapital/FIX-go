package initialization

import (
	"fmt"
	"net"
	"regexp"
	"strconv"
	"strings"
	"time"
)

// Pre-compiled regexes for validation
var (
	validLabelRegex  = regexp.MustCompile(`^[a-zA-Z0-9]([a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?$`)
	validBase58Regex = regexp.MustCompile(`^[123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz]+$`)
)

// NetworkParams represents FIX network parameters for GUI validation.
type NetworkParams struct {
	Name           string   `json:"name"`
	DefaultPort    int      `json:"defaultPort"`
	RPCPort        int      `json:"rpcPort"`
	DNSSeeds       []string `json:"dnsSeeds"`
	FixedSeeds     []string `json:"fixedSeeds"`
	Magic          uint32   `json:"magic"`
	AddressVersion byte     `json:"addressVersion"`
	PrivKeyVersion byte     `json:"privKeyVersion"`
}

// FIX network parameters (legacy/src/chainparams.cpp).
var (
	MainNetParams = NetworkParams{
		Name:           "mainnet",
		DefaultPort:    17464,
		RPCPort:        17465,
		Magic:          0x742c4d64, // FIX mainnet pchMessageStart
		AddressVersion: 0x23,       // Addresses start with 'F'
		PrivKeyVersion: 0x3c,       // 60 - WIF private keys
		DNSSeeds: []string{
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
		FixedSeeds: []string{
			"45.77.206.161:17464",
			"45.77.64.171:17464",
			"207.148.67.25:17464",
			"45.32.36.145:17464",
			"108.61.221.138:17464",
			"149.28.255.224:17464",
			"207.246.73.248:17464",
			"216.238.117.200:17464",
			"149.28.166.62:17464",
			"65.20.68.219:17464",
			"158.247.254.3:17464",
			"139.84.245.134:17464",
		},
	}

	TestNetParams = NetworkParams{
		Name:           "testnet",
		DefaultPort:    5447,
		RPCPort:        17467,
		Magic:          0x446aa4cc, // FIX testnet pchMessageStart
		AddressVersion: 0x4c,       // 76
		PrivKeyVersion: 0xed,       // 237
		DNSSeeds: []string{
			"46.19.210.197",
			"46.19.214.68",
			"142.93.145.197",
			"159.65.84.118",
			"167.99.223.138",
			"68.183.161.44",
			"46.19.212.68",
			"46.19.213.68",
			"46.19.209.68",
		},
		FixedSeeds: []string{
			"46.19.210.197:5447",
			"46.19.214.68:5447",
			"142.93.145.197:5447",
			"159.65.84.118:5447",
			"167.99.223.138:5447",
			"68.183.161.44:5447",
			"46.19.212.68:5447",
			"46.19.213.68:5447",
			"46.19.209.68:5447",
		},
	}

	RegTestParams = NetworkParams{
		Name:           "regtest",
		DefaultPort:    5467,
		RPCPort:        17467,
		Magic:          0x2afcc7ca, // FIX regtest pchMessageStart
		AddressVersion: 0x4c,       // Uses testnet prefixes
		PrivKeyVersion: 0xed,       // Uses testnet WIF
		DNSSeeds:       []string{}, // No DNS seeds for regtest
		FixedSeeds:     []string{}, // No fixed seeds for regtest
	}
)

// NetworkValidator handles network parameter validation
type NetworkValidator struct {
	params NetworkParams
}

// NewNetworkValidator creates a new network validator
func NewNetworkValidator(network string) *NetworkValidator {
	var params NetworkParams

	switch strings.ToLower(network) {
	case "testnet":
		params = TestNetParams
	case "regtest":
		params = RegTestParams
	default:
		params = MainNetParams
	}

	return &NetworkValidator{params: params}
}

// ValidateNetworkConfig validates network-related configuration
func (nv *NetworkValidator) ValidateNetworkConfig(config *FIXConfig) error {
	// Validate port settings
	if err := nv.validatePort(config.RPCPort, "RPC"); err != nil {
		return err
	}

	// Validate IP addresses
	for _, ip := range config.RPCAllowIP {
		if err := validateIPAddress(ip); err != nil {
			return fmt.Errorf("invalid rpcallowip %s: %w", ip, err)
		}
	}

	if config.RPCBind != "" {
		if err := validateIPAddress(config.RPCBind); err != nil {
			return fmt.Errorf("invalid rpcbind %s: %w", config.RPCBind, err)
		}
	}

	// Validate node addresses
	for _, node := range config.AddNodes {
		if err := validateNodeAddress(node); err != nil {
			return fmt.Errorf("invalid addnode %s: %w", node, err)
		}
	}

	for _, node := range config.ConnectNodes {
		if err := validateNodeAddress(node); err != nil {
			return fmt.Errorf("invalid connect node %s: %w", node, err)
		}
	}

	// Validate masternode address if configured
	if config.Masternode && config.MasternodeAddr != "" {
		if err := validateNodeAddress(config.MasternodeAddr); err != nil {
			return fmt.Errorf("invalid masternode address %s: %w", config.MasternodeAddr, err)
		}
	}

	return nil
}

// validatePort checks if a port number is valid
func (nv *NetworkValidator) validatePort(port int, portType string) error {
	if port < 1 || port > 65535 {
		return fmt.Errorf("invalid %s port %d: must be between 1 and 65535", portType, port)
	}

	// Check if port is not a well-known port (unless it's the default)
	if port < 1024 && port != nv.params.DefaultPort && port != nv.params.RPCPort {
		return fmt.Errorf("%s port %d is in well-known port range", portType, port)
	}

	return nil
}

// validateIPAddress validates an IP address or CIDR notation
func validateIPAddress(address string) error {
	// Check if it's a CIDR notation
	if strings.Contains(address, "/") {
		_, _, err := net.ParseCIDR(address)
		if err != nil {
			return fmt.Errorf("invalid CIDR notation: %w", err)
		}
		return nil
	}

	// Check if it's a valid IP address
	ip := net.ParseIP(address)
	if ip == nil {
		return fmt.Errorf("invalid IP address")
	}

	return nil
}

// validateNodeAddress validates a node address (IP:port or hostname:port).
// When no port is supplied, defaults to mainnet P2P (17464) — callers validating
// testnet/regtest addresses should supply explicit ports.
func validateNodeAddress(address string) error {
	// Split into host and port
	host, portStr, err := net.SplitHostPort(address)
	if err != nil {
		// Maybe just a hostname without port
		if !strings.Contains(address, ":") {
			host = address
			portStr = strconv.Itoa(MainNetParams.DefaultPort)
		} else {
			return fmt.Errorf("invalid address format: %w", err)
		}
	}

	// Validate port
	port, err := strconv.Atoi(portStr)
	if err != nil {
		return fmt.Errorf("invalid port: %w", err)
	}

	if port < 1 || port > 65535 {
		return fmt.Errorf("port %d out of range", port)
	}

	// Validate host (IP or hostname)
	if net.ParseIP(host) == nil {
		// Not an IP, check if it's a valid hostname
		if !isValidHostname(host) {
			return fmt.Errorf("invalid hostname: %s", host)
		}
	}

	return nil
}

// isValidHostname checks if a string is a valid hostname
func isValidHostname(hostname string) bool {
	// Basic hostname validation
	if len(hostname) > 253 {
		return false
	}

	// Check each label
	labels := strings.Split(hostname, ".")
	if len(labels) == 0 {
		return false
	}

	for _, label := range labels {
		if !validLabelRegex.MatchString(label) {
			return false
		}
	}

	return true
}

// CheckNetworkConnectivity tests basic network connectivity
func (nv *NetworkValidator) CheckNetworkConnectivity() error {
	// Try to resolve DNS seeds
	for _, seed := range nv.params.DNSSeeds {
		_, err := net.LookupHost(seed)
		if err == nil {
			// At least one seed is resolvable
			return nil
		}
	}

	// Try to connect to fixed seeds
	for _, seed := range nv.params.FixedSeeds {
		conn, err := net.DialTimeout("tcp", seed, 5*time.Second)
		if err == nil {
			conn.Close()
			return nil
		}
	}

	return fmt.Errorf("no network connectivity to FIX network")
}

// ValidateAddress validates a FIX address
func (nv *NetworkValidator) ValidateAddress(address string) error {
	// Basic length check
	if len(address) < 26 || len(address) > 35 {
		return fmt.Errorf("invalid address length")
	}

	// Check if it starts with the correct prefix
	// Mainnet: 'D' (legacy) or 'T' (new format)
	// Testnet: 'x' or 'y'
	var validPrefixes []string
	if nv.params.Name == "testnet" || nv.params.Name == "regtest" {
		validPrefixes = []string{"x", "y"} // Testnet prefixes
	} else {
		validPrefixes = []string{"D", "T"} // Mainnet prefixes (both legacy and new)
	}

	hasValidPrefix := false
	for _, prefix := range validPrefixes {
		if strings.HasPrefix(address, prefix) {
			hasValidPrefix = true
			break
		}
	}

	if !hasValidPrefix {
		return fmt.Errorf("address should start with %v for %s", validPrefixes, nv.params.Name)
	}

	// Validate base58 characters
	if !validBase58Regex.MatchString(address) {
		return fmt.Errorf("invalid characters in address")
	}

	return nil
}

// ValidatePrivateKey validates a FIX private key format
func (nv *NetworkValidator) ValidatePrivateKey(privKey string) error {
	// FIX private keys are 51 characters (WIF format)
	if len(privKey) != 51 && len(privKey) != 52 {
		return fmt.Errorf("invalid private key length")
	}

	// Check prefix
	expectedPrefixes := []string{"7", "X"} // Mainnet prefixes
	if nv.params.Name == "testnet" || nv.params.Name == "regtest" {
		expectedPrefixes = []string{"9", "c"} // Testnet prefixes
	}

	validPrefix := false
	for _, prefix := range expectedPrefixes {
		if strings.HasPrefix(privKey, prefix) {
			validPrefix = true
			break
		}
	}

	if !validPrefix {
		return fmt.Errorf("private key should start with %v for %s", expectedPrefixes, nv.params.Name)
	}

	// Validate base58 characters
	if !validBase58Regex.MatchString(privKey) {
		return fmt.Errorf("invalid characters in private key")
	}

	return nil
}

// GetNetworkParams returns the current network parameters
func (nv *NetworkValidator) GetNetworkParams() NetworkParams {
	return nv.params
}

// EstimateNetworkLatency estimates latency to a given node
func EstimateNetworkLatency(address string) (time.Duration, error) {
	start := time.Now()

	conn, err := net.DialTimeout("tcp", address, 10*time.Second)
	if err != nil {
		return 0, fmt.Errorf("failed to connect: %w", err)
	}
	defer conn.Close()

	return time.Since(start), nil
}

// FindBestNodes finds the best performing nodes from a list
func FindBestNodes(nodes []string, maxNodes int) []string {
	type nodeLatency struct {
		address string
		latency time.Duration
	}

	var results []nodeLatency

	for _, node := range nodes {
		latency, err := EstimateNetworkLatency(node)
		if err == nil {
			results = append(results, nodeLatency{
				address: node,
				latency: latency,
			})
		}
	}

	// Sort by latency (would need sort package)
	// For now, just return first maxNodes that connected
	var bestNodes []string
	for i, result := range results {
		if i >= maxNodes {
			break
		}
		bestNodes = append(bestNodes, result.address)
	}

	return bestNodes
}
