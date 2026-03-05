# Indeed Jobs + Company Website Actor

This actor scrapes Indeed search results (US) and outputs raw job records while appending:

- `companyInfo.name`
- `companyInfo.websiteUrl`
- `companyInfo.websiteSource`
- `companyInfo.extractedAt`

If website extraction fails, `websiteUrl` is set to `null` and a warning is added to run metadata.

## Input

See `INPUT_SCHEMA.json`.

Minimal example:

```json
{
  "searches": [
    {
      "query": "production operator",
      "location": "united states",
      "fromDays": 1,
      "maxResults": 20
    }
  ]
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