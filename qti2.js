/**
 * QTC Quantum-Safe Wallet CLI (Pure JS)
 * Generates a quantum-safe address and keys using Kyber1024 and Dilithium3.
 * This version uses the production-grade noble-post-quantum JS libraries.
 */

import { bech32 } from "bech32";
import { SHA3 } from "sha3";

// --- Main async function
async function generateWallet() {
  console.error("--- Starting Quantum-Safe Wallet Generation (using noble-post-quantum) ---");

  // Dynamic imports for crypto and fs
  const crypto = await import("crypto");
  const fs = await import("fs");

  // Dynamic imports for noble-post-quantum libraries
  const { ml_kem1024 } = await import("./noble-post-quantum JS/src/ml-kem.js");
  const { ml_dsa65 } = await import("./noble-post-quantum JS/src/ml-dsa.js");

  // --- 1. Generate Kyber Keypair and Shared Secret
  let kyber_pk, kyber_sk, sharedSecret;
  try {
    // Generate a random seed for Kyber key generation
    const kyber_seed = crypto.randomBytes(64);
    const kyberKeyPair = ml_kem1024.keygen(kyber_seed);
    kyber_pk = kyberKeyPair.publicKey;
    kyber_sk = kyberKeyPair.secretKey;
    
    const { cipherText: cipher, sharedSecret: ss1 } = ml_kem1024.encapsulate(kyber_pk);
    const ss2 = ml_kem1024.decapsulate(cipher, kyber_sk);
    
    // The shared secret is the same from encapsulate and decapsulate
    sharedSecret = Buffer.from(ss1);
    
    console.error("[✓] Kyber KEM completed, shared secret established.");
  } catch (err) {
    console.error("[ERROR] Kyber operation failed:", err);
    process.exit(1);
  }

  // --- 2. Derive Entropy for Deterministic Dilithium Key Generation
  const entropy = crypto.createHash("sha3-512").update(sharedSecret).digest();
  console.error(`[✓] Entropy derived (SHA3-512): ${entropy.toString("hex").slice(0, 32)}...`);

  // --- 3. Generate Dilithium3 Keypair
  let dilithium_pk, dilithium_sk;
  try {
    // The keygen function takes a seed. We will use the first 32 bytes of the entropy.
    const dilithiumKeyPair = ml_dsa65.keygen(entropy.slice(0, 32));
    dilithium_pk = dilithiumKeyPair.publicKey;
    dilithium_sk = dilithiumKeyPair.secretKey;
    console.error("[✓] Dilithium3 deterministic keypair generated.");
  } catch (err) {
    console.error("[ERROR] Dilithium key generation failed:", err);
    process.exit(1);
  }

  // --- 4. Generate QTC Address from Dilithium Public Key
  // a) Hash the Dilithium public key using SHA3-256
  const hash = new SHA3(256);
  hash.update(Buffer.from(dilithium_pk));
  const pkHash = hash.digest();

  // b) Get the first 20 bytes (160 bits) of the hash
  const addressBytes = pkHash.slice(0, 20);

  // c) Convert to bech32 words and encode
  const words = bech32.toWords(addressBytes);
  const address = bech32.encode("qtc", words);
  console.error(`[✓] Generated QTC Address: ${address}`);

  // --- 5. Assemble the final wallet JSON
  const wallet = {
    address: address,
    entropy_b64: entropy.toString("base64"),
    kyber_public_b64: Buffer.from(kyber_pk).toString("base64"),
    kyber_private_b64: Buffer.from(kyber_sk).toString("base64"),
    dilithium_public_b64: Buffer.from(dilithium_pk).toString("base64"),
    dilithium_private_b64: Buffer.from(dilithium_sk).toString("base64"),
    shared_secret_b64: sharedSecret.toString("base64"),
  };

  // --- 6. Save to file and print
  try {
    fs.writeFileSync("qti2_wallet.json", JSON.stringify(wallet, null, 2));
    console.error("\n[SUCCESS] Wallet generated and saved to 'qti2_wallet.json'");
    // ONLY print the JSON to stdout
    console.log(JSON.stringify(wallet, null, 2));
  } catch (err) {
    console.error("[ERROR] Could not write wallet file:", err);
    process.exit(1); // Exit with error if file write fails
  }
  
  console.error("\n--- Generation Complete ---");
}

// --- Execute the main function
generateWallet().catch(err => {
  console.error("\n--- An unexpected error occurred ---");
  console.error(err);
  process.exit(1);
});
