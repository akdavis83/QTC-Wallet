#pragma once
#include <string>
#include <vector>
#include <cstdint>

std::string b64_encode(const uint8_t* data, size_t len);
std::string json_pair(const std::string& k, const std::string& v, bool quote=true);
std::string json_obj(const std::vector<std::string>& pairs);