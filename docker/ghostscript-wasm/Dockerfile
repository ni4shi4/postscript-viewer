# emsdk 3.1.50 (Emscripten 3.1.50)
FROM emscripten/emsdk@sha256:b6ea0e55fdc95be36427df6df7892d5e5e27f0440cfcf442a55f784aba09a4fa

RUN apt-get update \
  && apt-get install -y --no-install-recommends \
    autotools-dev \
    automake \
    libtool \
    wget \
    ca-certificates \
  && rm -rf /var/lib/apt/lists/*

ARG GHOSTSCRIPT_VERSION=10.08.0
ARG GHOSTSCRIPT_RELEASE_TAG=gs10080
ARG GHOSTSCRIPT_TARBALL_SHA256=c20492bc8ebb96c87fa2e52a0926e1cda8cde95d66145e018ac713fed5da38cf

ENV GHOSTSCRIPT_VERSION="${GHOSTSCRIPT_VERSION}" \
  GHOSTSCRIPT_RELEASE_TAG="${GHOSTSCRIPT_RELEASE_TAG}" \
  GHOSTSCRIPT_TARBALL_SHA256="${GHOSTSCRIPT_TARBALL_SHA256}"

WORKDIR /build
COPY arch_wasm.h /build/arch_wasm.h
COPY build-gs.sh /build/build-gs.sh
RUN chmod +x /build/build-gs.sh

RUN ARCH_H_PATH=/build/arch_wasm.h /build/build-gs.sh

VOLUME ["/out"]
