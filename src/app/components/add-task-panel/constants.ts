import { APP_THEME_PALETTE } from '../../styles/palette';

export const WAIT_CONNECTION_VALUE = '__wait__';
export const WAIT_FUNC_NAME = 'Wait';
export const P = APP_THEME_PALETTE;
export type Swp08NameOption = { value: string; label: string };
export type VideohubNameOption = { value: string; label: string };
export const SWP08_NAMES_CACHE = new Map<
  string,
  {
    sourceOptions: Swp08NameOption[];
    destinationOptions: Swp08NameOption[];
    fetchedAt: number;
  }
>();
export const VIDEOHUB_NAMES_CACHE = new Map<
  string,
  {
    sourceOptions: VideohubNameOption[];
    destinationOptions: VideohubNameOption[];
    fetchedAt: number;
  }
>();
