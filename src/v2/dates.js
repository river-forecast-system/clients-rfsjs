'use strict';

// REST (not website) endpoint so the S3 ListObjectsV2 API is available
const listUri = "https://geoglows-v2-forecasts.s3-us-west-2.amazonaws.com";

export default async function ({baseUrl} = {}) {
  /*
  Lists the initialization dates of every available v2 forecast. Each forecast is stored as a
  YYYYMMDD00.zarr/ prefix in the forecasts bucket. Returns a sorted array of "YYYYMMDD" strings.
  */
  const bucketUrl = baseUrl ? baseUrl : listUri;
  const dates = [];
  let token = null;
  do {
    const url = `${bucketUrl}/?list-type=2&delimiter=/&max-keys=1000`
      + (token ? `&continuation-token=${encodeURIComponent(token)}` : "");
    const res = await fetch(url);
    if (!res.ok) throw new Error(`Failed to list forecasts bucket: ${res.status} ${res.statusText}`);
    const xml = await res.text();
    for (const m of xml.matchAll(/<Prefix>(\d{8})00\.zarr\/<\/Prefix>/g)) {
      dates.push(m[1]);
    }
    const truncated = /<IsTruncated>true<\/IsTruncated>/.test(xml);
    const next = xml.match(/<NextContinuationToken>([^<]+)<\/NextContinuationToken>/);
    token = truncated && next ? next[1] : null;
  } while (token);
  return dates.sort();
}
