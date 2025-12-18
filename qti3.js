import { bech32 } from "bech32";
import { SHA3, SHAKE } from "sha3";
const fs = await import("fs");
const path = await import("path");
const { spawnSync } = await import("child_process");

const url = await import("url");

function ensureCliBuilt() {
    const __dirname = path.dirname(url.fileURLToPath(import.meta.url));
    const cliDir = path.resolve(__dirname, "q4_lib/oqs_wallet_cli");
    
    const isWin = process.platform === 'win32';
    const cliBinName = isWin ? "build/oqs_wallet_cli.exe" : "build/oqs_wallet_cli";
    const cliBin = path.join(cliDir, cliBinName);

    if (!fs.existsSync(cliBin)) {
        console.error("[info] oqs_wallet_cli not found, building...");
        let cmd, args;
        if (isWin) {
            cmd = "cmd.exe";
            args = ["/c", "build_cli_win.bat"];
        } else {
            cmd = "make";
            args = [];
        }
        
        const mk = spawnSync(cmd, args, { cwd: cliDir, stdio: "inherit" });
        if (mk.status !== 0) {
            console.error("[ERROR] Failed to build oqs_wallet_cli. Please ensure you have a C/C++ compiler installed.");
            process.exit(1);
        }
    }
    return cliBin;
}

/**
 * QTC Quantum-Safe PQ-HD Wallet CLI (Pure JS)
 */

// --- Main async function
async function generatePQHDWallet() {
  console.error("--- Starting Quantum-Safe PQ-HD Wallet Generation (using liboqs) ---");

  // Dynamic imports for crypto and fs
  const crypto = await import("crypto");
  const fs = await import("fs");

  // Use liboqs via native CLI bridge
  const { spawnSync } = await import('child_process');

  // --- 1. Generate Kyber keypair via liboqs (deterministic from random seed)
  let kyber_pk, kyber_sk, sharedSecret;
  try {
    const cli = ensureCliBuilt();
    const seed_hex = Buffer.from(crypto.randomBytes(64)).toString("hex");
    const r1 = spawnSync(cli, ["kem_self_from_seed", seed_hex], { encoding: "utf8" });
    if (r1.status !== 0) { console.error(r1.stderr||"kem_self failed"); process.exit(1); }
    const o1 = JSON.parse(r1.stdout);
    kyber_pk = Buffer.from(o1.kyber_public_b64, "base64");
    kyber_sk = Buffer.from(o1.kyber_private_b64, "base64");
    sharedSecret = Buffer.from(o1.shared_b64, "base64");
    console.error('[✓] Kyber keypair and shared secret generated via CLI (kem_self).');
  } catch (err) {
    console.error('[ERROR] Kyber/liboqs operation failed:', err);
    process.exit(1);
  }

  // --- 2. Generate Dilithium3 Keypair (Deterministic from Kyber shared secret)
  let dilithium_pk, dilithium_sk;
  try {
    const shake256 = new SHAKE(256);
    shake256.update(sharedSecret);
    shake256.update(Buffer.from('QTC_PQHD_DILITHIUM', 'utf8'));
    const dilithium_seed = shake256.digest(32);
    const seed_hex = Buffer.from(dilithium_seed).toString('hex');
    const res2 = spawnSync(ensureCliBuilt(), ['gen_dilithium_from_seed', seed_hex], { encoding: 'utf8' });
    if (res2.status !== 0) throw new Error(res2.stderr || 'oqs_wallet_cli failed');
    const out2 = JSON.parse(res2.stdout);
    dilithium_pk = Buffer.from(out2.dilithium_public_b64, 'base64');
    dilithium_sk = Buffer.from(out2.dilithium_private_b64, 'base64');
    console.error('[✓] Dilithium3 deterministic keypair generated (liboqs).');
  } catch (err) {
    console.error('[ERROR] Dilithium/liboqs key generation failed:', err);
    process.exit(1);
  }

  // --- 3. Derive Master Entropy using SHAKE256(KyberSharedSecret || DilithiumPublicKey)
  const combined_input = Buffer.concat([sharedSecret, Buffer.from(dilithium_pk)]);
  const shake256_master = new SHAKE(256);
  shake256_master.update(combined_input);
  const master_entropy = shake256_master.digest(64); // 64 bytes master entropy
  console.error(`[✓] Master entropy derived (SHAKE256): ${master_entropy.toString("hex").slice(0, 32)}...`);

  // --- 4. Generate PQ-HD Address from Master Entropy (PQ-HD Method)
  // a) Hash the master entropy using SHA3-256 (QUANTUM-SAFE)
  const hash = new SHA3(256);
  hash.update(Buffer.from(master_entropy));
  const entropyHash = hash.digest();

  // b) Get the first 20 bytes (160 bits) of the hash
  const addressBytes = entropyHash.slice(0, 20);

  // c) Convert to bech32m with "qtc" prefix and witness version 2 (PQ-HD method)
  const witnessVersion = 2;
  const witnessProgram = Array.from(addressBytes);
  const words = bech32.toWords(witnessProgram);
  const data = [witnessVersion, ...words];
  const address = bech32.encode("qtc", data);
  console.error(`[✓] Generated PQ-HD Address: ${address}`);

  // --- 5. Assemble the final PQ-HD wallet JSON
  const pqhd_wallet = {
    address: address,
    method: "PQ-HD",
    witness_version: 2,
    master_entropy_b64: master_entropy.toString("base64"),
    kyber_public_b64: Buffer.from(kyber_pk).toString("base64"),
    kyber_private_b64: Buffer.from(kyber_sk).toString("base64"),
    dilithium_public_b64: Buffer.from(dilithium_pk).toString("base64"),
    dilithium_private_b64: Buffer.from(dilithium_sk).toString("base64"),
    kyber_shared_secret_b64: sharedSecret.toString("base64"),
    combined_input_b64: combined_input.toString("base64"),
    algorithm: "Kyber1024-KEM + Dilithium3-DSA (Deterministic PQ-HD)",
    quantum_safe: true,
    version: "QTC-PQHD-1.0",
    description: "QTC PQ-HD Wallet for External Wallet Integration"
  };

  // --- 6. Save to file and print
  try {
    fs.writeFileSync("qti3_pqhd_wallet.json", JSON.stringify(pqhd_wallet, null, 2));
    console.error("\n[SUCCESS] PQ-HD Wallet generated and saved to 'qti3_pqhd_wallet.json'");
    // ONLY print the JSON to stdout
    console.log(JSON.stringify(pqhd_wallet, null, 2));
  } catch (err) {
    console.error("[ERROR] Could not write wallet file:", err);
    process.exit(1); // Exit with error if file write fails
  }
  
  console.error("\n--- PQ-HD Wallet Generation Complete ---");
  console.error("[INFO] This wallet uses QTC Core Method 2: PQ-HD for External Wallets");
  console.error("[INFO] Address uses witness version 2 (different from Primary method version 1)");
}

// --- JSON-RPC helper and CLI for wallet ops
// import fetch from 'node-fetch'; // Native fetch used in Node 18+

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
      await generatePQHDWallet();
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
