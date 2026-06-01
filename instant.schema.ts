// InstantDB schema for the Bruno Invito game
// See: https://www.instantdb.com/docs/schema

import { i } from '@instantdb/core';

const schema = i.schema({
  entities: {
    $users: i.entity({
      email: i.string().unique().indexed(),
    }),
    selections: i.entity({
      friendName: i.string().indexed(),
      drink: i.string(),
      day: i.string(),
      time: i.string(),
      score: i.number(),
      pearls: i.number(),
      createdAt: i.number().indexed(),
    }),
  },
  links: {},
  rooms: {},
});

export default schema;
