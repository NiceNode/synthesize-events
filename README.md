# transfer-events

Transfers events from mixpanel to a redis instance. This is intended to be able to be re-run without any issues.

create a .env file or set env vars:

```
MP_SA_USERNAME=<mixpanel-service-account-name>
MP_SA_SECRET=<mixpanel-service-account-secrete>
MP_PROJECT_ID=<mixpanel-project-id>
UPSTASH_REDIS_REST_URL=""
UPSTASH_REDIS_REST_TOKEN=""
```

With node and npm installed, run
`npm install` then `npm run watchIndex` (careful this will re-run on any file save)

# Redis keys

Each event will be stored as a key value, with the key `event::<event-id>` and the value `JSON.stringify(<event-data>)`
Additionally, all `event-id`'s for a particular day (UTC day) will be saved in a list under the key `eventsByDay::<yyyy-mm-dd>`

# Troubleshooting

Be careful with timezones. Mixpanel likely uses local timezones, but we want to use UTC timezones for all dates.
