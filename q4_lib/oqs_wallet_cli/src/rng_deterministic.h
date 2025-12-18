#pragma once
#include <vector>
#include <string>
#include <cstdint>

std::vector<uint8_t> shake256_expand_seed_48(const std::vector<uint8_t>& seed, const std::string& domain);
void init_nist_kat_drbg_48(const std::vector<uint8_t>& seed48);