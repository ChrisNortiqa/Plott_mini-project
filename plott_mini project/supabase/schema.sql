-- Plott schema for Supabase (PostgreSQL)
-- Run in Supabase SQL Editor. Supabase Auth stores the password securely.
create extension if not exists pgcrypto;

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text not null default '',
  email text not null unique,
  role text not null default 'Student' check (role in ('Admin','Teacher','Student')),
  theme text not null default 'light' check (theme in ('light','dark')),
  created_at timestamptz not null default now()
);
create table if not exists public.classes (
  id uuid primary key default gen_random_uuid(),
  course_name text not null,
  teacher_id uuid not null references public.profiles(id),
  teacher_name text not null default '',
  enrollment_code text not null unique,
  created_at timestamptz not null default now()
);
create table if not exists public.enrollments (
  class_id uuid not null references public.classes(id) on delete cascade,
  student_id uuid not null references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key(class_id,student_id)
);
create table if not exists public.assignments (
  id uuid primary key default gen_random_uuid(),
  class_id uuid not null references public.classes(id) on delete cascade,
  teacher_id uuid not null references public.profiles(id),
  title text not null,
  description text not null default '',
  max_points integer not null default 100 check(max_points>0),
  due_date timestamptz not null,
  completed_by uuid[] not null default '{}',
  created_at timestamptz not null default now()
);
create table if not exists public.submissions (
  id uuid primary key default gen_random_uuid(),
  assignment_id uuid not null references public.assignments(id) on delete cascade,
  student_id uuid not null references public.profiles(id) on delete cascade,
  submission_label text not null default '',
  submitted_at timestamptz not null default now(),
  grade_achieved numeric(7,2),
  feedback_text text not null default '',
  unique(assignment_id,student_id)
);
create table if not exists public.tasks (
  id uuid primary key default gen_random_uuid(),
  title text not null check(length(trim(title))>0),
  course_name text not null default '',
  priority text not null default 'Normal' check(priority in ('Low','Normal','High')),
  status text not null default 'To-Do' check(status in ('To-Do','In-Progress','Completed')),
  created_by uuid not null references public.profiles(id),
  assigned_by uuid references public.profiles(id),
  assigned_to uuid not null references public.profiles(id),
  due_date timestamptz,
  created_at timestamptz not null default now()
);
create table if not exists public.study_videos (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  url text not null,
  created_by uuid not null references public.profiles(id),
  created_at timestamptz not null default now()
);
create table if not exists public.system_logs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references public.profiles(id) on delete set null,
  action text not null,
  details text not null default '',
  created_at timestamptz not null default now()
);

create index if not exists tasks_assigned_to_idx on public.tasks(assigned_to,status);
create index if not exists assignments_due_date_idx on public.assignments(due_date);
create index if not exists submissions_assignment_idx on public.submissions(assignment_id);

-- Automatically create a Student profile when someone signs up with Supabase Auth.
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path=public
as $$
begin
  insert into public.profiles(id,full_name,email,role)
  values(new.id, coalesce(new.raw_user_meta_data->>'full_name',''), lower(new.email), 'Student')
  on conflict(id) do nothing;
  return new;
end;
$$;
drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created after insert on auth.users
for each row execute procedure public.handle_new_user();

create or replace function public.current_role()
returns text language sql stable security definer set search_path=public
as $$ select role from public.profiles where id=auth.uid() $$;
create or replace function public.is_teacher_or_admin()
returns boolean language sql stable security definer set search_path=public
as $$ select coalesce(public.current_role() in ('Teacher','Admin'),false) $$;

alter table public.profiles enable row level security;
alter table public.classes enable row level security;
alter table public.enrollments enable row level security;
alter table public.assignments enable row level security;
alter table public.submissions enable row level security;
alter table public.tasks enable row level security;
alter table public.study_videos enable row level security;
alter table public.system_logs enable row level security;

-- Profiles: users can see their own profile; admins can see/manage all profiles.
create policy "profiles own read" on public.profiles for select to authenticated using(id=auth.uid() or public.current_role()='Admin' or public.current_role()='Teacher');
create policy "profiles own update theme" on public.profiles for update to authenticated using(id=auth.uid()) with check(id=auth.uid() and role=(select p.role from public.profiles p where p.id=auth.uid()));
create policy "admin manage profiles" on public.profiles for all to authenticated using(public.current_role()='Admin') with check(public.current_role()='Admin');

-- Classes: teachers manage their own classes; students see classes they enrolled in or teachers' classes for code discovery is intentionally not broad.
create policy "classes read" on public.classes for select to authenticated using(teacher_id=auth.uid() or public.current_role()='Admin' or exists(select 1 from public.enrollments e where e.class_id=id and e.student_id=auth.uid()));
create policy "teacher create class" on public.classes for insert to authenticated with check(public.current_role() in ('Teacher','Admin') and teacher_id=auth.uid());
create policy "teacher edit own class" on public.classes for update to authenticated using(teacher_id=auth.uid() or public.current_role()='Admin') with check(teacher_id=auth.uid() or public.current_role()='Admin');
create policy "admin delete class" on public.classes for delete to authenticated using(public.current_role()='Admin');

create policy "enrollments read related" on public.enrollments for select to authenticated using(student_id=auth.uid() or public.current_role() in ('Teacher','Admin'));
create policy "student enroll self" on public.enrollments for insert to authenticated with check(student_id=auth.uid() and public.current_role()='Student');
create policy "admin enrollment manage" on public.enrollments for all to authenticated using(public.current_role()='Admin') with check(public.current_role()='Admin');

create policy "assignments read class members" on public.assignments for select to authenticated using(teacher_id=auth.uid() or public.current_role()='Admin' or exists(select 1 from public.enrollments e where e.class_id=class_id and e.student_id=auth.uid()));
create policy "teacher create assignment" on public.assignments for insert to authenticated with check(public.current_role() in ('Teacher','Admin') and teacher_id=auth.uid() and exists(select 1 from public.classes c where c.id=class_id and (c.teacher_id=auth.uid() or public.current_role()='Admin')));
create policy "teacher edit assignment" on public.assignments for update to authenticated using(teacher_id=auth.uid() or public.current_role()='Admin') with check(teacher_id=auth.uid() or public.current_role()='Admin');
create policy "teacher delete assignment" on public.assignments for delete to authenticated using(teacher_id=auth.uid() or public.current_role()='Admin');

create policy "submissions read own or teacher" on public.submissions for select to authenticated using(student_id=auth.uid() or public.current_role() in ('Teacher','Admin'));
create policy "student submit own" on public.submissions for insert to authenticated with check(student_id=auth.uid() and public.current_role()='Student' and exists(select 1 from public.assignments a join public.enrollments e on e.class_id=a.class_id where a.id=assignment_id and e.student_id=auth.uid()));
create policy "student update own submission" on public.submissions for update to authenticated using(student_id=auth.uid() or public.current_role() in ('Teacher','Admin')) with check(student_id=auth.uid() or public.current_role() in ('Teacher','Admin'));
create policy "teacher grade submissions" on public.submissions for update to authenticated using(public.current_role() in ('Teacher','Admin')) with check(public.current_role() in ('Teacher','Admin'));

-- Admins are deliberately denied task creation/completion. Teachers may assign tasks to students; students may manage their own personal tasks and update their assigned task status.
create policy "tasks read related" on public.tasks for select to authenticated using(assigned_to=auth.uid() or created_by=auth.uid() or assigned_by=auth.uid() or public.current_role()='Admin');
create policy "student create personal task" on public.tasks for insert to authenticated with check(public.current_role()='Student' and assigned_to=auth.uid() and created_by=auth.uid() and assigned_by is null);
create policy "teacher assign task" on public.tasks for insert to authenticated with check(public.current_role()='Teacher' and assigned_by=auth.uid() and created_by=auth.uid() and exists(select 1 from public.profiles p where p.id=assigned_to and p.role='Student'));
create policy "student update own task" on public.tasks for update to authenticated using(public.current_role()='Student' and assigned_to=auth.uid() and assigned_by is null) with check(public.current_role()='Student' and assigned_to=auth.uid() and assigned_by is null);
create policy "teacher update assigned task" on public.tasks for update to authenticated using(public.current_role()='Teacher' and assigned_by=auth.uid()) with check(public.current_role()='Teacher' and assigned_by=auth.uid());
create policy "task delete owner teacher" on public.tasks for delete to authenticated using((public.current_role()='Student' and assigned_to=auth.uid() and assigned_by is null) or (public.current_role()='Teacher' and assigned_by=auth.uid()));

create policy "videos read authenticated" on public.study_videos for select to authenticated using(true);
create policy "teacher manage videos" on public.study_videos for insert to authenticated with check(public.current_role() in ('Teacher','Admin') and created_by=auth.uid());
create policy "teacher delete videos" on public.study_videos for delete to authenticated using(created_by=auth.uid() or public.current_role()='Admin');

create policy "logs read admin" on public.system_logs for select to authenticated using(public.current_role()='Admin');
create policy "user create own log" on public.system_logs for insert to authenticated with check(user_id=auth.uid());
