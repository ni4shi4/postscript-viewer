#!/bin/bash
set -euo pipefail

# Pin embedded timestamps so repeated builds produce identical wasm.
export SOURCE_DATE_EPOCH="${SOURCE_DATE_EPOCH:-0}"

GHOSTSCRIPT_VERSION="${GHOSTSCRIPT_VERSION:?GHOSTSCRIPT_VERSION is required}"
GHOSTSCRIPT_TARBALL_SHA256="${GHOSTSCRIPT_TARBALL_SHA256:?GHOSTSCRIPT_TARBALL_SHA256 is required}"
GHOSTSCRIPT_RELEASE_TAG="${GHOSTSCRIPT_RELEASE_TAG:?GHOSTSCRIPT_RELEASE_TAG is required}"
ARCH_H_PATH="${ARCH_H_PATH:-/build/arch_wasm.h}"
OUT_DIR="${OUT_DIR:-/out}"
BUILD_DIR="/tmp/ghostscript-build"

TARBALL_NAME="ghostscript-${GHOSTSCRIPT_VERSION}.tar.xz"
TARBALL_URL="https://github.com/ArtifexSoftware/ghostpdl-downloads/releases/download/${GHOSTSCRIPT_RELEASE_TAG}/${TARBALL_NAME}"

rm -rf "${BUILD_DIR}"
mkdir -p "${BUILD_DIR}" "${OUT_DIR}"
cd "${BUILD_DIR}"

wget -O "${TARBALL_NAME}" "${TARBALL_URL}"
printf '%s  %s\n' "${GHOSTSCRIPT_TARBALL_SHA256}" "${TARBALL_NAME}" | sha256sum -c -
tar -xf "${TARBALL_NAME}"

cd "ghostscript-${GHOSTSCRIPT_VERSION}"

export CPPFLAGS="-Os"
export CFLAGS="${CPPFLAGS}"
export CXXFLAGS="${CFLAGS}"

PREFIX="${BUILD_DIR}/install"
mkdir -p "${PREFIX}"

GS_LDFLAGS="-sMODULARIZE=1 -sEXPORT_ES6=1 -sEXPORT_NAME=createModule"
GS_LDFLAGS="${GS_LDFLAGS} -sEXPORTED_RUNTIME_METHODS=[callMain,FS]"
GS_LDFLAGS="${GS_LDFLAGS} -sFORCE_FILESYSTEM=1 -sFILESYSTEM=1"
GS_LDFLAGS="${GS_LDFLAGS} -sALLOW_MEMORY_GROWTH=1"
GS_LDFLAGS="${GS_LDFLAGS} -sINITIAL_MEMORY=67108864 -sMAXIMUM_MEMORY=134217728"
GS_LDFLAGS="${GS_LDFLAGS} -sINVOKE_RUN=0 -sDYNAMIC_EXECUTION=0"
GS_LDFLAGS="${GS_LDFLAGS} -sENVIRONMENT=web,worker,node -sWASM_BIGINT=1"
GS_LDFLAGS="${GS_LDFLAGS} -sNO_DISABLE_EXCEPTION_CATCHING=1"
GS_LDFLAGS="${GS_LDFLAGS} -sEMULATE_FUNCTION_POINTER_CASTS=1"
GS_LDFLAGS="${GS_LDFLAGS} -sBINARYEN_EXTRA_PASSES=--pass-arg=max-func-params@39"

emconfigure ./autogen.sh \
  CCAUX=gcc CFLAGSAUX= CPPFLAGSAUX= \
  --host=wasm32-unknown-linux \
  --prefix="${PREFIX}" \
  --disable-shared \
  --disable-threading \
  --disable-cups \
  --disable-dbus \
  --disable-gtk \
  --without-tesseract \
  --with-arch_h="${ARCH_H_PATH}"

export CPPFLAGS="-Os -Wno-builtin-macro-redefined -U__DATE__ -U__TIME__ -D__DATE__=\"Jan 01 2020\" -D__TIME__=\"00:00:00\" -DGS_BUILDTIME=0"
export CFLAGS="${CPPFLAGS}"
export CXXFLAGS="${CFLAGS}"

emmake make -j"$(nproc)" XE=".mjs" LDFLAGS="${GS_LDFLAGS}"

cp ./bin/gs.mjs "${OUT_DIR}/gs.mjs"
cp ./bin/gs.wasm "${OUT_DIR}/gs.wasm"

python3 - "${OUT_DIR}/gs.wasm" <<'PY'
import sys

path = sys.argv[1]
data = bytearray(open(path, "rb").read())
needle = bytes.fromhex("016b00000000")
idx = data.rfind(needle)
if idx < 2 or data[idx - 4 : idx - 2] != bytes.fromhex("9e29"):
    raise SystemExit("gs.wasm normalize anchor not found")
# Zero Emscripten's 2-byte link stamp so repeated builds match.
data[idx - 2 : idx] = b"\x00\x00"
open(path, "wb").write(data)
PY
