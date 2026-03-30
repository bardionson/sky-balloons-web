# Image Hosting Feature — Deploy Checklist

Branch: `feature/image-hosting`

## Before deploying

- [ ] Run migration against Neon DB:
  ```
  supabase/migrations/002_add_image_hosting.sql
  ```
  (make `cid` nullable, add `image_url`, `ipfs_status` columns)

- [ ] Add Vercel environment variables:
  - `LIGHTHOUSE_API_KEY` — from https://files.lighthouse.storage/dashboard
  - `BLOB_READ_WRITE_TOKEN` — from Vercel dashboard → Storage → Blob

- [ ] Merge `feature/image-hosting` into main / deploy branch

## After deploying

- [ ] Update GPU Python script to POST multipart form instead of JSON:
  ```python
  # OLD
  requests.post(url, json={"cid": cid, ...})

  # NEW
  requests.post(
      url,
      files={"image": open(image_path, "rb")},
      data={
          "unique_name": ...,
          "unit_number": ...,
          "seed": ...,
          "timestamp": ...,
          "orientation": ...,
          "imagination": ...,
          "event_name": ...,
      }
  )
  ```

- [ ] Test a submission end-to-end (mint page should show image instantly from Vercel Blob URL)
- [ ] Verify IPFS cron fires and updates `cid` on minted rows
