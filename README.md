
# QTC Quantum-Safe Wallet CLI

This command-line interface (CLI) tool generates a quantum-safe wallet using post-quantum cryptographic algorithms. It is written in pure JavaScript and uses the `noble-post-quantum` library for its cryptographic primitives.

## Features

*   **Quantum-Safe:** Utilizes ML-KEM (Kyber) and ML-DSA (Dilithium) to protect against threats from quantum computers.
*   **Key Encapsulation:** Uses **Kyber1024** (ML-KEM-1024) to securely establish a shared secret.
*   **Digital Signatures:** Employs **Dilithium3** (ML-DSA-65) for strong, quantum-resistant digital signatures.
*   **Deterministic Key Generation:** Derives Dilithium keys from the Kyber shared secret, ensuring that the same keys can be regenerated from the same initial entropy.
*   **Bech32 Address:** Generates a human-readable `qtc` address from the Dilithium public key.

## Getting Started

Follow these instructions to generate your own quantum-safe wallet.

### Prerequisites

*   [Node.js](https://nodejs.org/) (version 20.19.0 or higher)
*   [npm](https://www.npmjs.com/) (usually included with Node.js)

### Installation & Setup

1.  **Clone the repository or download the source code.**

2.  **Install dependencies:**
    Navigate into the `noble-post-quantum JS` directory and install the required packages.
    ```bash
    cd "noble-post-quantum JS"
    npm install
    ```

3.  **Build the project:**
    Compile the necessary TypeScript files into JavaScript.
    ```bash
    npm run build
    ```

4.  **Return to the root directory:**
    ```bash
    cd ..
    npm i sha3 bech32
    ```

### Generate Your Wallet

Run the `qti2.js` script from the root directory to generate your wallet.

```bash
node qti2.js
```

The script will output the wallet details to your console and save them to a file named `qti2_wallet.json`.

## Wallet Output

The generated `qti2_wallet.json` file contains your address and keys.

```json
{
  "address": "qtc1...",
  "entropy_b64": "...",
  "kyber_public_b64": "...",
  "kyber_private_b64": "...",
  "dilithium_public_b64": "...",
  "dilithium_private_b64": "...",
  "shared_secret_b64": "..."
}
```

### Understanding the Components

*   **`address`**: Your public quantum-safe address, prefixed with `qtc`. This is what you would share to receive funds or verify signatures. It is derived from a SHA3-256 hash of your Dilithium public key.
*   **`entropy_b64`**: A base64-encoded random value derived from the Kyber shared secret. This is used as a seed to deterministically generate the Dilithium keypair.
*   **`kyber_public_b64` / `kyber_private_b64`**: Your Kyber (ML-KEM) keypair.
    *   The **public key** is used by others to create a shared secret with you.
    *   The **private key** is used by you to decapsulate the shared secret. **Keep this secret.**
*   **`dilithium_public_b64` / `dilithium_private_b64`**: Your Dilithium (ML-DSA) keypair.
    *   The **public key** is used by others to verify your digital signatures.
    *   The **private key** is used by you to sign transactions or messages. **Keep this secret.**
*   **`shared_secret_b64`**: The secret value established through the Kyber key encapsulation process. It links the Kyber and Dilithium keys together.


