/**
 * QTC Quantum-Safe Wallet CLI (Pure JS)
 * Generates a quantum-safe address and keys using Kyber1024 and Dilithium3.
 * This version uses the production-grade noble-post-quantum JS libraries.
 */

import { bech32 } from "bech32";
import { SHA3, SHAKE } from "sha3";

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

  // --- 2. Derive Entropy for Deterministic Dilithium Key Generation using SHAKE256
  const shake256 = new SHAKE(256);
  shake256.update(sharedSecret);
  const entropy = shake256.digest(64); // 64 bytes for Dilithium3 seed
  console.error(`[✓] Entropy derived (SHAKE256): ${entropy.toString("hex").slice(0, 32)}...`);

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

  // --- 4. Generate QTC Address from Dilithium Public Key (MATCH QTC CORE)
  // a) Hash the Dilithium public key using SHA3-256 (QUANTUM-SAFE)
  const hash = new SHA3(256);
  hash.update(Buffer.from(dilithium_pk));
  const pkHash = hash.digest();

  // b) Get the first 20 bytes (160 bits) of the hash
  const addressBytes = pkHash.slice(0, 20);

  // c) Convert to bech32m with "qtc" prefix and witness version 1 (MATCHES QTC CORE)
  const witnessVersion = 1;
  const witnessProgram = Array.from(addressBytes);
  const words = bech32.toWords(witnessProgram);
  const data = [witnessVersion, ...words];
  const address = bech32.encode("qtc", data);
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

// --- JSON-RPC helper and CLI for wallet ops
import fetch from 'node-fetch';

async function rpcCall({ url, user, pass }, method, params = []) {
  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': 'Basic ' + Buffer.from(user + ':' + pass).toString('base64'),
    },
    body: JSON.stringify({ jsonrpc: '2.0', id: 1, method, params }),
  });
  const data = await res.json();
  if (data.error) throw new Error(data.error.message);
  return data.result;
}

function parseArgs() {
  const args = { _: [] };
  for (let i = 2; i < process.argv.length; i++) {
    const k = process.argv[i];
    if (k.startsWith('--')) {
      const key = k.slice(2);
      const val = (i + 1 < process.argv.length && !process.argv[i + 1].startsWith('--')) ? process.argv[++i] : true;
      args[key] = val;
    } else {
      args._.push(k);
    }
  }
  return args;
}

function rpcConfigFromEnvOrArgs(args) {
  return {
    url: args.rpc || process.env.QTC_RPC_URL || 'http://127.0.0.1:8332',
    user: args.rpcuser || process.env.QTC_RPC_USER || 'user',
    pass: args.rpcpass || process.env.QTC_RPC_PASS || 'pass',
  };
}

async function cmdBalance(args) {
  const cfg = rpcConfigFromEnvOrArgs(args);
  const address = args.address;
  if (!address) throw new Error('--address is required');
  const utxos = await rpcCall(cfg, 'listunspent', [0, 999999, [address]]);
  const sats = utxos.reduce((a, u) => a + Math.round(u.amount * 1e8), 0);
  console.log(JSON.stringify({ address, balance: sats / 1e8, utxos }, null, 2));
}

async function cmdSend(args) {
  const cfg = rpcConfigFromEnvOrArgs(args);
  const to = args.to;
  const amount = parseFloat(args.amount);
  if (!to || !Number.isFinite(amount) || amount <= 0) throw new Error('--to and --amount are required');
  const txid = await rpcCall(cfg, 'sendtoaddress', [to, amount]);
  console.log(JSON.stringify({ txid }, null, 2));
}

async function cmdImportAddress(args) {
  const cfg = rpcConfigFromEnvOrArgs(args);
  const address = args.address; if (!address) throw new Error('--address required');
  const label = args.label || '';
  const rescan = args.rescan === 'false' ? false : true;
  await rpcCall(cfg, 'importaddress', [address, label, rescan]);
  console.log(JSON.stringify({ imported: address, label, rescan }, null, 2));
}

async function cmdImportPrivKey(args) {
  const cfg = rpcConfigFromEnvOrArgs(args);
  const privkey = args.privkey; if (!privkey) throw new Error('--privkey required');
  const label = args.label || '';
  const rescan = args.rescan === 'false' ? false : true;
  await rpcCall(cfg, 'importprivkey', [privkey, label, rescan]);
  console.log(JSON.stringify({ imported: true, label, rescan }, null, 2));
}

// Raw transaction workflow via JSON-RPC
async function cmdCreateRaw(args) {
  const cfg = rpcConfigFromEnvOrArgs(args);
  const inputs = JSON.parse(args.inputs || '[]'); // [{txid, vout}]
  const outputs = JSON.parse(args.outputs || '{}'); // {address: amount}
  if (!Array.isArray(inputs) || typeof outputs !== 'object') throw new Error('--inputs JSON array and --outputs JSON object required');
  const hex = await rpcCall(cfg, 'createrawtransaction', [inputs, outputs]);
  console.log(JSON.stringify({ hex }, null, 2));
}

async function cmdFundRaw(args) {
  const cfg = rpcConfigFromEnvOrArgs(args);
  const hex = args.hex; if (!hex) throw new Error('--hex required');
  const funded = await rpcCall(cfg, 'fundrawtransaction', [hex, { replaceable: false }]);
  console.log(JSON.stringify(funded, null, 2));
}

async function cmdSignRaw(args) {
  const cfg = rpcConfigFromEnvOrArgs(args);
  const hex = args.hex; if (!hex) throw new Error('--hex required');
  const signed = await rpcCall(cfg, 'signrawtransactionwithwallet', [hex]);
  console.log(JSON.stringify(signed, null, 2));
}

async function cmdBroadcast(args) {
  const cfg = rpcConfigFromEnvOrArgs(args);
  const hex = args.hex; if (!hex) throw new Error('--hex required');
  const txid = await rpcCall(cfg, 'sendrawtransaction', [hex]);
  console.log(JSON.stringify({ txid }, null, 2));
}

(async () => {
  const args = parseArgs();
  const cmd = args._[0] || 'generate';
  try {
    if (cmd === 'generate') {
      await generateWallet();
    } else if (cmd === 'balance') {
      await cmdBalance(args);
    } else if (cmd === 'send') {
      await cmdSend(args);
    } else if (cmd === 'import-address') {
      await cmdImportAddress(args);
    } else if (cmd === 'import-privkey') {
      await cmdImportPrivKey(args);
    } else if (cmd === 'create-raw') {
      await cmdCreateRaw(args);
    } else if (cmd === 'fund-raw') {
      await cmdFundRaw(args);
    } else if (cmd === 'sign-raw') {
      await cmdSignRaw(args);
    } else if (cmd === 'broadcast') {
      await cmdBroadcast(args);
    } else {
      throw new Error('Unknown command: ' + cmd);
    }
  } catch (e) {
    console.error(e.message || e);
    process.exit(1);
  }
})();
