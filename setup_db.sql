-- Enable UUID extension
create extension if not exists "uuid-ossp";

-- Create 'outlet' table
create table outlet (
  id uuid primary key default uuid_generate_v4(),
  nama_outlet text not null,
  alamat text not null,
  latitude float not null,
  longitude float not null,
  no_telpon text,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- Create 'pengantaran' table
create table pengantaran (
  id uuid primary key default uuid_generate_v4(),
  tanggal date not null default CURRENT_DATE,
  nama_kurir text not null,
  no_faktur text not null,
  outlet_id uuid references outlet(id),
  jarak_km float,
  status text not null default 'Pending', -- Pending, Dikirim, Selesai
  catatan text,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- Enable Row Level Security (RLS) - Optional for Public API MVP, but good practice
alter table outlet enable row level security;
alter table pengantaran enable row level security;

-- Create policies to allow public read/write (since we are using Anon Key for everything as per request)
-- WARNING: In a real production app, restrict Writes to authenticated users.
create policy "Allow public read access to outlet" on outlet for select using (true);
create policy "Allow public insert to outlet" on outlet for insert with check (true);

create policy "Allow public read access to pengantaran" on pengantaran for select using (true);
create policy "Allow public insert to pengantaran" on pengantaran for insert with check (true);
create policy "Allow public update to pengantaran" on pengantaran for update using (true);

-- Insert Dummy Data for Outlets
insert into outlet (nama_outlet, alamat, latitude, longitude, no_telpon) values
('Outlet Pusat', 'Jl. Jendral Sudirman No. 1, Jakarta', -6.2088, 106.8456, '081234567890'),
('Outlet Cabang Barat', 'Jl. Merdeka Barat No. 10, Jakarta', -6.1754, 106.8272, '089876543210'),
('Outlet Cabang Selatan', 'Jl. Fatmawati No. 5, Jakarta', -6.2924, 106.7978, '081122334455');
