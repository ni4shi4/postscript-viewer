FROM emscripten/emsdk:3.1.50

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

ENV GHOSTSCRIPT_VERSION="${GHOSTSCRIPT_VERSION}" \
  GHOSTSCRIPT_RELEASE_TAG="${GHOSTSCRIPT_RELEASE_TAG}"

WORKDIR /build
COPY arch_wasm.h /build/arch_wasm.h
COPY build-gs.sh /build/build-gs.sh
RUN chmod +x /build/build-gs.sh

RUN ARCH_H_PATH=/build/arch_wasm.h /build/build-gs.sh

VOLUME ["/out"]
