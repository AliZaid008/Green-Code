-- الصق هذا كاملاً في Supabase: SQL Editor ثم اضغط Run (مرة واحدة فقط)
create table if not exists points(
  id text primary key, title text, title_en text, type text, gov text, lat double precision, lng double precision,
  "desc" text, desc_en text, solution text, solution_en text, source text, kind text, approx boolean default false,
  photos jsonb default '[]'::jsonb, created_at text, status text default 'active', removed_at text, removed_note text, removed_note_en text);
create table if not exists pending(
  id text primary key, name text, phone text, email text, type text, gov text, lat double precision, lng double precision,
  "desc" text, photos jsonb default '[]'::jsonb, date text);
create table if not exists meta(k text primary key, v text);
-- v15: الحسابات والرتب (آمن إعادة تشغيله على قاعدة قديمة)
alter table points add column if not exists reporter_id text;
alter table pending add column if not exists user_id text;
alter table pending add column if not exists rank_lv integer default 0;
create table if not exists users(
  id text primary key, email text unique, name text, phone text, pass text, public integer default 1,
  approved integer default 0, rejected integer default 0, banned integer default 0, sv integer default 0, created_at text, last_login text);
create table if not exists user_reports(
  id text primary key, user_id text, type text, gov text, "desc" text, status text, created_at text, decided_at text, point_id text, note text);
create index if not exists idx_ur_user on user_reports(user_id, created_at);
create table if not exists confirms(point_id text, user_id text, created_at text, primary key(point_id, user_id));
create index if not exists idx_conf_user on confirms(user_id);
create table if not exists audit(id text primary key, at text, actor text, action text, target text, detail text);
create index if not exists idx_audit_at on audit(at);
alter table audit enable row level security;
create index if not exists idx_points_reporter on points(reporter_id);
alter table users enable row level security;
alter table user_reports enable row level security;
alter table confirms enable row level security;
-- حماية: لا أحد يقرأ الجداول مباشرة (السيرفر فقط يستخدم المفتاح السري)
alter table points enable row level security;
alter table pending enable row level security;
alter table meta enable row level security;
-- مخزن الصور (عام للقراءة)
insert into storage.buckets (id, name, public) values ('photos', 'photos', true) on conflict (id) do nothing;
