const p = new (require("@prisma/client")).PrismaClient();
(async()=>{
  try {
    const user = await p.user.create({
      data: { email: "test@test.com", passwordHash: "abc:def", name: "Test", role: "OWNER" },
    });
    console.log("SUCCESS:", JSON.stringify(user, null, 2));
  } catch(e) {
    console.error("ERROR:", e.message, e.code, e.meta);
  }
  await p.$disconnect();
})()
