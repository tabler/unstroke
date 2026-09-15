import { defineLoader } from 'vitepress';
import { convertIcon, listIconNames, listSets, type IconEntry } from '../.vitepress/lib/icons';

export interface IconGroup { set: string; icons: IconEntry[] }
declare const data: IconGroup[];
export { data };

/** Every demo icon is converted at build time with the current state of ../lib. */
export default defineLoader({
  load(): IconGroup[] {
    return listSets().map((set) => ({
      set: set.name,
      icons: listIconNames(set).map((n) => convertIcon(set, n, {})),
    })).filter((g) => g.icons.length > 0);
  },
});
