# GitHub Workflows & Automation

This directory contains GitHub Actions workflows for the **AgentSet × Cloudflare** workspace.

## 🚀 Overview

The workspace uses GitHub Actions for:
- **Automated PR labeling** based on changed files
- **Auto-merge functionality** for approved PRs
- **Workflow organization** for both workspace and submodule repositories

## 📂 Directory Structure

```
.github/
├── README.md              # This file
├── labeler.yml            # Label configuration for auto-labeling PRs
├── workflows/             # GitHub Actions workflows
│   ├── auto-merge.yml     # Automatic PR merging with automerge label
│   └── labeler.yml        # PR auto-labeling workflow
└── codeql/                # CodeQL security scanning configuration
```

## 🔄 Active Workflows

### 1. PR Auto-Labeling (`labeler.yml`)

**Triggers**: Pull request events (opened, synchronized, reopened)

**Purpose**: Automatically labels PRs based on which files are changed

**Configuration**: Labels defined in `.github/labeler.yml`

**Example Labels**:
- `documentation` - Changes to `.md` files
- `worker` - Changes to Worker code
- `frontend` - Changes to AgentSet UI
- `infrastructure` - Changes to Terraform/deployment files

### 2. Auto-Merge (`auto-merge.yml`)

**Triggers**: PRs labeled with `automerge`

**Purpose**: Automatically merges approved PRs that pass all checks

**Features**:
- Waits for all status checks to pass
- Uses squash merge strategy
- Skips draft PRs
- Requires PR approval (if branch protection enabled)

**Usage**:
```bash
# Add automerge label to PR
gh pr edit <number> --add-label automerge
```

## 📋 Submodule Workflows

The **agentset-cloudflare-app** submodule has its own comprehensive CI/CD:

- **Worker Deployment** - Automated Cloudflare Worker deployment
- **Testing** - Unit, integration, and Worker-specific tests
- **Linting** - ESLint, Prettier, Markdown, Terraform validation
- **Security** - CodeQL, dependency scanning, secret detection
- **Release Management** - Automated versioning and changelog

**See**: [`agentset-cloudflare-app/.github/workflows/README.md`](../agentset-cloudflare-app/.github/workflows/README.md)

## 🏷️ Available Labels

### Auto-Applied Labels

These labels are automatically applied based on changed files:

| Label | Applied When |
|-------|--------------|
| `documentation` | Markdown files changed |
| `worker` | Worker source code changed |
| `frontend` | AgentSet UI code changed |
| `infrastructure` | Terraform or deployment configs changed |
| `dependencies` | Package.json or lock files changed |
| `ci` | GitHub Actions workflows changed |

### Manual Labels

These labels are manually applied to control workflows:

| Label | Purpose |
|-------|---------|
| `automerge` | Enable automatic merging when checks pass |
| `needs-review` | Request review before merging |
| `enhancement` | Feature requests and improvements |
| `bug` | Bug fixes |
| `breaking-change` | Breaking API changes |

## 🛠️ Workflow Configuration

### Enable Auto-Merge for PRs

```bash
# Via GitHub CLI
gh pr edit <number> --add-label automerge

# Or via GitHub UI
# Add "automerge" label to the PR
```

### Customize Auto-Labeling

Edit `.github/labeler.yml` to add new label rules:

```yaml
documentation:
  - changed-files:
    - any-glob-to-any-file: '**/*.md'

worker:
  - changed-files:
    - any-glob-to-any-file: 'agentset-cloudflare-app/apps/cf-worker/**/*'
```

## 📊 Monitoring Workflows

### View Workflow Runs

```bash
# List recent workflow runs
gh run list

# View specific run details
gh run view <run-id>

# Watch a run in progress
gh run watch
```

### Check PR Status

```bash
# View PR checks
gh pr checks <number>

# View PR details
gh pr view <number>
```

## 🔐 Required Permissions

For workflows to function properly, ensure:

1. **Workflow Permissions** (Settings → Actions → General):
   - ✅ Read and write permissions
   - ✅ Allow GitHub Actions to create and approve pull requests

2. **Branch Protection** (Settings → Branches → main):
   - ✅ Require status checks to pass
   - ✅ Require pull request reviews (recommended)

## 🚨 Troubleshooting

### Auto-Merge Not Working

**Problem**: PR with `automerge` label doesn't merge

**Check**:
1. Are all status checks passing?
2. Is the PR approved (if required)?
3. Are workflow permissions enabled?
4. Is the PR a draft?

**Solution**: Review PR checks and ensure all requirements are met

### Labels Not Auto-Applied

**Problem**: Labels don't appear when PR is opened

**Check**:
1. Is the labeler workflow running? (Check Actions tab)
2. Does `.github/labeler.yml` have matching patterns?
3. Are the changed files matching the glob patterns?

**Solution**: Review workflow logs and labeler configuration

## 📚 Related Documentation

- **[Workspace README](../README.md)** - Workspace overview and structure
- **[agentset-cloudflare-app Workflows](../agentset-cloudflare-app/.github/workflows/README.md)** - Comprehensive CI/CD documentation
- **[Contributing Guide](../agentset-cloudflare-app/CONTRIBUTING.md)** - Development workflow
- **[GitHub Actions Docs](https://docs.github.com/en/actions)** - Official GitHub Actions documentation

## 🤝 Contributing

To add new workflows or modify existing ones:

1. Create or edit workflow files in `.github/workflows/`
2. Test workflows using `workflow_dispatch` triggers
3. Document changes in this README
4. Submit PR with changes

---

**Last Updated**: October 28, 2025
**Workspace**: AgentSet × Cloudflare Integration
