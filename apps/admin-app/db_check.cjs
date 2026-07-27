const p = new (require("@prisma/client")).PrismaClient();
(async()=>{
  const tables = await p.$queryRawUnsafe("SELECT table_name FROM information_schema.tables WHERE table_schema='public' AND table_type='BASE TABLE' AND table_name!='_prisma_migrations' ORDER BY table_name");
  console.log("=== ALL TABLES (" + tables.length + " total) ===");
  console.log(tables.map(t=>t.table_name).join(", "));

  const counts = await p.$queryRawUnsafe(`
    SELECT table_name, (SELECT reltuples::int FROM pg_class WHERE oid = (quote_ident(table_name)::regclass)) AS rows
    FROM information_schema.tables
    WHERE table_schema='public' AND table_type='BASE TABLE' AND table_name!='_prisma_migrations'
    ORDER BY rows DESC
  `);
  console.log("\n=== TABLES WITH DATA (top 10) ===");
  for (const t of counts.filter(c=>c.rows>0).slice(0,10))
    console.log("  " + t.table_name + " -> " + t.rows + " rows");

  const users = await p.$queryRawUnsafe("SELECT id::text, email, name, role, org_id::text FROM public.users LIMIT 5");
  console.log("\n=== USERS (" + users.length + ") ===");
  for (const u of users) console.log("  " + u.email + " | role=" + u.role + " | org=" + u.org_id);

  const orgs = await p.$queryRawUnsafe("SELECT id::text, name, slug FROM public.organizations LIMIT 5");
  console.log("\n=== ORGANIZATIONS (" + orgs.length + ") ===");
  for (const o of orgs) console.log("  " + o.name + " | slug=" + o.slug);

  const admins = await p.$queryRawUnsafe("SELECT id::text, email, first_name, last_name FROM public.admins LIMIT 5");
  console.log("\n=== ADMINS (" + admins.length + ") ===");
  for (const a of admins) console.log("  " + a.email + " | name=" + a.first_name + " " + (a.last_name||""));

  const adminUsers = await p.$queryRawUnsafe("SELECT id::text, email, name FROM public.admin_users LIMIT 5");
  console.log("\n=== ADMIN_USERS (" + adminUsers.length + ") ===");
  for (const a of adminUsers) console.log("  " + a.email);

  await p.$disconnect();
})()
