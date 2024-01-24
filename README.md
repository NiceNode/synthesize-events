# synthesize-events

Synthesizes, processes, calculates various statistics about events that have taken place in the recent past. It reads event data from redis and then stores the synthesized data in other redis keys.

create a .env file or set env vars:

```
UPSTASH_REDIS_REST_URL=""
UPSTASH_REDIS_REST_TOKEN=""
```

With node and npm installed, run
`npm install` then `npm run watchIndex` (careful this will re-run on any file save)

# Redis keys

Event data read from  `event::<event-id>` and `eventsByDay::<yyyy-mm-dd>` is synthesized and then the resulting data is stored in `metrics::` hashes

# Troubleshooting

We want to use UTC timezones for all dates. Make this clear to users which timezones they are seeing. 
