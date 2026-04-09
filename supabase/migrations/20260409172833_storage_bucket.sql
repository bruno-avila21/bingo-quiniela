insert into storage.buckets (id, name, public)
values ('comprobantes', 'comprobantes', false);

create policy "admin_read_comprobantes" on storage.objects
  for select using (
    bucket_id = 'comprobantes'
    and auth.jwt()->>'role' = 'admin'
  );
