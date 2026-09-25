FROM postgres:16-alpine
RUN apk add --no-cache --virtual .vector-build build-base clang llvm-dev git \
    && git clone --branch v0.8.2 --depth 1 https://github.com/pgvector/pgvector.git /tmp/pgvector \
    && cd /tmp/pgvector && make OPTFLAGS="" with_llvm=no && make install with_llvm=no \
    && mkdir -p /usr/local/share/doc/pgvector && cp LICENSE /usr/local/share/doc/pgvector/LICENSE \
    && rm -rf /tmp/pgvector && apk del .vector-build
