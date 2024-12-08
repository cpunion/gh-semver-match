# gh-semver-match

A GitHub Action to match semantic versions from GitHub repositories and set them as outputs and environment variables.

## Usage

```yaml
- uses: cpunion/gh-semver-match@v1
  with:
    repos: |
      - repo: gotray/got
        version: v1.1.0
        var_name: GOT_VERSION
      - repo: another/repo
        version: latest
        var_name: ANOTHER_VERSION
```

## Inputs

The action takes a single input `repos` which is a YAML list of repository configurations. Each repository configuration supports:

- `repo`: GitHub repository in owner/repo format (required)
- `version`: Semantic version constraint or 'latest' (required)
- `var_name`: Environment variable name to store the matched version (required)

## Outputs

For each repository in the input list, the action will set:

- `steps.<step-id>.outputs.<repo>_version`: The matched version (where `<repo>` is the repository name with '/' replaced by '\_')
- Environment variable with name specified by `var_name` containing the matched version

The action also sets a combined output:

- `steps.<step-id>.outputs.matched_versions`: JSON object containing all matched versions

## Example

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
          repos: |
            - repo: gotray/got
              version: v1.1.0
              var_name: GOT_VERSION

      - name: Use matched version
        run: |
          echo "Got version: ${{ env.GOT_VERSION }}"
          echo "Got version (from outputs): ${{ steps.versions.outputs.gotray_got_version }}"
```

## License

MIT
