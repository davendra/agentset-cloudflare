# CI/CD Configuration

This directory contains GitHub Actions workflows for automated testing, linting, and code quality checks for the AgentSet Cloudflare integration.

## Workflows

### 1. CI Workflow (`ci.yml`)

**Triggers:**
- Push to `main` or `develop` branches
- Pull requests to `main` or `develop` branches
- Manual trigger via `workflow_dispatch`

**Jobs:**

#### Test Job
- Runs unit and integration tests for all packages
- Tests `@agentset/cloudflare-tools`, `@agentset/engine`, and `@agentset/web`
- Uploads test results as artifacts (retained for 7 days)
- **Timeout:** 15 minutes

#### Type Check Job
- Validates TypeScript types across the entire monorepo
- Generates Prisma types before type checking
- Ensures no type errors exist
- **Timeout:** 10 minutes

#### Lint Job
- Runs ESLint on all code
- Runs Prettier format checks
- Ensures code style consistency
- **Timeout:** 10 minutes

#### Security Job
- Runs security-focused test suite
- Validates authentication, authorization, and input validation
- Uploads security test results as artifacts
- **Timeout:** 10 minutes

#### Build Job
- Validates that all packages build successfully
- Generates necessary types and dependencies
- **Timeout:** 15 minutes

#### Quality Gate Job
- Waits for all previous jobs to complete
- Fails if any job fails (except security which is optional)
- Posts results to PR as a comment
- **Always runs** to provide status feedback

### 2. Coverage Workflow (`coverage.yml`)

**Triggers:**
- Push to `main` branch
- Pull requests to `main` branch
- Manual trigger via `workflow_dispatch`

**Jobs:**

#### Coverage Report
- Runs tests with coverage tracking
- Generates coverage reports for all packages
- Uploads coverage to Codecov (if token configured)
- Generates coverage summary in GitHub Actions summary
- Uploads coverage artifacts (retained for 14 days)
- **Quality Gate:** Reports coverage but does not fail build
- **Timeout:** 15 minutes

## Configuration

### Environment Variables

Both workflows use:
- `NODE_VERSION: 22.12.0` - Node.js version
- `PNPM_VERSION: 9.15.4` - pnpm package manager version

### Secrets Required

#### For Coverage Workflow:
- `CODECOV_TOKEN` (optional): Token for uploading coverage to Codecov

#### For Future Deployment Workflows:
- `CLOUDFLARE_API_TOKEN`: Cloudflare API token for Worker deployment
- `CLOUDFLARE_ACCOUNT_ID`: Cloudflare account ID
- `CF_GATEWAY_URL`: Gateway endpoint URL
- `CF_GATEWAY_TOKEN`: Gateway authentication token

## Adding Test Scripts

To enable tests in the CI workflows, add these scripts to package.json files:

### For `agentset/packages/engine/package.json`:
```json
{
  "scripts": {
    "test": "vitest run",
    "test:coverage": "vitest run --coverage",
    "test:watch": "vitest"
  }
}
```

### For `agentset/packages/cloudflare-tools/package.json`:
```json
{
  "scripts": {
    "test": "vitest run",
    "test:coverage": "vitest run --coverage",
    "test:watch": "vitest"
  },
  "devDependencies": {
    "vitest": "^2.0.0",
    "@vitest/coverage-v8": "^2.0.0"
  }
}
```

### For `agentset/apps/web/package.json`:
```json
{
  "scripts": {
    "test": "vitest run",
    "test:unit": "vitest run src/**/*.test.ts",
    "test:integration": "vitest run src/**/*.integration.test.ts",
    "test:security": "vitest run src/**/*.security.test.ts",
    "test:performance": "vitest run src/**/*.performance.test.ts",
    "test:coverage": "vitest run --coverage",
    "test:watch": "vitest"
  },
  "devDependencies": {
    "vitest": "^2.0.0",
    "@vitest/coverage-v8": "^2.0.0"
  }
}
```

## Running Workflows Locally

### Prerequisites
```bash
# Install dependencies
pnpm install

# Generate Prisma types
cd agentset
pnpm db:generate
```

### Run Tests
```bash
cd agentset

# Run all tests
pnpm --filter @agentset/engine test
pnpm --filter @agentset/cloudflare-tools test
pnpm --filter @agentset/web test

# Run specific test suites
pnpm --filter @agentset/web test:unit
pnpm --filter @agentset/web test:integration
pnpm --filter @agentset/web test:security
pnpm --filter @agentset/web test:performance
```

### Run Type Check
```bash
cd agentset
pnpm typecheck
```

### Run Lint
```bash
cd agentset
pnpm lint
pnpm format
```

### Run Coverage
```bash
cd agentset
pnpm --filter @agentset/engine test:coverage
pnpm --filter @agentset/cloudflare-tools test:coverage
pnpm --filter @agentset/web test:coverage
```

## CI/CD Best Practices

### Pull Request Workflow
1. Create feature branch from `develop`
2. Make changes and commit
3. Push to GitHub - CI workflow triggers automatically
4. Review CI results in PR checks
5. Address any failures
6. Merge when all checks pass

### Quality Standards
- **Type Safety:** All code must pass TypeScript strict mode
- **Linting:** Code must pass ESLint and Prettier checks
- **Testing:** New features require tests
- **Security:** Security-sensitive code requires security tests
- **Coverage:** Aim for 80%+ code coverage
- **Build:** All packages must build successfully

### Debugging Failed Workflows
1. Click on the failed workflow in the PR
2. Expand the failed job
3. Review the logs for error messages
4. Download artifacts for detailed reports
5. Run the same command locally to reproduce
6. Fix the issue and push again

## Performance Optimization

### Caching
- Node modules are cached between runs using `cache: 'pnpm'`
- Reduces install time from ~2min to ~30s

### Concurrency
- Workflows cancel previous runs on new pushes (`cancel-in-progress: true`)
- Prevents wasted CI minutes on outdated code

### Parallelization
- Jobs run in parallel where possible
- Quality gate waits for all jobs to complete

### Timeouts
- Each job has timeout limits to prevent hanging workflows
- Adjust timeouts in workflow files if needed

## Monitoring

### GitHub Actions Dashboard
- View workflow runs: `Actions` tab in repository
- Filter by workflow, branch, or status
- Download artifacts for test reports

### Coverage Reports
- View in GitHub Actions summary
- Upload to Codecov for trend analysis
- Review coverage changes in PRs

### Quality Metrics
- Track test pass rate over time
- Monitor build times for performance
- Review security test results

## Future Enhancements

### Planned Workflows (Task 16):
1. **Worker Deployment** - Automated Cloudflare Worker deployment
2. **Integration Tests** - Real Worker integration tests
3. **Security Scans** - Dependency vulnerability scanning
4. **Performance Tests** - Load testing on deployed Workers

### Additional Configuration:
1. **Branch Protection** - Require CI to pass before merge
2. **CODEOWNERS** - Automatic reviewer assignment
3. **Status Badges** - README badges for build status
4. **Slack Notifications** - Alerts for CI failures

## Troubleshooting

### Common Issues

#### Tests Not Running
**Problem:** `No tests found` message in CI logs
**Solution:** Add test scripts to package.json (see "Adding Test Scripts")

#### Type Errors
**Problem:** TypeScript errors in CI but not locally
**Solution:** Ensure you've run `pnpm db:generate` locally

#### Lint Failures
**Problem:** ESLint/Prettier errors
**Solution:** Run `pnpm lint:fix` and `pnpm format:fix` locally

#### Build Failures
**Problem:** Package fails to build in CI
**Solution:** Run `pnpm build` locally to reproduce, check for missing dependencies

#### Timeout Errors
**Problem:** Workflow times out
**Solution:** Increase timeout in workflow file or optimize tests

## Support

For CI/CD issues or questions:
1. Check workflow logs for error details
2. Review this README for common solutions
3. Check `CONTRIBUTING.md` for development workflow
4. Open an issue with CI logs attached
