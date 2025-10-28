-- Local-dev no-op: status enum/text normalization is skipped
begin;
  -- intentionally left blank to avoid enum coercion issues in local containers
commit;
