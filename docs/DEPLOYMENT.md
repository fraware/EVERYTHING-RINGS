# Static deployment

EVERYTHING RINGS is a static, local-first web application. Production deployment requires HTTPS so browsers can grant microphone access.

The repository includes `.github/workflows/pages.yml`, which builds the web app with the repository subpath as its Vite base and deploys `apps/web/dist` from `main`.

## First deployment

GitHub Pages must be enabled for the repository once, with **GitHub Actions** selected as the Pages source. Repository workflow credentials cannot perform this first administrative enablement.

The deployment workflow checks that repository state first. Until Pages is enabled, deployment is skipped cleanly instead of producing a false application failure. After Pages is enabled, pushes to `main` run the build and deployment automatically; a manual workflow dispatch is also available.

No application server, account service, or audio-upload backend is required.

## Privacy boundary

The deployed application performs capture and analysis in the browser. MVP-0 does not upload microphone PCM. The validation evidence export is created locally and explicitly excludes raw microphone samples.
