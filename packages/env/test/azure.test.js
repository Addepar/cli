import expect from 'expect';
import PercyEnvironment from '../src';

describe('Azure', () => {
  let env;

  beforeEach(() => {
    env = new PercyEnvironment({
      BUILD_BUILDID: 'azure-build-id',
      BUILD_SOURCEVERSION: 'azure-commit-sha',
      BUILD_SOURCEBRANCHNAME: 'azure-branch',
      SYSTEM_PARALLELEXECUTIONTYPE: 'None',
      TF_BUILD: 'True'
    });
  });

  it('has the correct properties', () => {
    expect(env).toHaveProperty('ci', 'azure');
    expect(env).toHaveProperty('commit', 'azure-commit-sha');
    expect(env).toHaveProperty('branch', 'azure-branch');
    expect(env).toHaveProperty('target.commit', null);
    expect(env).toHaveProperty('target.branch', null);
    expect(env).toHaveProperty('pullRequest', null);
    expect(env).toHaveProperty('parallel.nonce', 'azure-build-id');
    expect(env).toHaveProperty('parallel.total', null);
  });

  it('has the correct properties for parallel build', () => {
    env = new PercyEnvironment({
      ...env.vars,
      SYSTEM_PARALLELEXECUTIONTYPE: 'MultiMachine',
      SYSTEM_TOTALJOBSINPHASE: '5'
    });

    expect(env).toHaveProperty('parallel.nonce', 'azure-build-id');
    expect(env).toHaveProperty('parallel.total', 5);
  });

  it('has the correct properties for PR builds', () => {
    env = new PercyEnvironment({
      ...env.vars,
      SYSTEM_PULLREQUEST_PULLREQUESTNUMBER: '512',
      SYSTEM_PULLREQUEST_SOURCECOMMITID: 'azure-pr-commit-sha',
      SYSTEM_PULLREQUEST_SOURCEBRANCH: 'azure-pr-branch'
    });

    expect(env).toHaveProperty('pullRequest', '512');
    expect(env).toHaveProperty('branch', 'azure-pr-branch');
    expect(env).toHaveProperty('commit', 'azure-pr-commit-sha');
  });
});
