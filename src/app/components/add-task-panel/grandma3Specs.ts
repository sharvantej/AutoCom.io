export type GrandMA3FieldSpec = {
  key: string;
  label: string;
  type: 'text' | 'select';
  options?: string[];
  placeholder?: string;
  defaultValue?: string;
};
export type GrandMA3FunctionSpec = {
  definitionId: string;
  fields: GrandMA3FieldSpec[];
  toOptions: (values: Record<string, string>) => Record<string, unknown>;
  buildCommand: (values: Record<string, string>) => string;
  summary: (values: Record<string, string>) => string;
};
export const GRANDMA3_AT_MENU_ITEMS: string[] = [
  'At Full',
  'At Zero',
  'At Default',
  'Cut Programmer',
  'At Normal',
  'Copy Programmer',
  'On Selection',
  'Paste Programmer',
  'Off Selection',
  'At Release',
  'Delete Programmer',
  'At Remove',
];
export const GRANDMA3_EXEC_BUTTON_STATE_OPTIONS: string[] = ['push', 'release'];
export const GRANDMA3_CURRENT_PAGE_OPTIONS: string[] = ['false', 'true'];
export function quoteGrandMA3Token(value: string): string {
  const escaped = value.replace(/"/g, '\\"');
  return `"${escaped}"`;
}
export const GRANDMA3_FUNCTION_SPECS: Record<string, GrandMA3FunctionSpec> = {
  'At Menu': {
    definitionId: 'atmenu',
    fields: [
      {
        key: 'menuItem',
        label: 'At Menu Item',
        type: 'select',
        options: GRANDMA3_AT_MENU_ITEMS,
        defaultValue: 'At Full',
      },
    ],
    toOptions: (values) => ({ atmenu: values.menuItem ?? '' }),
    buildCommand: (values) => {
      const menuItem = (values.menuItem ?? '').trim();
      return menuItem ? menuItem : '';
    },
    summary: (values) => (values.menuItem ?? '').trim(),
  },
  'Call Macro via name': {
    definitionId: 'macro_name',
    fields: [
      {
        key: 'name',
        label: 'Macro Name',
        type: 'text',
        placeholder: 'Macro Name',
      },
    ],
    toOptions: (values) => ({ macro: values.name ?? '' }),
    buildCommand: (values) => {
      const name = (values.name ?? '').trim();
      return name ? `Macro ${quoteGrandMA3Token(name)}` : '';
    },
    summary: (values) => (values.name ?? '').trim(),
  },
  'Call Macro via number': {
    definitionId: 'macro',
    fields: [
      { key: 'number', label: 'Macro Number', type: 'text', placeholder: '1' },
    ],
    toOptions: (values) => ({
      macro: Number.parseInt(values.number ?? '', 10) || 0,
    }),
    buildCommand: (values) => {
      const number = (values.number ?? '').trim();
      return number ? `Macro ${number}` : '';
    },
    summary: (values) => (values.number ?? '').trim(),
  },
  'Call Plugin via name': {
    definitionId: 'plugin_name',
    fields: [
      {
        key: 'name',
        label: 'Plugin Name',
        type: 'text',
        placeholder: 'Plugin Name',
      },
    ],
    toOptions: (values) => ({ plugin: values.name ?? '' }),
    buildCommand: (values) => {
      const name = (values.name ?? '').trim();
      return name ? `Plugin ${quoteGrandMA3Token(name)}` : '';
    },
    summary: (values) => (values.name ?? '').trim(),
  },
  'Call Plugin via number': {
    definitionId: 'plugin',
    fields: [
      { key: 'number', label: 'Plugin Number', type: 'text', placeholder: '1' },
    ],
    toOptions: (values) => ({
      plugin: Number.parseInt(values.number ?? '', 10) || 0,
    }),
    buildCommand: (values) => {
      const number = (values.number ?? '').trim();
      return number ? `Plugin ${number}` : '';
    },
    summary: (values) => (values.number ?? '').trim(),
  },
  'Executor Button': {
    definitionId: 'exec_button',
    fields: [
      {
        key: 'page',
        label: 'Page',
        type: 'text',
        placeholder: '1',
        defaultValue: '1',
      },
      {
        key: 'current_page',
        label: 'Current Page',
        type: 'select',
        options: GRANDMA3_CURRENT_PAGE_OPTIONS,
        defaultValue: 'false',
      },
      {
        key: 'button_number',
        label: 'Button Number',
        type: 'text',
        placeholder: '201',
        defaultValue: '201',
      },
      {
        key: 'button_state',
        label: 'Button State',
        type: 'select',
        options: GRANDMA3_EXEC_BUTTON_STATE_OPTIONS,
        defaultValue: 'push',
      },
    ],
    toOptions: (values) => ({
      page: Number.parseInt(values.page ?? '', 10) || 1,
      current_page: (values.current_page ?? 'false') === 'true',
      button_number: Number.parseInt(values.button_number ?? '', 10) || 0,
      button_state: values.button_state ?? 'push',
    }),
    buildCommand: (values) => {
      const page = (values.page ?? '1').trim();
      const currentPage = (values.current_page ?? 'false') === 'true';
      const button = (values.button_number ?? '').trim();
      const state = (values.button_state ?? 'push').trim();
      if (!button) return '';
      return currentPage
        ? `ExecutorButton ${button} ${state}`
        : `Page ${page}; ExecutorButton ${button} ${state}`;
    },
    summary: (values) => {
      const page = (values.page ?? '1').trim();
      const currentPage = (values.current_page ?? 'false') === 'true';
      const button = (values.button_number ?? '').trim();
      const state = (values.button_state ?? 'push').trim();
      return currentPage
        ? `Current Page, Button ${button}, ${state}`
        : `Page ${page}, Button ${button}, ${state}`;
    },
  },
  'Run Command': {
    definitionId: 'command',
    fields: [
      {
        key: 'command',
        label: 'Command',
        type: 'text',
        placeholder: 'Go+ Sequence 1 Cue 1',
      },
    ],
    toOptions: (values) => ({ command: values.command ?? '' }),
    buildCommand: (values) => (values.command ?? '').trim(),
    summary: (values) => (values.command ?? '').trim(),
  },
  'Select Group via name': {
    definitionId: 'group_name',
    fields: [
      {
        key: 'name',
        label: 'Group Name',
        type: 'text',
        placeholder: 'Group Name',
      },
    ],
    toOptions: (values) => ({ group: values.name ?? '' }),
    buildCommand: (values) => {
      const name = (values.name ?? '').trim();
      return name ? `Group ${quoteGrandMA3Token(name)}` : '';
    },
    summary: (values) => (values.name ?? '').trim(),
  },
  'Select Group via number': {
    definitionId: 'group',
    fields: [
      { key: 'number', label: 'Group Number', type: 'text', placeholder: '1' },
    ],
    toOptions: (values) => ({
      group: Number.parseInt(values.number ?? '', 10) || 0,
    }),
    buildCommand: (values) => {
      const number = (values.number ?? '').trim();
      return number ? `Group ${number}` : '';
    },
    summary: (values) => (values.number ?? '').trim(),
  },
  'Select MAtrick via name': {
    definitionId: 'matrick_name',
    fields: [
      {
        key: 'name',
        label: 'MAtricks Name',
        type: 'text',
        placeholder: 'MAtricks Name',
      },
    ],
    toOptions: (values) => ({ matrick: values.name ?? '' }),
    buildCommand: (values) => {
      const name = (values.name ?? '').trim();
      return name ? `MAtricks ${quoteGrandMA3Token(name)}` : '';
    },
    summary: (values) => (values.name ?? '').trim(),
  },
  'Select MAtrick via number': {
    definitionId: 'matrick',
    fields: [
      {
        key: 'number',
        label: 'MAtricks Number',
        type: 'text',
        placeholder: '1',
      },
    ],
    toOptions: (values) => ({
      matrick: Number.parseInt(values.number ?? '', 10) || 0,
    }),
    buildCommand: (values) => {
      const number = (values.number ?? '').trim();
      return number ? `MAtricks ${number}` : '';
    },
    summary: (values) => (values.number ?? '').trim(),
  },
  'Select Quickey via name': {
    definitionId: 'quickey_name',
    fields: [
      {
        key: 'name',
        label: 'Quickey Name',
        type: 'text',
        placeholder: 'Quickey Name',
      },
    ],
    toOptions: (values) => ({ quickey: values.name ?? '' }),
    buildCommand: (values) => {
      const name = (values.name ?? '').trim();
      return name ? `Quickey ${quoteGrandMA3Token(name)}` : '';
    },
    summary: (values) => (values.name ?? '').trim(),
  },
  'Select Quickey via number': {
    definitionId: 'quickey',
    fields: [
      {
        key: 'number',
        label: 'Quickey Number',
        type: 'text',
        placeholder: '1',
      },
    ],
    toOptions: (values) => ({
      quickey: Number.parseInt(values.number ?? '', 10) || 0,
    }),
    buildCommand: (values) => {
      const number = (values.number ?? '').trim();
      return number ? `Quickey ${number}` : '';
    },
    summary: (values) => (values.number ?? '').trim(),
  },
  'Select Sequence via name': {
    definitionId: 'sequence_name',
    fields: [
      {
        key: 'name',
        label: 'Sequence Name',
        type: 'text',
        placeholder: 'Sequence Name',
      },
    ],
    toOptions: (values) => ({ sequence: values.name ?? '' }),
    buildCommand: (values) => {
      const name = (values.name ?? '').trim();
      return name ? `Sequence ${quoteGrandMA3Token(name)}` : '';
    },
    summary: (values) => (values.name ?? '').trim(),
  },
  'Select Sequence via number': {
    definitionId: 'sequence',
    fields: [
      {
        key: 'number',
        label: 'Sequence Number',
        type: 'text',
        placeholder: '1',
      },
    ],
    toOptions: (values) => ({
      sequence: Number.parseInt(values.number ?? '', 10) || 0,
    }),
    buildCommand: (values) => {
      const number = (values.number ?? '').trim();
      return number ? `Sequence ${number}` : '';
    },
    summary: (values) => (values.number ?? '').trim(),
  },
};
