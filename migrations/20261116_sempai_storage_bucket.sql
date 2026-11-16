-- Ensure the public 'sempai' bucket exists for profile images.
-- EditProfileScreen uploads to profile-images/{wallet}-{timestamp}.{ext}
-- and stores the public URL in users.image.

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'sempai',
  'sempai',
  true,
  5242880,
  array['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'image/heic', 'image/heif']
)
on conflict (id) do update set public = true;

-- Authenticated users may upload/overwrite/read/delete objects in this bucket.
-- Public URLs (/object/public/sempai/...) are served without auth for public buckets.

drop policy if exists "sempai: authenticated inserts" on storage.objects;
create policy "sempai: authenticated inserts" on storage.objects
  for insert to authenticated
  with check (bucket_id = 'sempai');

drop policy if exists "sempai: authenticated updates" on storage.objects;
create policy "sempai: authenticated updates" on storage.objects
  for update to authenticated
  using (bucket_id = 'sempai')
  with check (bucket_id = 'sempai');

drop policy if exists "sempai: authenticated deletes" on storage.objects;
create policy "sempai: authenticated deletes" on storage.objects
  for delete to authenticated
  using (bucket_id = 'sempai');

drop policy if exists "sempai: authenticated selects" on storage.objects;
create policy "sempai: authenticated selects" on storage.objects
  for select to authenticated
  using (bucket_id = 'sempai');
