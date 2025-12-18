CXX ?= g++
CXXFLAGS ?= -O2 -std=c++17 -fPIC -Wall -Wextra
INCLUDES = -I../../../../build_liboqs/include
LIBS = -L../../../../build_liboqs/lib -loqs

SRC = src/main.cpp src/rng_deterministic.cpp src/json_emit.cpp
OBJ = $(SRC:.cpp=.o)
BIN = build/oqs_wallet_cli

all: $(BIN)

$(BIN): $(OBJ)
	$(CXX) $(CXXFLAGS) -o $@ $(OBJ) $(LIBS)

%.o: %.cpp
	$(CXX) $(CXXFLAGS) $(INCLUDES) -c $< -o $@

clean:
	rm -f $(OBJ) $(BIN)