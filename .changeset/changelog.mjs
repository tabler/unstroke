// Changelog lines as `- [`abc1234`](commit url) - summary`, without the
// "Thanks @user!" part that @changesets/changelog-github adds.

/** @type {import('@changesets/types').ChangelogFunctions} */
const changelog = {
  async getReleaseLine(changeset, _type, options) {
    const repo = options?.repo;
    const [first = '', ...rest] = changeset.summary.trim().split('\n');
    const link = changeset.commit
      ? repo
        ? `[\`${changeset.commit.slice(0, 7)}\`](https://github.com/${repo}/commit/${changeset.commit}) - `
        : `\`${changeset.commit.slice(0, 7)}\` - `
      : '';
    const body = rest.length ? `\n${rest.map((l) => `  ${l}`).join('\n')}` : '';
    return `\n\n- ${link}${first}${body}`;
  },

  async getDependencyReleaseLine(changesets, dependencies, options) {
    if (dependencies.length === 0) return '';
    const repo = options?.repo;
    const commits = changesets
      .map((cs) => cs.commit)
      .filter((c) => c != null)
      .map((c) => (repo ? `[\`${c.slice(0, 7)}\`](https://github.com/${repo}/commit/${c})` : `\`${c.slice(0, 7)}\``));
    const head = commits.length ? `- Updated dependencies [${commits.join(', ')}]:` : '- Updated dependencies:';
    return [head, ...dependencies.map((d) => `  - ${d.name}@${d.newVersion}`)].join('\n');
  },
};

export default changelog;
