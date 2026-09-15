import { convertIcon, listIconNames, listSets } from '../../.vitepress/lib/icons';

export default {
  paths() {
    return listSets().flatMap((set) =>
      listIconNames(set).map((name) => ({ params: { ...convertIcon(set, name, {}), set: set.name, name } })),
    );
  },
};
