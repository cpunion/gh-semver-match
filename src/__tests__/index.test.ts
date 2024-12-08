import * as core from '@actions/core';

// Mock the GitHub API response
const mockListTags = jest.fn();

// Mock the @actions/github module
jest.mock('@actions/github', () => ({
  getOctokit: jest.fn(() => ({
    rest: {
      repos: {
        listTags: mockListTags
      }
    }
  }))
}));

// Mock the @actions/core module
jest.mock('@actions/core', () => ({
  getMultilineInput: jest.fn(),
  setOutput: jest.fn(),
  exportVariable: jest.fn(),
  setFailed: jest.fn()
}));

// Import the function after mocking
import { run } from '../index';

describe('semver-match action', () => {
  beforeEach(() => {
    // Clear all mocks before each test
    jest.clearAllMocks();

    // Mock process.env.GITHUB_TOKEN
    process.env.GITHUB_TOKEN = 'fake-token';
  });

  it('should match latest version from gotray/got', async () => {
    // Mock the GitHub API response with real gotray/got tags
    mockListTags.mockResolvedValueOnce({
      data: [{ name: 'v0.2.0' }, { name: 'v0.1.1' }, { name: 'v0.1.0' }]
    });

    // Mock the action input
    (core.getMultilineInput as jest.Mock).mockReturnValue([
      JSON.stringify({ repo: 'gotray/got', version: 'latest' })
    ]);

    await run();

    // Verify the GitHub API was called correctly
    expect(mockListTags).toHaveBeenCalledWith({
      owner: 'gotray',
      repo: 'got',
      per_page: 100
    });

    // Verify outputs were set correctly
    expect(core.setOutput).toHaveBeenCalledWith('gotray_got_version', 'v0.2.0');
    expect(core.setOutput).toHaveBeenCalledWith(
      'gotray_got_download_url',
      'https://github.com/gotray/got/releases/download/v0.2.0/got-v0.2.0.tar.gz'
    );
  });

  it('should match specific version constraint from gotray/got', async () => {
    mockListTags.mockResolvedValueOnce({
      data: [{ name: 'v0.2.0' }, { name: 'v0.1.1' }, { name: 'v0.1.0' }]
    });

    (core.getMultilineInput as jest.Mock).mockReturnValue([
      JSON.stringify({ repo: 'gotray/got', version: '>= v0.1.0' })
    ]);

    await run();

    expect(mockListTags).toHaveBeenCalledWith({
      owner: 'gotray',
      repo: 'got',
      per_page: 100
    });

    expect(core.setOutput).toHaveBeenCalledWith('gotray_got_version', 'v0.2.0');
  });

  it('should handle custom download file pattern', async () => {
    mockListTags.mockResolvedValueOnce({
      data: [{ name: 'v0.2.0' }, { name: 'v0.1.1' }, { name: 'v0.1.0' }]
    });

    (core.getMultilineInput as jest.Mock).mockReturnValue([
      JSON.stringify({
        repo: 'gotray/got',
        version: 'latest',
        downloadFile: '${repo}_${version}_linux_amd64.tar.gz'
      })
    ]);

    await run();

    expect(core.setOutput).toHaveBeenCalledWith(
      'gotray_got_download_url',
      'https://github.com/gotray/got/releases/download/v0.2.0/got_v0.2.0_linux_amd64.tar.gz'
    );
  });

  it('should set environment variables when specified', async () => {
    mockListTags.mockResolvedValueOnce({
      data: [{ name: 'v0.2.0' }, { name: 'v0.1.1' }, { name: 'v0.1.0' }]
    });

    (core.getMultilineInput as jest.Mock).mockReturnValue([
      JSON.stringify({
        repo: 'gotray/got',
        version: 'latest',
        env: {
          version: 'GOT_VERSION',
          downloadURL: 'GOT_URL'
        }
      })
    ]);

    await run();

    expect(core.exportVariable).toHaveBeenCalledWith('GOT_VERSION', 'v0.2.0');
    expect(core.exportVariable).toHaveBeenCalledWith(
      'GOT_URL',
      'https://github.com/gotray/got/releases/download/v0.2.0/got-v0.2.0.tar.gz'
    );
  });

  it('should handle no matching version', async () => {
    mockListTags.mockResolvedValueOnce({
      data: [{ name: 'v0.2.0' }, { name: 'v0.1.1' }, { name: 'v0.1.0' }]
    });

    (core.getMultilineInput as jest.Mock).mockReturnValue([
      JSON.stringify({ repo: 'gotray/got', version: '>= v1.0.0' })
    ]);

    await run();

    expect(core.setFailed).toHaveBeenCalledWith(
      'No matching version found for gotray/got with constraint >= v1.0.0'
    );
  });

  it('should handle API errors', async () => {
    mockListTags.mockRejectedValueOnce(new Error('API Error'));

    (core.getMultilineInput as jest.Mock).mockReturnValue([
      JSON.stringify({ repo: 'gotray/got', version: 'latest' })
    ]);

    await run();

    expect(core.setFailed).toHaveBeenCalledWith('Failed to fetch tags from gotray/got: API Error');
  });
});
