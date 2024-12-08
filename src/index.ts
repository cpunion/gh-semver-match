import * as core from '@actions/core';
import * as github from '@actions/github';
import * as yaml from 'yaml';
import * as semver from 'semver';

interface RepoConfig {
  repo: string;
  version: string;
  var_name: string;
}

async function getMatchingVersion(
  octokit: ReturnType<typeof github.getOctokit>,
  owner: string,
  repo: string,
  constraint: string
): Promise<string> {
  // Get all tags
  const response = await octokit.rest.repos.listTags({
    owner,
    repo,
    per_page: 100
  });

  core.debug(
    `Found ${response.data.length} tags: ${response.data.map((tag) => tag.name).join(', ')}`
  );

  // Find matching version
  const versions = response.data
    .map((tag) => tag.name)
    .filter((version) => semver.valid(version)) // semver handles v prefix automatically
    .sort((a, b) => semver.rcompare(a, b));

  const matchingVersion = versions.find((version) => semver.satisfies(version, constraint));

  if (!matchingVersion) {
    throw new Error(`No matching version found for ${owner}/${repo} with constraint ${constraint}`);
  }

  return matchingVersion;
}

export async function run(): Promise<void> {
  try {
    // Get inputs
    const token = core.getInput('token', { required: true });
    const reposYaml = core.getInput('repos', { required: true });

    // Parse repos config
    const repos = yaml.parse(reposYaml) as RepoConfig[];

    // Create octokit instance
    const octokit = github.getOctokit(token);

    // Process each repository
    for (const config of repos) {
      core.debug(`Processing repository: ${config.repo}`);

      // Split repo into owner and name
      const [owner, repoName] = config.repo.split('/');

      try {
        const matchedVersion = await getMatchingVersion(octokit, owner, repoName, config.version);

        // Set outputs
        const outputKey = `${owner}_${repoName}_version`.toLowerCase();
        core.setOutput(outputKey, matchedVersion);

        // Set environment variable if specified
        if (config.var_name) {
          core.exportVariable(config.var_name, matchedVersion);
        }
      } catch (error) {
        if (error instanceof Error) {
          throw new Error(`Failed to process ${config.repo}: ${error.message}`);
        }
        throw error;
      }
    }
  } catch (error) {
    if (error instanceof Error) {
      core.setFailed(error.message);
    }
  }
}

// Only run if this is the main module
if (require.main === module) {
  run();
}
