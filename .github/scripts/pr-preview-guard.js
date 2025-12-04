module.exports = async ({ github, context, status }) => {
  const { owner, repo } = context.repo;
  const checkName = "preview-publish-guard";
  const branch = process.env.BRANCH;
  const packageVersion = process.env.PACKAGE_VERSION;
  const packageName = process.env.PACKAGE_NAME;

  console.log(`Status: ${status}`);
  console.log(`Package name: ${packageName}`);
  console.log(`Package version: ${packageVersion}`);

  const pr = await github.rest.pulls.list({
    owner,
    repo,
    head: `${owner}:${branch}`,
    base: "main",
    state: "open",
  }).then(({ data }) => data.find((pr) => {
    return pr.labels.some((label) => label.name === "automated");
  }));

  if (!pr) throw new Error("No PR found for this branch");

  async function createCheck(data) {
    const existingCheck = await github.rest.checks.listForRef({
      owner,
      repo,
      ref: pr.head.sha,
      check_name: checkName,
    }).then(res => res.data.check_runs[0]);

    if (existingCheck) {
      return github.rest.checks.update({
        owner,
        repo,
        check_run_id: existingCheck.id,
        ...data,
      });
    }

    return github.rest.checks.create({
      owner,
      repo,
      name: checkName,
      head_sha: pr.head.sha,
      ...data,
    });
  }

  switch (status) {
    case "started": {
      await createCheck({
        status: 'in_progress',
        output: {
          title: '🚀 Publishing preview version...',
          summary: 'A preview version is being published.',
        }
      });
      break;
    }
    case "success": {
      const npmUrl = `https://www.npmjs.com/package/${packageName}/v/${packageVersion}`;

      await createCheck({
        status: 'completed',
        conclusion: 'success',
        output: {
          title: `✅ Preview version published successfully`,
          summary: `[NPM Package](${npmUrl})\n\n`,
        }
      });
      break;
    }
    case "failure": {
      await createCheck({
        status: 'completed',
        conclusion: 'failure',
        output: {
          title: '❌ Preview publication failed',
          summary: 'Preview publication encountered an error.\n\n' +
            'Please check the workflow logs for more information.',
        }
      });
      break;
    }
    default:
      throw new Error("invalid guard status");
  }

  console.log(`PR guard for PR #${pr.number} with status ${status} completed successfully`);
};
