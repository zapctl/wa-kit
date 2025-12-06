module.exports = async ({ github, context }) => {
  const { owner, repo } = context.repo;
  const branch = process.env.BRANCH || process.env.PREVIEW_BRANCH;
  const packageVersion = process.env.PACKAGE_VERSION;
  const packageName = process.env.PACKAGE_NAME;

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

  const npmUrl = `https://www.npmjs.com/package/${packageName}/v/${packageVersion}`;

  await github.rest.issues.createComment({
    owner,
    repo,
    issue_number: pr.number,
    body: `## 📦 Preview packages published` +
      `#### **Node.js:** [${packageName}@${packageVersion}](${npmUrl})`
  });

  console.log(`Posted preview package comment on PR #${pr.number}`);
};
