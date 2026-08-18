import type { GitHubOrganizationDataAdapter, GitHubOrganizationDataRequest } from "../../../application/githubOrganizationDataAdapter.js";
import { mapGitHubSignalsToNormalizedOrganization } from "../../../application/githubSignalMapper.js";
import { getMockGitHubFixture } from "./fixtures.js";

export class MockGitHubOrganizationAdapter implements GitHubOrganizationDataAdapter {
  async fetchOrganizationData(request: GitHubOrganizationDataRequest) {
    const fixture = getMockGitHubFixture(request.organization);
    return mapGitHubSignalsToNormalizedOrganization(fixture);
  }
}
