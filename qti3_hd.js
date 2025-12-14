/**
 * QTC Quantum-Safe PQ-HD HD Wallet CLI (Pure JS)
 * Generates multiple quantum-safe hierarchical deterministic addresses using Kyber1024 and Dilithium3.
 * This implements QTC Core Method 2: PQ-HD Wallet with HD derivation support.
 */

import { bech32 } from "bech32";
import { SHA3, SHAKE } from "sha3";

// --- HD Path Implementation for QTC
class QTCHDPath {
  constructor(purpose = 44, account = 0, change = 0, addressIndex = 0) {
    this.purpose = purpose;
    this.account = account;
    this.change = change;
    this.addressIndex = addressIndex;
  }

  toString() {
    return `m/${this.purpose}'/${this.account}'/${this.change}/${this.addressIndex}`;
  }

  static fromString(pathString) {
    const match = pathString.match(/^m\/(\d+)'\/(\d+)'\/(\d+)\/(\d+)$/);
    if (!match) throw new Error("Invalid HD path format");
    return new QTCHDPath(
      parseInt(match[1]),
      parseInt(match[2]), 
      parseInt(match[3]),
      parseInt(match[4])
    );
  }
}

// --- HD Node for hierarchical derivation
class QTCHDNode {
  constructor(masterEntropy, path) {
    this.masterEntropy = masterEntropy;
    this.path = path;
    this.chainCode = null;
    this.privateKey = null;
    this.publicKey = null;
  }

  // Derive child node using BIP32-like approach with quantum-safe hashing
  deriveChild(index) {
    const childPath = new QTCHDPath(
      this.path.purpose,
      this.path.account,
      this.path.change,
      index
    );

    // Create derivation data: parent entropy || path || index
    const pathData = Buffer.from(childPath.toString());
    const indexData = Buffer.alloc(4);
    indexData.writeUInt32BE(index, 0);

    const derivationData = Buffer.concat([
      this.masterEntropy,
      pathData,
      indexData
    ]);

    // Derive child entropy using SHA3-512
    const hash = new SHA3(512);
    hash.update(derivationData);
    const childEntropy = hash.digest();
    
    return new QTCHDNode(childEntropy, childPath);
  }

  // Generate Dilithium3 keypair from node entropy
  async generateKeyPair() {
    const crypto = await import("crypto");
    const { ml_dsa65 } = await import("./noble-post-quantum JS/src/ml-dsa.js");

    // Use first 32 bytes of node entropy as Dilithium seed
    const dilithiumSeed = this.masterEntropy.slice(0, 32);
    const keyPair = ml_dsa65.keygen(dilithiumSeed);
    
    this.privateKey = keyPair.secretKey;
    this.publicKey = keyPair.publicKey;
    
    return keyPair;
  }

  // Generate address from Dilithium public key
  generateAddress() {
    if (!this.publicKey) {
      throw new Error("Must generate keypair first");
    }

    // Hash Dilithium public key using SHA3-256
    const hash = new SHA3(256);
    hash.update(Buffer.from(this.publicKey));
    const publicKeyHash = hash.digest();

    // Take first 20 bytes for address
    const addressBytes = publicKeyHash.slice(0, 20);

    // Convert to bech32m with "qtc" prefix and witness version 2 (PQ-HD)
    const witnessVersion = 2;
    const witnessProgram = Array.from(addressBytes);
    const words = bech32.toWords(witnessProgram);
    const data = [witnessVersion, ...words];
    const address = bech32.encode("qtc", data);

    return address;
  }
}

// --- Main PQ-HD HD Wallet Class
class QTCPQHDWallet {
  constructor() {
    this.kyberPublicKey = null;
    this.kyberSecretKey = null;
    this.sharedSecret = null;
    this.masterEntropy = null;
    this.masterNode = null;
  }

  // Generate master wallet with Kyber1024 KEM
  async generateMaster() {
    console.error("--- Starting PQ-HD Master Wallet Generation ---");

    const crypto = await import("crypto");
    const { ml_kem1024 } = await import("./noble-post-quantum JS/src/ml-kem.js");

    // Step 1: Generate Kyber1024 keypair and shared secret
    const kyber_seed = crypto.randomBytes(64);
    const kyberKeyPair = ml_kem1024.keygen(kyber_seed);
    this.kyberPublicKey = kyberKeyPair.publicKey;
    this.kyberSecretKey = kyberKeyPair.secretKey;
    
    const { cipherText, sharedSecret: ss1 } = ml_kem1024.encapsulate(this.kyberPublicKey);
    const ss2 = ml_kem1024.decapsulate(cipherText, this.kyberSecretKey);
    this.sharedSecret = Buffer.from(ss1);
    
    console.error("[✓] Kyber KEM completed, shared secret established.");

    // Step 2: Generate deterministic Dilithium3 keypair from Kyber shared secret using SHAKE256
    const { ml_dsa65 } = await import("./noble-post-quantum JS/src/ml-dsa.js");
    const shake256 = new SHAKE(256);
    shake256.update(this.sharedSecret);
    shake256.update(Buffer.from("QTC_PQHD_DILITHIUM", "utf8"));
    const dilithium_seed = shake256.digest(32); // 32 bytes for Dilithium3
    const dilithiumKeyPair = ml_dsa65.keygen(dilithium_seed);
    const dilithiumPublicKey = dilithiumKeyPair.publicKey;

    console.error("[✓] Dilithium3 deterministic keypair generated.");

    // Step 3: Derive master entropy using SHA3-512(KyberSharedSecret || DilithiumPublicKey)
    const combinedInput = Buffer.concat([this.sharedSecret, Buffer.from(dilithiumPublicKey)]);
    const hash = new SHA3(512);
    hash.update(combinedInput);
    this.masterEntropy = hash.digest();
    
    console.error(`[✓] Master entropy derived (SHA3-512): ${this.masterEntropy.toString("hex").slice(0, 32)}...`);

    // Step 4: Create master HD node
    this.masterNode = new QTCHDNode(this.masterEntropy, new QTCHDPath());
    await this.masterNode.generateKeyPair();

    return {
      kyber_public_b64: Buffer.from(this.kyberPublicKey).toString("base64"),
      kyber_private_b64: Buffer.from(this.kyberSecretKey).toString("base64"),
      dilithium_public_b64: Buffer.from(dilithiumPublicKey).toString("base64"),
      dilithium_private_b64: Buffer.from(dilithiumKeyPair.secretKey).toString("base64"),
      kyber_shared_secret_b64: this.sharedSecret.toString("base64"),
      master_entropy_b64: this.masterEntropy.toString("base64"),
      combined_input_b64: combinedInput.toString("base64")
    };
  }

  // Generate multiple addresses from master
  async generateAddresses(count = 5, account = 0, change = 0) {
    if (!this.masterNode) {
      throw new Error("Must generate master wallet first");
    }

    console.error(`--- Generating ${count} PQ-HD addresses ---`);
    console.error(`Account: ${account}, Change: ${change}`);

    const addresses = [];
    
    for (let i = 0; i < count; i++) {
      // Derive child node
      const childNode = this.masterNode.deriveChild(i);
      await childNode.generateKeyPair();
      
      const address = childNode.generateAddress();
      const path = childNode.path.toString();
      
      addresses.push({
        index: i,
        path: path,
        address: address,
        dilithium_public_b64: Buffer.from(childNode.publicKey).toString("base64"),
        dilithium_private_b64: Buffer.from(childNode.privateKey).toString("base64")
      });
      
      console.error(`[✓] Address ${i}: ${address} (${path})`);
    }

    return addresses;
  }

  // Export complete wallet data
  exportWallet(addresses) {
    return {
      wallet_type: "QTC-PQHD-HD",
      version: "QTC-PQHD-2.0",
      algorithm: "Kyber1024-KEM + Dilithium3-DSA (Deterministic PQ-HD HD)",
      quantum_safe: true,
      witness_version: 2,
      
      // Master keys
      master: {
        kyber_public_b64: Buffer.from(this.kyberPublicKey).toString("base64"),
        kyber_private_b64: Buffer.from(this.kyberSecretKey).toString("base64"),
        kyber_shared_secret_b64: this.sharedSecret.toString("base64"),
        master_entropy_b64: this.masterEntropy.toString("base64")
      },
      
      // Derived addresses
      addresses: addresses,
      
      // Metadata
      total_addresses: addresses.length,
      derivation_method: "SHA3-512 hierarchical derivation",
      description: "QTC PQ-HD Hierarchical Deterministic Wallet for External Integration"
    };
  }
}

// --- CLI Interface
async function main() {
  const args = process.argv.slice(2);
  const count = parseInt(args[0]) || 5;
  const account = parseInt(args[1]) || 0;
  const change = parseInt(args[2]) || 0;

  console.error(`=== QTC PQ-HD HD Wallet Generator ===`);
  console.error(`Generating ${count} addresses for account ${account}, change ${change}\n`);

  const wallet = new QTCPQHDWallet();
  
  try {
    // Generate master wallet
    const masterData = await wallet.generateMaster();
    
    // Generate addresses
    const addresses = await wallet.generateAddresses(count, account, change);
    
    // Export complete wallet
    const walletData = wallet.exportWallet(addresses);
    
    // Save to file
    const fs = await import("fs");
    const filename = `qti3_pqhd_hd_wallet.json`;
    fs.writeFileSync(filename, JSON.stringify(walletData, null, 2));
    
    console.error(`\n[SUCCESS] PQ-HD HD wallet saved to '${filename}'`);
    console.error(`Generated ${addresses.length} addresses with hierarchical derivation`);
    
    // Display summary
    console.error("\n--- Address Summary ---");
    addresses.forEach((addr, i) => {
      console.error(`${i + 1}. ${addr.address} (${addr.path})`);
    });
    
    // Output full wallet JSON
    console.log(JSON.stringify(walletData, null, 2));
    
  } catch (error) {
    console.error("[ERROR] Wallet generation failed:", error.message);
    process.exit(1);
  }
}

// --- Execute
main().catch(err => {
  console.error("\n--- Unexpected error occurred ---");
  console.error(err);
  process.exit(1);
});