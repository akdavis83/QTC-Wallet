#include <iostream>
#include <vector>
#include <string>
#include <stdexcept>
#include <cstring>
#include <cstdlib>

#include <oqs/kem.h>
#include <oqs/sig.h>
#include <oqs/rand.h>

#include "rng_deterministic.h"
#include "json_emit.h"

// Hex decode
static std::vector<uint8_t> hex2bin(const std::string& hex) {
    auto nyb = [](char c)->int {
        if (c>='0'&&c<='9') return c-'0';
        if (c>='a'&&c<='f') return c-'a'+10;
        if (c>='A'&&c<='F') return c-'A'+10;
        return -1;
    };
    if (hex.size()%2) throw std::runtime_error("seed_hex length must be even");
    std::vector<uint8_t> out;
    out.reserve(hex.size()/2);
    for (size_t i=0; i<hex.size(); i+=2) {
        int hi=nyb(hex[i]), lo=nyb(hex[i+1]);
        if (hi<0||lo<0) throw std::runtime_error("invalid hex");
        out.push_back((uint8_t)((hi<<4)|lo));
    }
    return out;
}

// Try preferred ML-* names, fallback to legacy names
static OQS_KEM* kem_new_any() {
    OQS_KEM* kem = OQS_KEM_new("ML-KEM-1024");
    if (!kem) kem = OQS_KEM_new("Kyber1024");
    if (!kem) kem = OQS_KEM_new(OQS_KEM_alg_kyber_1024);
    return kem;
}

static OQS_SIG* sig_new_any() {
    OQS_SIG* sig = OQS_SIG_new("ML-DSA-65");
    if (!sig) sig = OQS_SIG_new("Dilithium3");
    if (!sig) sig = OQS_SIG_new(OQS_SIG_alg_dilithium_3);
    return sig;
}

// Set deterministic RNG for a given domain; restore to system after op
struct RngScope {
    std::string domain;
    RngScope(const std::vector<uint8_t>& seed, const std::string& dom) : domain(dom) {
        auto s48 = shake256_expand_seed_48(seed, dom);
        init_nist_kat_drbg_48(s48);
    }
    ~RngScope() {
        OQS_randombytes_switch_algorithm(OQS_RAND_alg_system);
    }
};

static int cmd_gen_kyber_from_seed(const std::string& seed_hex) {
    auto seed = hex2bin(seed_hex);
    RngScope scope(seed, "kyber_keygen");
    OQS_KEM* kem = kem_new_any();
    if (!kem) { std::cerr << "error: ML-KEM-1024 unavailable\n"; return 2; }

    std::vector<uint8_t> pk(kem->length_public_key), sk(kem->length_secret_key);
    if (OQS_KEM_keypair(kem, pk.data(), sk.data()) != OQS_SUCCESS) {
        OQS_KEM_free(kem);
        std::cerr << "error: KEM keypair failed\n"; return 3;
    }
    std::string pk_b64 = b64_encode(pk.data(), pk.size());
    std::string sk_b64 = b64_encode(sk.data(), sk.size());
    OQS_KEM_free(kem);

    std::cout << json_obj({
        json_pair("kyber_public_b64", pk_b64),
        json_pair("kyber_private_b64", sk_b64)
    }) << "\n";
    return 0;
}

static int cmd_gen_dilithium_from_seed(const std::string& seed_hex) {
    auto seed = hex2bin(seed_hex);
    RngScope scope(seed, "dilithium_keygen");
    OQS_SIG* sig = sig_new_any();
    if (!sig) { std::cerr << "error: ML-DSA-65 unavailable\n"; return 2; }

    std::vector<uint8_t> pk(sig->length_public_key), sk(sig->length_secret_key);
    if (OQS_SIG_keypair(sig, pk.data(), sk.data()) != OQS_SUCCESS) {
        OQS_SIG_free(sig);
        std::cerr << "error: SIG keypair failed\n"; return 3;
    }
    std::string pk_b64 = b64_encode(pk.data(), pk.size());
    std::string sk_b64 = b64_encode(sk.data(), sk.size());
    OQS_SIG_free(sig);

    std::cout << json_obj({
        json_pair("dilithium_public_b64", pk_b64),
        json_pair("dilithium_private_b64", sk_b64)
    }) << "\n";
    return 0;
}

static int cmd_kem_self_from_seed(const std::string& seed_hex) {
    auto seed = hex2bin(seed_hex);
    RngScope scope(seed, "kyber_kem_self");
    OQS_KEM* kem = kem_new_any();
    if (!kem) { std::cerr << "error: ML-KEM-1024 unavailable\n"; return 2; }

    std::vector<uint8_t> pk(kem->length_public_key), sk(kem->length_secret_key);
    if (OQS_KEM_keypair(kem, pk.data(), sk.data()) != OQS_SUCCESS) {
        OQS_KEM_free(kem);
        std::cerr << "error: KEM keypair failed\n"; return 3;
    }
    std::vector<uint8_t> ct(kem->length_ciphertext), ss(kem->length_shared_secret);
    if (OQS_KEM_encaps(kem, ct.data(), ss.data(), pk.data()) != OQS_SUCCESS) {
        OQS_KEM_free(kem);
        std::cerr << "error: KEM encaps failed\n"; return 4;
    }

    std::string pk_b64 = b64_encode(pk.data(), pk.size());
    std::string sk_b64 = b64_encode(sk.data(), sk.size());
    std::string ss_b64 = b64_encode(ss.data(), ss.size());
    OQS_KEM_free(kem);

    std::cout << json_obj({
        json_pair("kyber_public_b64", pk_b64),
        json_pair("kyber_private_b64", sk_b64),
        json_pair("shared_b64", ss_b64)
    }) << "\n";
    return 0;
}

int main(int argc, char** argv) {
    try {
        if (argc != 3) {
            std::cerr << "usage:\n"
                      << "  oqs_wallet_cli gen_kyber_from_seed <seed_hex>\n"
                      << "  oqs_wallet_cli gen_dilithium_from_seed <seed_hex>\n"
                      << "  oqs_wallet_cli kem_self_from_seed <seed_hex>\n";
            return 1;
        }
        std::string cmd = argv[1];
        std::string seed_hex = argv[2];
        if (cmd == "gen_kyber_from_seed") return cmd_gen_kyber_from_seed(seed_hex);
        if (cmd == "gen_dilithium_from_seed") return cmd_gen_dilithium_from_seed(seed_hex);
        if (cmd == "kem_self_from_seed") return cmd_kem_self_from_seed(seed_hex);
        std::cerr << "unknown command\n";
        return 1;
    } catch (const std::exception& e) {
        std::cerr << "error: " << e.what() << "\n";
        return 99;
    }
}