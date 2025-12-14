# QTC Quantum-Safe Wallet Generation (Q4)

This directory contains JavaScript implementations of QTC's quantum-safe wallet generation methods using Kyber1024 KEM and Dilithium3 signatures.

## Files

### Core Implementations
- **`qti2.js`** - Primary Wallet Method (QTC Core Option 1)
- **`qti3.js`** - Single PQ-HD Wallet Method (QTC Core Option 2, external PQ-HD)
- **`qti3_hd.js`** - Multi-Address PQ-HD HD Wallet (QTC Core Option 2)
- **`qti4.js`** - Quantum Mnemonic Wallet (QTC Core Option 3) - *In parent directory*
- **`compare_wallets.js`** - Comparison script between methods

### Dependencies
- **`noble-post-quantum JS/`** - Production-grade post-quantum cryptography library
- **`package.json`** - Node.js dependencies (bech32, sha3)

## Usage

### Generate Primary Wallet (Option 1)
```bash
node qti2.js
```
Creates: `qti2_wallet.json`
- Witness version: 1
- Dilithium keys: Deterministic from Kyber shared secret
- Address: SHA3-256(Dilithium Public Key)
- Purpose: Primary QTC address generation method

### Generate Single PQ-HD Wallet (Option 2)
```bash
node qti3.js
```
Creates: `qti3_pqhd_wallet.json`
- Witness version: 2
- Dilithium keys: **Deterministic** from Kyber shared secret
- Address: SHA3-256(Master Entropy)
- Purpose: External wallet integration

### Generate Multi-Address PQ-HD HD Wallet (Option 2)
```bash
# Generate 10 PQ-HD addresses (default behavior)
node qti3_hd.js

# Generate 10 addresses for account 0, change 0 (explicit)
node qti3_hd.js 10 0 0

# Generate 5 addresses for account 1, change 1
node qti3_hd.js 5 1 1

# Generate 20 addresses for account 0, change 0
node qti3_hd.js 20 0 0
```

**Default Behavior**: qti3_hd.js generates 10 addresses for account 0, change 0

### Generate Quantum Mnemonic Wallet (Option 3)
```bash
# Generate 24-word mnemonic wallet (maximum security - default)
node ../qti4.js MAXIMUM

# Generate 12-word mnemonic wallet (standard security)
node ../qti4.js STANDARD

# Generate 18-word mnemonic wallet (high security)
node ../qti4.js HIGH

# Generate 36-word mnemonic wallet (ultra security)
node ../qti4.js ULTRA
```
Creates: `qti4_quantum_mnemonic_wallet.json`
- Witness version: 3
- Dilithium keys: Deterministic from mnemonic-derived seed
- Address: SHA3-256(MasterSeed + SharedSecret + DilithiumPK)
- Purpose: Mnemonic phrase backup and recovery

### Custom Address Generation
```bash
# Generate 3 addresses for account 0, change 0
node qti3_hd.js 3 0 0

# Generate 10 addresses for account 2, change 1
node qti3_hd.js 10 2 1
```

### Compare Both Methods
```bash
node compare_wallets.js
```
Shows detailed comparison between Primary and PQ-HD methods.

## Key Differences

| Feature | Primary (qti2.js) | PQ-HD (qti3.js) | Mnemonic (qti4.js) [DEPRECATED] |
|---------|-------------------|------------------|-------------------|
| Method | QTC Core Option 1 | QTC Core Option 2 | QTC Core Option 3 |
| Witness Version | 1 | 2 | 3 |
| Dilithium Keys | Deterministic | **Deterministic** | Deterministic |
| Entropy Source | Kyber Shared Secret | Combined Input | Mnemonic + Combined |
| Address Generation | SHA3-256(Dilithium) | SHA3-256(Master) | SHA3-256(Combined) |
| Purpose | Primary Method | External Wallets | Mnemonic Backup |

## Security

Both methods provide quantum-safe security using:
- ✅ **Kyber1024 KEM**: NIST-selected quantum-safe key encapsulation
- ✅ **Dilithium3**: NIST-selected quantum-safe digital signatures  
- ✅ **SHA3-512/256**: Quantum-resistant hash functions
- ✅ **bech32m Encoding**: Error-correcting address format

### ✅ **Deterministic Key Generation (FIXED)**
- **All Options**: Now use deterministic key generation
- **Option 1**: Dilithium derived from Kyber shared secret
- **Option 2**: Dilithium derived from Kyber shared secret (FIXED)
- **Option 3**: Dilithium derived from mnemonic seed

### 🔧 **HD Wallet Security (✅)**
- **Hierarchical Derivation**: SHA3-512(master_entropy || path || index)
- **Deterministic**: Same master → same addresses
- **Quantum-safe**: Inherits security from Kyber KEM

## Compatibility

All three wallet types are fully compatible with QTC network:
- Addresses use bech32m encoding with "qtc" prefix
- Witness versions (1, 2, and 3) distinguish wallet types
- All transactions are quantum-safe
- All support Kyber1024 KEM for encrypted communications
- All use deterministic key generation for reproducibility

## Integration

### For QTC Core Integration
- Use Primary Method (qti2.js) for native wallet generation
- Matches QTC Core's `QtcPrimaryWallet::GenerateWallet()`

### For External Wallet Integration
- Use PQ-HD Method (qti3.js/qti3_hd.js) for external wallet compatibility
- Matches QTC Core's `QtcPQHDWallet::GeneratePQHDWallet()`

## Dependencies Installation

```bash
npm install
```

## Requirements

- Node.js 16+ with ES modules support
- 64-bit system for optimal performance
- Secure random number generator (CSPRNG)

## CLI Usage Examples

### Single Address Generation
```bash
# Generate primary wallet (Method 1)
node qti2.js

# Generate single PQ-HD wallet (Method 2)
node qti3.js
```

### Multi-Address HD Wallet Generation
```bash
# Generate 10 PQ-HD addresses (default)
node qti3_hd.js

# Generate 10 addresses for account 0, change 0 (explicit)
node qti3_hd.js 10 0 0

# Generate 5 addresses for account 1, change 1
node qti3_hd.js 5 1 1

# Generate 20 addresses for account 0, change 0
node qti3_hd.js 20 0 0

# Generate 3 addresses for account 0, change 0
node qti3_hd.js 3 0 0

# Generate 10 addresses for account 2, change 1
node qti3_hd.js 10 2 1
```

### Advanced Usage
```bash
# Generate custom number of addresses
node qti3_hd.js 15 0 0

# Generate addresses for specific account and change
node qti3_hd.js 8 2 1
```

## HD Path Structure

- **Format**: `m/44'/account'/change/index`
- **Account**: BIP-44 style account derivation
- **Change**: 0 = receiving, 1 = change
- **Index**: Sequential address index

## Security Best Practices

- **Backup**: Store master keys securely
- **Recovery**: Use master entropy for wallet recovery
- **Isolation**: Each address has independent Dilithium keys
- **Quantum Safety**: All addresses inherit quantum security from Kyber1024 KEM

## Wallet Operations (external JS + QTC Core)

Requirements
- Running qtcd with -server, rpcuser/rpcpassword (or cookie auth), and your wallet loaded
- qti2.js (Option 1) or qti3.js (Option 2) updated with JSON-RPC support

Addresses
- Option 1 (Priority 1): bech32m hrp "qtc", witness v=1
- Option 2 (Priority 2): bech32m hrp "qtc", witness v=2
- Testnet: recommend a distinct HRP (e.g., "tqtc"). Until defined, balances are scoped by chain mode (-testnet), but HRP will look the same.

Balance (watch-only)
```bash
node qti2.js import-address --address <qtcAddress> --label watch --rescan true --rpc http://127.0.0.1:8332 --rpcuser user --rpcpass pass
node qti2.js balance --address <qtcAddress> --rpc http://127.0.0.1:8332 --rpcuser user --rpcpass pass
```

Send (Core signs)
```bash
node qti2.js import-privkey --privkey <priv> --label mykey --rescan true --rpc ...
node qti2.js send --to <destQtcAddress> --amount <QTC> --rpc ...
```

Raw transaction workflow (via JSON-RPC)
```bash
# Build raw skeleton
node qti2.js create-raw --inputs '[{"txid":"...","vout":0}]' --outputs '{"<destQtcAddress>":1.23}' --rpc ...
# Let Core fund it (adds inputs/change)
node qti2.js fund-raw --hex <hex> --rpc ...
# Sign with wallet
node qti2.js sign-raw --hex <fundedHex> --rpc ...
# Broadcast
node qti2.js broadcast --hex <signedHex> --rpc ...
```

Notes


- Both methods are production-ready and match QTC Core C++ implementations
- Private keys are stored in base64 format for easy integration
- Shared secrets are included for debugging and verification
- All cryptographic operations use constant-time implementations