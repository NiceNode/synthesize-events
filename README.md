# synthesize-events

Synthesizes, processes, calculates various statistics about events that have taken place in the recent past. It reads event data from redis and then stores the synthesized data in other redis keys.

create a .env file or set env vars:

```
UPSTASH_REDIS_REST_URL=""
UPSTASH_REDIS_REST_TOKEN=""
```

Install `redis-stack-server` shown here https://redis.io/docs/install/install-stack/mac-os/ because we use the redis JSON module
Start a local redis server (`brew install redis redis-stack && redis-stack-server`) at `localhost:6379` and then run a http server to simulate upstash's http server. Github issue https://github.com/upstash/upstash-redis/issues/802
```
podman run \
    --rm -d -p 8080:80 --name redis-http \
    -e SRH_MODE=env \
    -e SRH_TOKEN=dummy_token \
    -e SRH_CONNECTION_STRING="redis://host.containers.internal:6379" \
    hiett/serverless-redis-http:latest
```

Manually set redis values with `redis-cli` and `set <key> <value>` command

With node and npm installed, run
`npm install` then `npm run watchIndex` (careful this will re-run on any file save)

# Redis keys

Event data read from  `event::<event-id>` and `eventsByDay::<yyyy-mm-dd>` is synthesized and then the resulting data is stored in `metrics::` hashes

## Impact Dashboard keys
The types can be found in `src/redisTypes.ts`
### JSON
`node::<node_id>`
`service::<service_id>`
`user::<user_id>`
`activeUsersByDay`
`activeNodesByDay`

### Sets
`activeUsers`
`activeNodes`



# Troubleshooting

We want to use UTC timezones for all dates. Make this clear to users which timezones they are seeing. 
