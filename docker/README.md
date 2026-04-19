# docker/

Staging directory for `docker build` context artefacts.

Used for local development while `@emby-utils/client` is not yet published to
npm: drop a `@emby-utils-client-<version>.tgz` produced by `npm pack` in the
client repo here, then build the image with:

```bash
docker build \
  --build-arg CLIENT_TARBALL=docker/emby-utils-client-0.1.0.tgz \
  -t emby-utils-mcp:dev \
  .
```

Once the client is published, this directory is not needed at build time and
the `CLIENT_TARBALL` arg can be omitted.
