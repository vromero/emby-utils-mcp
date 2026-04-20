# local/

Gitignored staging area for ephemeral build inputs.

Currently used to hold a pre-packed `@emby-utils/client` tarball for local
Docker builds while the client is not yet on npm:

```bash
# In the emby-utils-client repo:
npm run build && npm pack
mv emby-utils-client-*.tgz ../emby-utils-mcp/local/

# In this repo:
docker build \
  -f docker/Dockerfile \
  --build-arg CLIENT_TARBALL=local/emby-utils-client-0.1.0.tgz \
  -t emby-utils-mcp:dev .
```

Everything in this directory except `README.md` and `.gitkeep` is gitignored.
