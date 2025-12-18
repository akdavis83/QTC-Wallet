#include "rng_deterministic.h"
#include <vector>
#include <string>
#include <cstring>
#include <stdexcept>
#include <oqs/sha3.h>
#include <oqs/rand.h>

// Expand arbitrary seed + domain into 48 bytes using cSHAKE256
std::vector<uint8_t> shake256_expand_seed_48(const std::vector<uint8_t>& seed, const std::string& domain) {
    // SHAKE256 fallback for cSHAKE256: absorb domain prefix and domain manually
    OQS_SHA3_shake256_inc_ctx ctx;
    OQS_SHA3_shake256_inc_init(&ctx);
    
    std::string prefix = "oqs_wallet_cli"; 
    OQS_SHA3_shake256_inc_absorb(&ctx, (const uint8_t*)prefix.data(), prefix.size());
    OQS_SHA3_shake256_inc_absorb(&ctx, (const uint8_t*)domain.data(), domain.size());
    
    OQS_SHA3_shake256_inc_absorb(&ctx, seed.data(), seed.size());
    OQS_SHA3_shake256_inc_finalize(&ctx);
    std::vector<uint8_t> out(48);
    OQS_SHA3_shake256_inc_squeeze(out.data(), out.size(), &ctx);
    return out;
}

// Initialize liboqs NIST-KAT DRBG with 48-byte seed
void init_nist_kat_drbg_48(const std::vector<uint8_t>& seed48) {
    if (seed48.size() != 48) throw std::runtime_error("seed48 must be exactly 48 bytes");
    // No personalization string (NULL)
    OQS_randombytes_nist_kat_init_256bit(seed48.data(), nullptr);
    // Switch to NIST-KAT for deterministic RNG
    if (OQS_randombytes_switch_algorithm(OQS_RAND_alg_nist_kat) != OQS_SUCCESS) {
        throw std::runtime_error("Failed to switch RNG to NIST-KAT");
    }
}