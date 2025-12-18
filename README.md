# QTC CLI Documentation

## Overview
The QTC wallet scripts (`qti2.js`, `qti3.js`, `qti3_hd.js`) have been upgraded to eliminate the dependency on the pure JavaScript `noble-post-quantum` library. They now exclusively use the `liboqs` C library via a custom-built CLI tool (`oqs_wallet_cli`).

## Upgraded Scripts

### 1. `qti2.js`
- **Purpose:** Standard Quantum-Safe Wallet Generation (Kyber1024 + Dilithium3).
- **Upgrade:** 
    - Replaced `noble-post-quantum` with `oqs_wallet_cli` for key generation.
    - Added `ensureCliBuilt()` to automatically compile `oqs_wallet_cli` if missing.
    - Added support for Windows compilation via `build_cli_win.bat` (MSVC).

### 2. `qti3.js`
- **Purpose:** PQ-HD Wallet Generation (Deterministic generation with version 2 witness program).
- **Upgrade:**
    - Standardized `ensureCliBuilt()` logic to match `qti2.js`.
    - Switched Dilithium generation to use `oqs_wallet_cli`.
    - Updated logging to reflect the use of `liboqs`.

### 3. `qti3_hd.js`
- **Purpose:** Hierarchical Deterministic (HD) Quantum Wallet Generation.
- **Upgrade:**
    - Removed all imports of `noble-post-quantum JS`.
    - Implemented `ensureCliBuilt()` for reliable CLI access on all platforms.
    - Updated `generateMaster()` to use `oqs_wallet_cli` for the master Dilithium key.
    - Updated `QTCHDNode.generateKeyPair()` to use `oqs_wallet_cli` for derived keys.

## Technical Details

### `oqs_wallet_cli`
This is a small C++ wrapper around `liboqs` that provides deterministic key generation for:
- **ML-KEM-1024 (Kyber1024)**: `kem_self_from_seed`
- **ML-DSA-65 (Dilithium3)**: `gen_dilithium_from_seed`

The CLI is built automatically when running any of the `qti*.js` scripts.

### Windows Support
- **Compiler:** Uses `cl.exe` (Visual Studio MSVC).
- **Script:** `build_cli_win.bat` sets up the environment (vcvars64) and compiles the CLI.
- **Libraries:** Links against `oqs.lib` and `Advapi32.lib`.

### Linux/macOS Support
- **Compiler:** Uses `g++` or `clang++`.
- **Script:** Uses the existing `Makefile`.

## Usage
Run the scripts as normal:
```bash
node qti2.js
node qti3.js
node qti3_hd.js
```
The scripts will handle the compilation and execution automatically.
