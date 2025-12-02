module.exports = async ({ github, context, core }) => {
  const { owner, repo } = context.repo;

  const version = process.env.NEWEST_VERSION;
  const branchName = `preview/v${version}`;
  const title = `New version ${version}`;
  const body = "";

  const pr = await github.rest.pulls.create({
    owner,
    repo,
    head: branchName,
    base: "main",
    title,
    body,
  });

  core.info(`PR criado: #${pr.data.number}`);
};