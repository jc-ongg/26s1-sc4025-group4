# CI and continuous delivery

Every push to `main` and pull request targeting `main` runs the GitHub Actions workflow in `.github/workflows/ci.yml`. It can also be started manually from the Actions tab.

## Pipeline

1. **Code checks:** install the locked npm dependencies on Node 22, generate the Prisma client, check formatting and TypeScript, run unit tests, and build both applications.
2. **Docker integration:** build all three services, apply database migrations and seed a fresh database. Wait for database, backend and frontend health checks, then verify HTTP authentication, dining rules and real-model semantic discovery. The project uses a unique `eatigo-ci-` name and a separate database volume. Only those temporary resources are removed afterward.
3. **Prepare release:** after both jobs pass on `main`, package the exact tested commit as `source.zip`, with its commit ID, SHA-256 checksum, integration evidence, deployment script and these instructions. Pull requests run checks without producing a deployable release.

The pipeline is **continuous integration and continuous delivery**. Deployment requires a deliberate command on the laptop. It is not automatic continuous deployment. GitHub builds and tests the application; the running application remains self-hosted and has no GitHub runtime dependency.

## Deploy a release on Windows

1. Open the successful **CI and delivery** run in GitHub Actions. Download its `eatigo-release-<commit>` artifact within three days. Expired artifacts can be recreated by rerunning the workflow.
2. Extract it into a new folder. Start Docker Desktop with Linux containers.
3. Open PowerShell in that folder and run:

```powershell
# Optional: validate the archive without changing the running application.
./deploy.ps1 -ValidateOnly

# Verify the archive, build its source and start the application.
./deploy.ps1
```

Open http://localhost:3000. The script verifies that `/version.json` reports the released commit. The default Compose project is `26s1-sc4025-group4`, matching the normal project-folder startup and preserving its existing PostgreSQL volume. If your existing stack uses a custom project name, pass that exact name with `-ProjectName`; a different project creates a separate database. Stop other applications occupying the chosen port before starting a new project.

The script does not delete database volumes. Startup applies migrations and inserts missing seed records. Deploying updates the running services and can briefly interrupt use. Back up important data before database changes; deploying older source does not undo migrations. After a failed deployment, inspect Compose logs in the extracted `app` directory with the same project name. The script refuses to overwrite an existing `app` folder; retry from a newly extracted release folder.

This release contains tested **source**, not a registry image. The laptop rebuilds Docker images and downloads dependencies/model files if they are not cached. npm versions are locked, the embedding model revision and pgvector version are pinned, but Docker base tags and operating-system packages can change. It is not guaranteed to recreate byte-identical CI images. The checksum detects an altered or damaged archive; it is not a digital signature.

## Run the integration job locally

With Docker Desktop and Node 22.12+ available:

```powershell
npm run ci:integration
```

It uses loopback port 3001 and a newly generated project name, leaving the demo on port 3000 alone. It writes `tmp/ci/evidence.json`; failures also capture container logs. The integration script refuses an existing project name before starting or removing anything. `npm run release:package` requires a clean Git checkout and passing evidence for the current commit. Temporary output is ignored by Git.

## Presentation and report wording

Show the three jobs in a successful Actions run, open the integration test output, then show the downloadable release artifact. On the laptop, show `deploy.ps1 -ValidateOnly` and `/version.json`. A full Docker rebuild is better demonstrated beforehand or in a shortened recording.

Suggested wording: “A GitHub Actions pipeline checks formatting, types, unit tests and production builds, then validates Docker services against a fresh PostgreSQL database. Passing main-branch commits produce a versioned source release. Deployment to the self-hosted laptop is manual, with archive verification, health checks and commit verification.”

CI verifies engineering behaviour on demo fixtures; it does not establish usability or semantic recommendation quality across a representative dataset. It does not run browser UI tests, deploy directly to the laptop, publish Docker images, or provide database rollback. GitHub account quotas apply, and cold builds download the local model. Integration artifacts are retained for one day and release artifacts for three days.

## References

- [GitHub Actions workflow syntax](https://docs.github.com/en/actions/reference/workflows-and-actions/workflow-syntax)
- [Workflow artifacts](https://docs.github.com/en/actions/concepts/workflows-and-actions/workflow-artifacts)
- [Docker Compose startup and health waiting](https://docs.docker.com/reference/cli/docker/compose/up/)
