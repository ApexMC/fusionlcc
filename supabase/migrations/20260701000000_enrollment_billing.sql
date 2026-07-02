alter table public."Classes"
  add column if not exists program_type text,
  add column if not exists stripe_price_id text,
  add column if not exists billing_day integer;

update public."Classes"
set program_type = case
  when program_type is not null then program_type
  when lower(coalesce(type, '')) like '%cheer%' then 'competitive_cheer'
  when lower(coalesce(type, '')) like '%gym%' then 'gymnastics'
  else program_type
end;

update public."Classes"
set billing_day = case
  when billing_day in (1, 15) then billing_day
  when program_type = 'competitive_cheer' then 1
  when program_type = 'gymnastics' then 15
  else billing_day
end;

alter table public."Parents"
  add column if not exists stripe_customer_id text;

alter table public."Enrollments"
  add column if not exists created_at timestamptz not null default now(),
  add column if not exists stripe_customer_id text,
  add column if not exists stripe_subscription_id text,
  add column if not exists subscription_status text,
  add column if not exists current_period_start timestamptz,
  add column if not exists current_period_end timestamptz,
  add column if not exists payment_status text;

create index if not exists enrollments_status_idx
  on public."Enrollments" (status);

create index if not exists enrollments_athlete_id_idx
  on public."Enrollments" (athlete_id);

create index if not exists enrollments_stripe_subscription_id_idx
  on public."Enrollments" (stripe_subscription_id);

create index if not exists parents_stripe_customer_id_idx
  on public."Parents" (stripe_customer_id);

alter table public."Enrollments" enable row level security;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'Enrollments'
      and policyname = 'Admins can read all enrollments'
  ) then
    create policy "Admins can read all enrollments"
      on public."Enrollments"
      for select
      to authenticated
      using (
        exists (
          select 1
          from public.organization_members member
          where member.user_id = auth.uid()
            and member.role in ('owner', 'admin')
        )
      );
  end if;
end $$;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'Enrollments'
      and policyname = 'Admins can update enrollment statuses'
  ) then
    create policy "Admins can update enrollment statuses"
      on public."Enrollments"
      for update
      to authenticated
      using (
        exists (
          select 1
          from public.organization_members member
          where member.user_id = auth.uid()
            and member.role in ('owner', 'admin')
        )
      )
      with check (
        exists (
          select 1
          from public.organization_members member
          where member.user_id = auth.uid()
            and member.role in ('owner', 'admin')
        )
      );
  end if;
end $$;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'Enrollments'
      and policyname = 'Parents can read their athlete enrollments'
  ) then
    create policy "Parents can read their athlete enrollments"
      on public."Enrollments"
      for select
      to authenticated
      using (
        exists (
          select 1
          from public."Athletes" athlete
          left join public."Parents" parent
            on parent.parent_id = athlete.parent_id
          where athlete.athlete_id = "Enrollments".athlete_id
            and (
              athlete.user_id = auth.uid()
              or parent.user_id = auth.uid()
            )
        )
      );
  end if;
end $$;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'Enrollments'
      and policyname = 'Parents can request pending enrollments'
  ) then
    create policy "Parents can request pending enrollments"
      on public."Enrollments"
      for insert
      to authenticated
      with check (
        status = 'pending'
        and exists (
          select 1
          from public."Athletes" athlete
          left join public."Parents" parent
            on parent.parent_id = athlete.parent_id
          where athlete.athlete_id = "Enrollments".athlete_id
            and (
              athlete.user_id = auth.uid()
              or parent.user_id = auth.uid()
            )
        )
      );
  end if;
end $$;
