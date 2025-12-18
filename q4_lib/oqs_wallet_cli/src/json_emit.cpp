#include "json_emit.h"
#include <vector>
#include <string>

static const char b64_table[] = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";

std::string b64_encode(const uint8_t* data, size_t len) {
    std::string out;
    out.reserve(((len + 2) / 3) * 4);
    for (size_t i = 0; i < len; i += 3) {
        uint32_t v = data[i] << 16;
        if (i + 1 < len) v |= data[i+1] << 8;
        if (i + 2 < len) v |= data[i+2];
        out.push_back(b64_table[(v >> 18) & 0x3F]);
        out.push_back(b64_table[(v >> 12) & 0x3F]);
        out.push_back(i + 1 < len ? b64_table[(v >> 6) & 0x3F] : '=');
        out.push_back(i + 2 < len ? b64_table[v & 0x3F] : '=');
    }
    return out;
}

static std::string json_escape(const std::string& s) {
    std::string o;
    o.reserve(s.size()+8);
    for (char c : s) {
        switch (c) {
            case '\\': o += "\\\\"; break;
            case '"': o += "\\\""; break;
            case '\n': o += "\\n"; break;
            case '\r': o += "\\r"; break;
            case '\t': o += "\\t"; break;
            default: o += c; break;
        }
    }
    return o;
}

std::string json_pair(const std::string& k, const std::string& v, bool quote) {
    std::string out = "\"" + json_escape(k) + "\": ";
    if (quote) out += "\"" + json_escape(v) + "\"";
    else out += v;
    return out;
}

std::string json_obj(const std::vector<std::string>& pairs) {
    std::string out = "{";
    for (size_t i = 0; i < pairs.size(); ++i) {
        if (i > 0) out += ", ";
        out += pairs[i];
    }
    out += "}";
    return out;
}