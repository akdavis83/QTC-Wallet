/**
 * QTC Wallet Comparison Script
 * Compares Primary (qti2.js) vs PQ-HD (qti3.js) wallet generation methods
 */

import { bech32 } from "bech32";
import { SHA3 } from "sha3";

async function compareWallets() {
  console.log("=== QTC Wallet Method Comparison ===\n");

  // Dynamic imports for crypto and fs
  const crypto = await import("crypto");
  const fs = await import("fs");

  // Check if both wallet files exist
  let primaryWallet, pqhdWallet;
  
  try {
    primaryWallet = JSON.parse(fs.readFileSync("qti2_wallet.json", "utf8"));
    console.log("✓ Found Primary wallet (qti2_wallet.json)");
  } catch (err) {
    console.log("✗ Primary wallet not found. Run 'node qti2.js' first.");
    return;
  }

  try {
    pqhdWallet = JSON.parse(fs.readFileSync("qti3_pqhd_wallet.json", "utf8"));
    console.log("✓ Found PQ-HD wallet (qti3_pqhd_wallet.json)");
  } catch (err) {
    console.log("✗ PQ-HD wallet not found. Run 'node qti3.js' first.");
    return;
  }

  console.log("\n--- COMPARISON TABLE ---");
  console.log("┌─────────────────────┬─────────────────────┬─────────────────────┐");
  console.log("│ Feature            │ Primary (qti2.js) │ PQ-HD (qti3.js)  │");
  console.log("├─────────────────────┼─────────────────────┼─────────────────────┤");
  console.log(`│ Method             │ ${(primaryWallet.algorithm || "Kyber1024+Dilithium3").padEnd(17)} │ ${(pqhdWallet.algorithm || "Kyber1024+Dilithium3").padEnd(17)} │`);
  console.log(`│ Address            │ ${primaryWallet.address.padEnd(17)} │ ${pqhdWallet.address.padEnd(17)} │`);
  console.log(`│ Witness Version    │ 1                   │ ${pqhdWallet.witness_version}                   │`);
  console.log(`│ Dilithium Keys     │ Deterministic        │ Random              │`);
  console.log(`│ Entropy Source     │ Kyber Shared Secret │ Combined Input     │`);
  console.log(`│ Address Generation  │ SHA3-256(Dilithium)│ SHA3-256(Master)   │`);
  console.log(`│ Purpose            │ Direct QTC Use     │ External Wallets    │`);
  console.log("└─────────────────────┴─────────────────────┴─────────────────────┘");

  console.log("\n--- KEY DIFFERENCES ---");
  console.log("1. WITNESS VERSION:");
  console.log("   - Primary: Uses witness version 1");
  console.log("   - PQ-HD:   Uses witness version 2");
  
  console.log("\n2. DILITHIUM KEY GENERATION:");
  console.log("   - Primary: Deterministic from Kyber shared secret");
  console.log("   - PQ-HD:   Random generation");
  
  console.log("\n3. ADDRESS GENERATION:");
  console.log("   - Primary: SHA3-256(Dilithium Public Key)");
  console.log("   - PQ-HD:   SHA3-256(Master Entropy)");
  
  console.log("\n4. MASTER ENTROPY:");
  console.log("   - Primary: SHA3-512(Kyber Shared Secret)");
  console.log("   - PQ-HD:   SHA3-512(Kyber Shared Secret || Dilithium Public Key)");

  console.log("\n--- SECURITY ANALYSIS ---");
  console.log("Both methods use:");
  console.log("✓ Kyber1024 KEM for quantum-safe key exchange");
  console.log("✓ Dilithium3 for quantum-safe signatures");
  console.log("✓ SHA3-512 for entropy derivation");
  console.log("✓ SHA3-256 for address generation");
  console.log("✓ bech32m encoding for addresses");

  console.log("\n--- USE CASES ---");
  console.log("PRIMARY METHOD (qti2.js):");
  console.log("• Most secure direct QTC implementation");
  console.log("• Deterministic key derivation");
  console.log("• Recommended for QTC native wallets");
  console.log("• Witness version 1 addresses");

  console.log("\nPQ-HD METHOD (qti3.js):");
  console.log("• For external wallet integration");
  console.log("• Hierarchical deterministic support");
  console.log("• Compatible with external wallet standards");
  console.log("• Witness version 2 addresses");

  console.log("\n--- COMPATIBILITY ---");
  console.log("Both methods are fully quantum-safe and can be used in QTC network.");
  console.log("The witness version difference allows network to identify wallet type.");
}

compareWallets().catch(err => {
  console.error("Error:", err);
  process.exit(1);
});