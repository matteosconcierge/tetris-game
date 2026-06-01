// InstantDB permissions for the Bruno Invito game
// See: https://www.instantdb.com/docs/permissions

import type { InstantRules } from '@instantdb/core';

const rules: InstantRules = {
  /**
   * Anyone (Bruno, Matteo, anyone with the link) can create a new selection.
   * We restrict creation to valid fields so people can't inject arbitrary data.
   */
  selections: {
    allow: {
      create: 'true',
      view: 'true',
      update: 'false',
      delete: 'false',
    },
  },
  $users: {
    allow: {
      view: 'true',
    },
  },
};

export default rules;
