# Indeed Jobs + Company Website Actor

This project follows Apify Actor definition conventions:

- `.actor/actor.json` for actor metadata and build settings
- `.actor/input_schema.json` for input definition
- Apify SDK interface via `Actor.main`, `Actor.getInput`, `Actor.pushData`, and `Actor.setValue`

The actor scrapes Indeed search results (US) and outputs raw job records while appending:

- `companyInfo.name`
- `companyInfo.websiteUrl`
- `companyInfo.websiteSource`
- `companyInfo.extractedAt`

If website extraction fails, `websiteUrl` is set to `null` and a warning is added to run metadata.

## Input

Use either `searches` (query/location) or `searchUrls` (copied Indeed search URLs).

Example using search URLs:

```json
{
  "searchUrls": [
    "https://www.indeed.com/jobs?q=production+operator&l=united+states&fromage=1"
  ],
  "maxConcurrency": 5,
  "includeCompanyInfo": true,
  "useApifyProxy": true,
  "proxyGroups": ["BUYPROXIES94952"]
}
```

## Run locally

```bash
npm install
npm start
```

## Output

- Dataset: one item per job (raw Indeed shape + `companyInfo`)
- Key-value store record: `RUN_META` with warning counts and fetch stats
