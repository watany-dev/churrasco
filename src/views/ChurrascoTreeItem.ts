import { TreeItem, TreeItemCollapsibleState } from 'vscode';
import type { SidebarNode } from './buildSidebarSections';

export class ChurrascoTreeItem extends TreeItem {
  readonly node: SidebarNode;
  readonly children: readonly SidebarNode[];

  constructor(node: SidebarNode) {
    super(
      node.label,
      node.kind === 'section' ? TreeItemCollapsibleState.Expanded : TreeItemCollapsibleState.None,
    );
    this.node = node;
    this.children = node.kind === 'section' ? node.children : [];
    if (node.kind === 'leaf' && node.description !== undefined) {
      this.description = node.description;
    }
  }
}
