# Memory wins

An audit of the memory use of the five servers (image, api, auth, cms, admin), done because pods are
sometimes OOM-killed, most visibly the image server during a large upload.

The quick wins are implemented in the branch that introduces this file and listed in
[Done in this branch](#done-in-this-branch). Everything that needs design, a database to test against or
a decision is in [Larger items](#larger-items), ordered by how much it is expected to help.

## The short version

The image server crash is reproducible and has one main cause: **converting an iPhone HEIC photo to JPEG
needed more memory than the pod has.** A 48 megapixel HEIC peaked at 945 MB against a 500 MB limit, and
after every conversion 180-480 MB stayed allocated until the next restart. In a 500 MB cgroup the old code
is killed by the kernel on the first 48 megapixel upload; the new code converts 12 and 24 megapixel photos,
refuses the 48 megapixel one with a readable error, and keeps running.

Three other things added to it:

- glibc kept memory that image processing had already freed (670 MB resident after a burst of resizes,
  330 MB with `MALLOC_ARENA_MAX=2`). This is the "ARENA" setting.
- image-steam handled up to 20 requests at once, each holding a complete original in memory, and decoded
  4 images at once. A burst of uncached requests for large photos peaked at 1.3 GB.
- Nothing limited the number of pixels in an image. A 0.8 MB PNG of 250 megapixels needs 900 MB to resize.

For the other servers the audit was done by reading the code, not by measuring. The largest risks there are
unbounded database queries in the api server (lists without a limit, a nightly job that loads two whole
tables), an hourly job in the auth server that loaded every access token (fixed), cms instances that are
never evicted, and the admin server buffering complete uploads in memory.

## Measurements

Taken on Node 22 and glibc 2.39 with sharp 0.35.5 and image-steam 0.64.4, which is what the lockfile
resolves to. Peak means peak resident memory of the process. The originals were generated test images, so
real photos will differ somewhat; the proportions are what matters.

### HEIC conversion (one upload)

| Photo         | Before: peak | Before: kept afterwards | After: peak | After: kept afterwards |
| ------------- | ------------ | ----------------------- | ----------- | ---------------------- |
| 12 megapixels | 296 MB       | 180 MB                  | 247 MB      | 95 MB                  |
| 24 megapixels | 523 MB       | 290 MB                  | 385 MB      | 104 MB                 |
| 48 megapixels | 945 MB       | 481 MB                  | 665 MB      | 116 MB                 |

The process is 63 MB when idle. After the change a conversion costs about 13 MB per megapixel on top of
that.

The same uploads against the real server inside a memory cgroup (12, 24, 48, then 12 megapixels again):

| Limit  | Before                                                   | After                                                          |
| ------ | -------------------------------------------------------- | -------------------------------------------------------------- |
| 500 MB | OOM-killed on the 48 megapixel upload                    | 48 megapixels refused with HTTP 415, server alive, peak 407 MB |
| 1 GiB  | All four converted, peak 1001 MB (23 MB below the limit) | All four converted, peak 738 MB                                |

### Resizing (72 requests for 24 uncached originals of 6-26 MB, all at once)

| Setting                              | Peak    | Kept afterwards | Duration |
| ------------------------------------ | ------- | --------------- | -------- |
| Before: 4 processors, 20 prefetchers | 1286 MB | 669 MB          | 11.5 s   |
| `MALLOC_ARENA_MAX=2` only            | 1118 MB | 332 MB          | 11.8 s   |
| `sharp.cache(false)` only            | 1225 MB | 601 MB          | 11.6 s   |
| 2 processors, 4 prefetchers only     | 902 MB  | 609 MB          | 21.5 s   |
| After: all three                     | 536 MB  | 224 MB          | 21.0 s   |

This is a worst case: every original is very large and none is cached. The duration doubles because half
as many images are decoded at once; for normal photos and cached results the difference is not noticeable.

One resize of a single original, for scale: 12 megapixel JPEG 168 MB, 48 megapixel baseline JPEG 165 MB,
48 megapixel progressive JPEG 303 MB, 24 megapixel PNG 145 MB, 250 megapixel interlaced PNG (a 0.8 MB
file) 902 MB.

### Fixed overhead per server

| What                                                 | Cost  | Status                                  |
| ---------------------------------------------------- | ----- | --------------------------------------- |
| OpenTelemetry packages loaded while telemetry is off | 45 MB | Fixed: loaded only when `OTEL_ENABLED`  |
| `npm run start` staying around as parent of node     | 62 MB | Fixed for the image server in the chart |

## Done in this branch

### Image server

| Change                                                                                                   | Where                                               |
| -------------------------------------------------------------------------------------------------------- | --------------------------------------------------- |
| HEIC is decoded in a worker thread that is thrown away after every conversion, so its memory is returned | `apps/image-server/heic.js`, `heic-worker.js`       |
| The raw pixel buffer is released immediately instead of when the garbage collector gets to it            | `apps/image-server/heic.js`                         |
| A HEIC that would not fit under the container memory limit is refused (HTTP 415) instead of converted    | `apps/image-server/heic.js`, `server.js`            |
| Images above 120 megapixels are not resized, configurable with `IMAGE_MAX_INPUT_MEGAPIXELS`              | `apps/image-server/memory-settings.js`, `server.js` |
| libvips operation cache off                                                                              | `apps/image-server/server.js`                       |
| Default throttle from 4 processors and 20 prefetchers to 2 and 4                                         | `memory-settings.js`, chart, `scripts/config.js`    |
| Chart: memory limit of the image server from 500M to 1Gi (request stays 500M)                            | `charts/openstad-headless/values.yaml`              |
| Chart: `MALLOC_ARENA_MAX`, `IMAGE_MAX_INPUT_MEGAPIXELS`, and `node server.js` instead of npm             | `values.yaml`, `templates/image/deployment.yaml`    |

Three of these change behaviour and are worth a conscious decision:

- **The memory limit of 1Gi.** With 500M the server no longer crashes, but refuses HEIC photos above
  roughly 20 megapixels. The default iPhone photo has been 24 megapixels since the iPhone 15, so 500M means
  refusing a lot of ordinary uploads. 1Gi fits everything up to the 50 megapixel cap.
- **The throttle defaults.** Existing installations keep their old values where these are written down:
  an `.env` generated by `scripts/config.js` contains `IMAGE_THROTTLE_CC_PROCESSORS=4` and
  `IMAGE_THROTTLE_CC_PREFETCHER=20`, and a Helm values file may override `image.throttle`. Change those by
  hand. `.testing.env` was left at the old values.
- **The 120 megapixel cap.** An image above it that is already stored can no longer be resized, and with
  local storage (no S3) not served at all. With a 25 MB upload limit such files are rare, and they are the
  ones that could take the server down.

### All servers

| Change                                                     | Where                       |
| ---------------------------------------------------------- | --------------------------- |
| `MALLOC_ARENA_MAX=2` in the development and release images | `Dockerfile`                |
| OpenTelemetry is only loaded when it is enabled            | `packages/lib/telemetry.js` |

### Auth server

| Change                                                                                       | Where                                            |
| -------------------------------------------------------------------------------------------- | ------------------------------------------------ |
| Expired access tokens are removed with one `DELETE` instead of loading the whole table first | `apps/auth-server/memoryStorage/accesstokens.js` |

### Api server

| Change                                                                                             | Where                                                       |
| -------------------------------------------------------------------------------------------------- | ----------------------------------------------------------- |
| The nightly anonymise job handles users one at a time instead of all at once, and catches failures | `apps/api-server/src/cron/project_ended_anonymize_users.js` |
| The key of the public report-block cooldown map is truncated to 255 characters                     | `apps/api-server/src/routes/widget/widget.js`               |

### What was tested and what was not

- Image server: unit tests (including a real HEIC file), the real server end to end with local storage,
  and the cgroup comparison above. **Not tested: S3 storage and a real Kubernetes deployment.**
- Telemetry: memory measured with telemetry off, start and shutdown checked with telemetry on.
- Auth and api changes: read and syntax-checked only. There was no database to run them against.
- Chart changes: not rendered with `helm template`, Helm was not available.

## After deploying

- Tell the two kinds of memory crash apart with `kubectl describe pod`. Exit code **137** with reason
  `OOMKilled` is the container limit (native memory: images, buffers). Exit code **134** with
  `JavaScript heap out of memory` in the log is the V8 heap (large query results, JSON). They need
  different fixes.
- The image server logs `HEIC upload of N megapixels refused` when it protects itself. If that shows up
  for ordinary photos, raise the memory limit.
- If the api server is killed around 02:30 or 04:20, see items 1 and 3 under [Api server](#api-server).

## Larger items

Not implemented. Each has an estimate of effort (S: hours, M: days, L: a week or more) and whether it was
verified by running it or only by reading the code.

### Image server

1. **Check the dimensions of an image when it is uploaded** (M). Only HEIC is checked on upload; everything
   else streams straight to storage and is first decoded when someone requests a resize. An image above
   the pixel cap is therefore accepted and then fails on every view. Reading the header of the upload
   (sharp `metadata()` on the first kilobytes) and refusing it with a 413 gives the uploader an error
   instead of a broken image. Measured: the cap works at resize time.
2. **Decode HEIC with a native library** (M-L). The WebAssembly decoder is the reason a conversion costs
   13 MB per megapixel. A libvips built with libheif and libde265 (a system libvips in the Docker image,
   with sharp built against it) decodes in a streaming fashion at a fraction of that, and would also remove
   the conversion step. The cost is a custom image build instead of the prebuilt sharp binaries. Not
   tested.
3. **jemalloc instead of `MALLOC_ARENA_MAX`** (S-M). This is what the sharp documentation recommends for
   glibc systems: install `libjemalloc2` in the release image and set `LD_PRELOAD`. It fragments less than
   two glibc arenas. Two things to handle: the library path differs per CPU architecture, and sharp raises
   its thread count when it detects jemalloc, so `sharp.concurrency()` has to be set explicitly. Not
   tested.
4. **Stream originals instead of buffering them** (L). image-steam reads every original completely into a
   Buffer (`storage.fetch`) before sharp sees it, which is why the prefetcher count matters so much. This
   is how the library works; changing it means replacing image-steam with a small resize route of our own
   on top of sharp streams. Worth considering together with item 2.
5. **Bound the resize cache in `/tmp`** (S). With S3 the resized images are cached in
   `/tmp/image-steam-cache`, an `emptyDir` without `sizeLimit` that is never cleaned. This is disk, not
   memory, but a full node evicts the pod just the same. Add a `sizeLimit` and a periodic cleanup, or cache
   in S3.
6. **Limit the number of form fields per upload** (S). multer only limits file size and file count. Add
   `fields`, `parts` and `fieldSize` limits. Low risk, since uploads require the image token.

### Api server

Found by reading the code. Nothing here was measured.

1. **The nightly score job loads two whole tables** (S). `src/cron/recalculate_scores.js` runs
   `Resource.findAll()` and `Comment.findAll()` over all projects at 02:30. Loop in batches of a few
   hundred ordered by id. Small change, but it needs a database to test, which is why it is not in this
   branch.
2. **Lists have no limit unless the client asks for one** (M). `src/middleware/pagination.js` applies no
   limit without a `page` parameter, honours `noPagination=true`, and has its page size cap commented out.
   Affected: resources (with `includeComments=1` the joins multiply the rows), votes, submissions,
   choices-guide results and map markers. The admin panel relies on this for its exports
   (`use-votes.tsx`, `use-submission.tsx`), so a hard cap needs those moved to paged fetches first. A cap
   on `pageSize` alone is a small first step.
3. **`GET /api/user` loads every user** (M). Without a `projectId` the route removes `limit` and `offset`
   to deduplicate by identity provider user (`src/routes/api/user.js`). The admin calls this on several
   pages through `useUsers()`. Deduplicate in SQL, and stop fetching the full list where a few names are
   enough.
4. **Comment lists join the full project config onto every row** (S-M). `Comment` scope `includeResource`
   includes `Project` with its `config` JSON, so a list of N comments parses the config N times. Take the
   project from `req.project` instead.
5. **A 10 MB body limit on every route, before authentication** (S). `src/Server.js` parses JSON and
   urlencoded bodies up to 10 MB for everyone. Default to about 1 MB and keep 10 MB for the routes that
   need it (project import, widget config). Needs an inventory of which routes those are.
6. **Project export is built in memory** (M). `src/routes/api/project.js` collects all resources, votes,
   comments, tags and polls and sends them with one `res.json`. Admin only. Stream it.
7. **A Redis client per project save that is never closed** (S). `src/services/message-streaming.js`
   creates and connects a client on each call, without `quit()` and without an error listener. Use one
   shared client. The claim that an error event without a listener crashes the process was not checked
   against the library.
8. **Rejections without a handler end the process** (S-M). There is no `unhandledRejection` handler, and a
   number of promise chains have no catch (`comment.js`, `user-activity.js`, `project.js`). On current
   Node versions that terminates the server. These are crashes, not memory, but they look the same from
   the outside. Add the missing catches; a process-level handler that only logs is a decision to make
   deliberately, because it hides real bugs.
9. **Widget bundles are read from disk on every request** (S). `src/routes/widget/widget-output.js` uses
   `fs.readFileSync` per request and sends the result without cache headers. Garbage, not a leak. Cache
   the file contents per path.

### Auth server

Found by reading the code; the overhead numbers were measured by the audit on Node 22.

1. **Unique code export has no limit** (M). `middleware/code.js` drops the limit for exports and
   `?limit=` is uncapped in `code.js`, `user.js` and `access-code.js`. A client with 100,000 codes is held
   in memory as model instances plus one JSON string. Cap `limit`, use `raw: true`, and page the export.
2. **Full client rows on hot paths** (S). `middleware/client.js` runs `Client.findAll()` including the
   `config` JSON on every user create and update, and `model/user.js` loads roles with their client on
   every `/api/userinfo`, which the api server calls for each authenticated request. Select only
   `id` and `clientId`.
3. **Authorization codes and refresh tokens kept in process memory** (S-M). `memoryStorage/
authorizationcodes.js` and `refreshtokens.js` only remove an entry when it is exchanged, so abandoned
   logins accumulate. With more than one replica the exchange can also arrive at another pod. Add an expiry
   sweep; a database-backed store is the real fix.
4. **`mjml` is loaded at start** (S). `services/email.js` requires it at the top, about 50 MB. Require it
   when the first mail is rendered.
5. **A session row for every request without a cookie** (M). `saveUninitialized: true` writes a row for
   every api-server call and bot. That is database growth, not memory, but it is the same kind of
   unbounded growth. Login flows need testing when this changes.
6. **Missing catches** (S). `auth.js`, `middleware/user.js` and `middleware/code.js` have chains where a
   database error becomes an unhandled rejection.

### Cms server

Found by reading the code against the Apostrophe version in the lockfile. Nothing here was run, and the
cms needs MongoDB and the api to test, which is why none of it is in this branch.

1. **Apostrophe instances are never evicted** (M-L). `app.js` keeps one full Apostrophe instance per site
   in `apostropheServer` and only removes one when the project disappears. Each holds a module tree, a
   template environment, its own MongoDB client and a timer. A crawler that visits a hundred sites once
   fills a 1Gi pod. Track when each instance was last used and destroy idle ones in the existing five
   minute interval, behind settings for the maximum number of sites and the idle time. As a first step,
   log the number of instances and `process.memoryUsage()` after every start, to know how much one site
   costs.
2. **The start-up queue can start the same site twice** (M). In `serveSite` the queued starts are not
   awaited and the busy flag is released while they still run, so two requests for the same new site start
   two instances; the first is overwritten and never destroyed. Starts also run in parallel after a pod
   restart, exactly when memory is tightest. Keep one promise per domain and await the starts. Starting
   strictly one at a time is slower after a restart, so this needs a look at ingress timeouts.
3. **One failing site takes down the pod** (S-M). `apostrophe(projectConfig)` is called without the `exit`
   option, so a start error calls `process.exit(1)`. Several promises are not awaited
   (`apos.destroy()`, `loadProject`, the queued starts). Pass `exit: 'throw'` and handle the errors.
4. **One MongoDB connection pool per site** (S). Each instance connects with the driver defaults. Adding
   `maxPoolSize` and `maxIdleTimeMS` to the connection string is a configuration change; one shared client
   for all sites is the larger fix.
5. **A request to the api for every page view, without timeout** (S). `modules/@apostrophecms/global`
   fetches the project config on each request. When the api is slow, requests and their memory pile up.
   Add a timeout and cache for half a minute.
6. **Editor uploads are resized without limits** (M). Apostrophe's uploadfs runs every size of an uploaded
   image through sharp at once, without a pixel cap. `MALLOC_ARENA_MAX` from the Dockerfile helps here too;
   a cap needs configuration of the attachment module.
7. **Import and export load a whole site in memory** (L). This is in the upstream import-export module.
   Restrict who can use it or give the pod room for it.
8. **`/config-reset` is public and refetches all projects** (S). Debounce it.

### Admin server

Found by reading the code against the Next.js version in the lockfile. Not measured.

1. **Every request body that passes the middleware is buffered completely** (M-L). `src/middleware.ts` has
   no `matcher`, and `next.config.js` sets `proxyClientMaxBodySize` to the upload limit plus 10 MB. Next.js
   buffers the body in memory before proxying, so a few 25 MB uploads at the same time is a real share of a
   500M pod, and raising `MAX_FILE_UPLOAD_SIZE_MB` raises it with it. Send uploads straight to the api or
   the image server instead of through the admin, or exclude the upload routes from the middleware.
2. **An api call on every request, without timeout** (S). `src/auth.ts` validates the session against the
   api each time, before the static-file check in the middleware. Add a timeout and move the cheap checks
   first.
3. **The image optimiser is enabled but unused** (S). There is no `next/image` in `src`, and
   `/_next/image` is exempt from authentication. Set `images: { unoptimized: true }`.

## Configuration recommendations

- **Start node directly in the other deployments too.** The chart's `low-memory.yaml` already does this
  with `customCommand` and `customWorkingDir` for every service. It saves the 62 MB npm parent per pod.
  Only the image server got it by default in this branch, because that is the one that could be tested.
- **`low-memory.yaml` is too small for the image server and the cms.** It sets 256Mi and a 128 MB heap.
  For the image server that means refusing every HEIC above a few megapixels; for a multi-site cms it is
  not enough to hold more than a handful of sites.
- **Probes.** The `probe` values in `values.yaml` are not rendered in the cms, admin and image
  deployments, so a hung server there is not restarted. Not a memory issue, but found on the way.
- **A heap limit per server.** Node derives its heap limit from the container limit, so nothing has to be
  set. Setting `--max-old-space-size` explicitly, as `low-memory.yaml` does, only makes sense together
  with a measurement of what the server needs.
