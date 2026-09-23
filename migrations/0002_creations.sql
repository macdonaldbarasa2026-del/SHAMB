create table if not exists creations (
  id text primary key,
  user_id text not null,
  kind text not null,
  prompt text not null,
  src text not null,
  aspect_ratio text not null,
  resolution text not null,
  created_at bigint not null
);

create index if not exists creations_user_id_idx on creations (user_id);
create index if not exists creations_user_created_idx on creations (user_id, created_at desc);
