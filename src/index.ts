import * as core from '@actions/core';
import * as github from '@actions/github';
import * as semver from 'semver';
import * as yaml from 'yaml';

interface RepoInput {
  repo: string;
  version: string;
  var_name: string;
}

async function getVersions(repo: string): Promise<string[]> {
  const [owner, repoName] = repo.split('/');
  const octokit = github.getOctokit(process.env.GITHUB_TOKEN || '');

  try {
    const response = await octokit.rest.repos.listTags({
      owner,
      repo: repoName,
      per_page: 100
    });

    return response.data.map((tag) => tag.name);
  } catch (error) {
    if (error instanceof Error) {
      throw new Error(`Failed to fetch tags from ${repo}: ${error.message}`);
    }
    throw error;
  }
}

function findMatchingVersion(versions: string[], constraint: string): string | null {
  // Handle 'latest' version specially
  if (constraint.toLowerCase() === 'latest') {
    return versions[0] || null;
  }

  // Find all versions that satisfy the constraint
  const satisfyingVersions = versions.filter((v) => {
    const cleanVersion = semver.clean(v);
    return cleanVersion && semver.satisfies(cleanVersion, constraint);
  });

  // Return the highest satisfying version, or null if none found
  return satisfyingVersions.length > 0 ? satisfyingVersions[0] : null;
}

export async function run(): Promise<void> {
  try {
    const reposInput = core.getInput('repos', { required: true });
    const repos = yaml.parse(reposInput) as RepoInput[];

    const results: Record<string, string> = {};

    for (const repo of repos) {
      const versions = await getVersions(repo.repo);
      const match = findMatchingVersion(versions, repo.version);

      if (!match) {
        throw new Error(
          `No matching version found for ${repo.repo} with constraint ${repo.version}`
        );
      }

      // Store results for output
      results[repo.repo] = match;

      // Set step outputs
      const outputId = repo.repo.replace('/', '_');
      core.setOutput(`${outputId}_version`, match);

      // Set environment variable if specified
      if (repo.var_name) {
        core.exportVariable(repo.var_name, match);
      }
    }

    // Set combined output
    core.setOutput('matched_versions', results);
  } catch (error) {
    if (error instanceof Error) {
      core.setFailed(error.message);
    } else {
      core.setFailed('An unexpected error occurred');
    }
  }
}

// Only call run() if this is the main module
if (require.main === module) {
  run();
}
