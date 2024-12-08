# gh-semver-match

A GitHub Action to match semantic versions from GitHub repositories and set them as outputs and environment variables. Version matching is powered by [node-semver](https://github.com/npm/node-semver), following the [Semantic Versioning 2.0.0](https://semver.org/) specification.

## Usage

```yaml
- uses: cpunion/gh-semver-match@v1
  with:
    token: ${{ github.token }} # Required for API access
    repos: |
      - repo: gotray/got
        version: ^1.0.0        # Match highest 1.x.x version
        var_name: GOT_VERSION
      - repo: another/repo
        version: ~2.1.0        # Match highest 2.1.x version
        var_name: ANOTHER_VERSION
```

## Inputs

The action takes the following inputs:

- `token`: GitHub token for API access (required)
- `repos`: YAML list of repository configurations (required)

Each repository configuration supports:

- `repo`: GitHub repository in owner/repo format (required)
- `version`: Semantic version constraint (required). Supports all [node-semver range formats](https://github.com/npm/node-semver#ranges):
  - Exact version: `v1.2.3` or `1.2.3`
  - Major version: `^1.0.0` or `1.x.x` (matches highest 1.x.x)
  - Minor version: `~1.2.0` or `1.2.x` (matches highest 1.2.x)
  - Wildcards: `*.*.x`, `1.*.0`, etc.
  - Advanced ranges: `>=1.2.3 <2.0.0`, `1.2.3 - 2.3.4`
  - The `v` prefix is optional and will be handled correctly
- `var_name`: Environment variable name to store the matched version (required)

## Version Matching

This action uses [node-semver](https://github.com/npm/node-semver) for version matching, which provides a robust implementation of the [Semantic Versioning 2.0.0](https://semver.org/) specification. Some key points about version matching:

- Version constraints can use any valid semver range syntax
- The `v` prefix (e.g., `v1.2.3`) is optional and handled automatically
- When matching a range (e.g., `^1.0.0`), the highest matching version will be selected
- Pre-release versions (e.g., `1.2.3-beta.1`) are supported but not included in range matching by default

For detailed information about version range syntax and behavior, refer to:

- [node-semver documentation](https://github.com/npm/node-semver#ranges)
- [Semantic Versioning specification](https://semver.org/)

## Outputs

For each repository in the input list, the action will set:

- `steps.<step-id>.outputs.<repo>_version`: The matched version (where `<repo>` is the repository name with '/' replaced by '\_')
- Environment variable with name specified by `var_name` containing the matched version

## Examples

### Match Latest Major Version

```yaml
name: Build
on: [push]

jobs:
  build:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - name: Match versions
        id: versions
        uses: cpunion/gh-semver-match@v1
        with:
          token: ${{ github.token }}
          repos: |
            - repo: gotray/got
              version: ^1.0.0  # Will match highest 1.x.x version
              var_name: GOT_VERSION
            - repo: another/repo
              version: ~2.1.0  # Will match highest 2.1.x version
              var_name: ANOTHER_VERSION

      - name: Use matched versions
        run: |
          echo "Got version: ${{ env.GOT_VERSION }}"
          echo "Got version (from outputs): ${{ steps.versions.outputs.gotray_got_version }}"
          echo "Another version: ${{ env.ANOTHER_VERSION }}"
```

### Match Exact Version

```yaml
- name: Match exact version
  uses: cpunion/gh-semver-match@v1
  with:
    token: ${{ github.token }}
    repos: |
      - repo: gotray/got
        version: v1.2.3  # Will only match exactly v1.2.3
        var_name: GOT_VERSION
```

## Development

The `dist` directory contains the compiled action code and is required for the action to work. A pre-commit hook will automatically check if the dist files are up to date with your source code changes. If the check fails:

1. Run `npm run build` to update the dist files
2. Stage the updated dist files
3. Try committing again

This ensures that the action is always deployable with the latest changes.

## License

MIT
