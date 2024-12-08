import * as core from '@actions/core';
import * as github from '@actions/github';
import { run } from '../index';

jest.mock('@actions/core');
jest.mock('@actions/github');

describe('semver-match action', () => {
  const mockListTags = jest.fn();
  const mockOctokit = {
    rest: {
      repos: {
        listTags: mockListTags
      }
    }
  };

  beforeEach(() => {
    jest.clearAllMocks();
    (github.getOctokit as jest.Mock).mockReturnValue(mockOctokit);

    // Mock both token and repos inputs
    const mockInputs: { [key: string]: string } = {
      token: 'fake-token',
      repos: `
        - repo: gotray/got
          version: v0.1.1
          var_name: GOT_VERSION
      `
    };
    (core.getInput as jest.Mock).mockImplementation((name: string) => mockInputs[name]);
  });

  it('should match exact version from gotray/got', async () => {
    mockListTags.mockResolvedValue({
      data: [{ name: 'v0.1.1' }, { name: 'v0.1.0' }]
    });

    await run();

    expect(github.getOctokit).toHaveBeenCalledWith('fake-token');
    expect(mockListTags).toHaveBeenCalledWith({
      owner: 'gotray',
      repo: 'got',
      per_page: 100
    });

    expect(core.setOutput).toHaveBeenCalledWith('gotray_got_version', 'v0.1.1');
    expect(core.exportVariable).toHaveBeenCalledWith('GOT_VERSION', 'v0.1.1');
  });

  it('should match partial version constraint from gotray/got', async () => {
    mockListTags.mockResolvedValue({
      data: [{ name: 'v0.1.1' }, { name: 'v0.1.0' }]
    });

    // Override only repos input, keep token
    (core.getInput as jest.Mock).mockImplementation(
      (name: string) =>
        ({
          token: 'fake-token',
          repos: `
        - repo: gotray/got
          version: v0.1
          var_name: GOT_VERSION
      `
        })[name]
    );

    await run();

    expect(mockListTags).toHaveBeenCalledWith({
      owner: 'gotray',
      repo: 'got',
      per_page: 100
    });

    expect(core.setOutput).toHaveBeenCalledWith('gotray_got_version', 'v0.1.1');
    expect(core.exportVariable).toHaveBeenCalledWith('GOT_VERSION', 'v0.1.1');
  });

  it('should handle no matching version', async () => {
    mockListTags.mockResolvedValue({
      data: [{ name: 'v0.1.1' }, { name: 'v0.1.0' }]
    });

    // Override only repos input, keep token
    (core.getInput as jest.Mock).mockImplementation(
      (name: string) =>
        ({
          token: 'fake-token',
          repos: `
        - repo: gotray/got
          version: v999.0.0
          var_name: GOT_VERSION
      `
        })[name]
    );

    await run();

    expect(core.setFailed).toHaveBeenCalledWith(
      'Failed to process gotray/got: No matching version found for gotray/got with constraint v999.0.0'
    );
  });

  it('should handle API errors', async () => {
    mockListTags.mockRejectedValue(new Error('API Error'));

    await run();

    expect(core.setFailed).toHaveBeenCalledWith('Failed to process gotray/got: API Error');
  });

  it('should handle wildcards in version constraint', async () => {
    mockListTags.mockResolvedValue({
      data: [{ name: 'v0.1.1' }, { name: 'v0.1.0' }]
    });

    // Override only repos input, keep token
    (core.getInput as jest.Mock).mockImplementation(
      (name: string) =>
        ({
          token: 'fake-token',
          repos: `
        - repo: gotray/got
          version: v0.1.x
          var_name: GOT_VERSION
      `
        })[name]
    );

    await run();

    expect(core.setOutput).toHaveBeenCalledWith('gotray_got_version', 'v0.1.1');
    expect(core.exportVariable).toHaveBeenCalledWith('GOT_VERSION', 'v0.1.1');
  });

  it('should match v1 with highest v1.x.x version', async () => {
    mockListTags.mockResolvedValue({
      data: [{ name: 'v1.2.3' }, { name: 'v1.2.0' }, { name: 'v1.1.0' }, { name: 'v0.9.0' }]
    });

    // Test with v1 constraint
    (core.getInput as jest.Mock).mockImplementation(
      (name: string) =>
        ({
          token: 'fake-token',
          repos: `
        - repo: gotray/got
          version: v1
          var_name: GOT_VERSION
      `
        })[name]
    );

    await run();

    expect(core.setOutput).toHaveBeenCalledWith('gotray_got_version', 'v1.2.3');
    expect(core.exportVariable).toHaveBeenCalledWith('GOT_VERSION', 'v1.2.3');
  });

  it('should match major version with highest matching version', async () => {
    mockListTags.mockResolvedValue({
      data: [
        { name: 'v1.2.3' },
        { name: '1.2.4' },
        { name: 'v1.2.0' },
        { name: '1.1.0' },
        { name: 'v0.9.0' }
      ]
    });

    // Test with major version constraint
    (core.getInput as jest.Mock).mockImplementation(
      (name: string) =>
        ({
          token: 'fake-token',
          repos: `
        - repo: gotray/got
          version: ^1.0.0
          var_name: GOT_VERSION
      `
        })[name]
    );

    await run();

    // semver will find the highest version regardless of the v prefix
    expect(core.setOutput).toHaveBeenCalledWith('gotray_got_version', '1.2.4');
    expect(core.exportVariable).toHaveBeenCalledWith('GOT_VERSION', '1.2.4');
  });

  it('should handle mixed version formats correctly', async () => {
    mockListTags.mockResolvedValue({
      data: [{ name: 'v2.0.0' }, { name: '2.0.1' }, { name: 'v1.9.9' }, { name: '1.9.8' }]
    });

    const testCases = [
      { constraint: '^2.0.0', expected: '2.0.1' }, // Select highest 2.x.x version
      { constraint: 'v2.x.x', expected: '2.0.1' }, // v prefix doesn't affect matching
      { constraint: '^1.0.0', expected: 'v1.9.9' }, // Select highest 1.x.x version
      { constraint: 'v1.x.x', expected: 'v1.9.9' } // v prefix doesn't affect matching
    ];

    for (const testCase of testCases) {
      (core.getInput as jest.Mock).mockImplementation(
        (name: string) =>
          ({
            token: 'fake-token',
            repos: `
          - repo: gotray/got
            version: ${testCase.constraint}
            var_name: GOT_VERSION
        `
          })[name]
      );

      await run();

      expect(core.setOutput).toHaveBeenCalledWith('gotray_got_version', testCase.expected);
      expect(core.exportVariable).toHaveBeenCalledWith('GOT_VERSION', testCase.expected);
    }
  });
});
