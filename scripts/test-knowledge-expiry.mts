// Test roka veljavnosti in izklopa vnosov v bazi znanja.
// Dela na tenantu casino777 in za sabo pobriše vse, kar ustvari.
// Zagon: node --env-file=.env.local ... oz. z izvoženimi Supabase spremenljivkami:
//   npx tsx scripts/test-knowledge-expiry.mts
import { createClient } from "@supabase/supabase-js";

const { insertPending, decideEntry, setEntryActive, getActiveKnowledgeSection, invalidateActiveCache, isExpired } =
  await import("../src/lib/knowledge.ts");
const { endOfDayInSupportZone } = await import("../src/lib/support-hours.ts");

let failures = 0;
function check(name: string, actual: unknown, expected: unknown) {
  const ok = actual === expected;
  if (!ok) failures++;
  console.log(`${ok ? "OK  " : "FAIL"} ${name}${ok ? "" : `\n     dobil:      ${actual}\n     pricakoval: ${expected}`}`);
}

// --- konec dneva v slovenskem casu, poletje in zima -------------------------
check("poletni cas (CEST, +02)", endOfDayInSupportZone("2026-08-20"), "2026-08-20T21:59:59.999Z");
check("zimski cas (CET, +01)", endOfDayInSupportZone("2026-12-24"), "2026-12-24T22:59:59.999Z");
check("prazen vnos", endOfDayInSupportZone(""), null);
check("napacna oblika", endOfDayInSupportZone("20.8.2026"), null);

// --- isExpired --------------------------------------------------------------
const base = { id: "x", tenant: "casino777", type: "promocija", title: "t", body: "b",
  special_instructions: null, raw_input: null, status: "active", submitted_by: null,
  created_at: "2026-08-01T00:00:00Z", decided_at: null, decided_by: null } as const;
check("brez roka ni poteklo", isExpired({ ...base, expires_at: null }), false);
check("rok v prihodnosti", isExpired({ ...base, expires_at: "2030-01-01T00:00:00Z" }), false);
check("rok v preteklosti", isExpired({ ...base, expires_at: "2020-01-01T00:00:00Z" }), true);

// --- pot skozi bazo ---------------------------------------------------------
const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !key) {
  console.log("\n(preskakujem test baze: manjkata NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY)");
} else {
  const supabase = createClient(url, key);
  const created: string[] = [];
  const mark = `TEST-EXPIRY-${Date.now()}`;

  try {
    const past = await insertPending(
      { tenant: "casino777", type: "promocija", title: `${mark}-poteklo`, rawInput: "x",
        expiresAt: "2020-01-01T00:00:00.000Z" },
      { title: `${mark}-poteklo`, body: `${mark} poteklo besedilo` }
    );
    created.push(past.id);
    const live = await insertPending(
      { tenant: "casino777", type: "promocija", title: `${mark}-zivo`, rawInput: "x",
        expiresAt: "2030-01-01T00:00:00.000Z" },
      { title: `${mark}-zivo`, body: `${mark} zivo besedilo` }
    );
    created.push(live.id);

    check("rok se shrani", past.expires_at, "2020-01-01T00:00:00+00:00");

    await decideEntry(past.id, "active", "test");
    await decideEntry(live.id, "active", "test");
    invalidateActiveCache();

    let section = await getActiveKnowledgeSection("casino777");
    check("potekli vnos ni v promptu", section.includes(`${mark} poteklo besedilo`), false);
    check("veljaven vnos je v promptu", section.includes(`${mark} zivo besedilo`), true);

    const off = await setEntryActive(live.id, false, "test");
    check("izklop premakne v inactive", off?.status, "inactive");
    section = await getActiveKnowledgeSection("casino777");
    check("izklopljen vnos ni v promptu", section.includes(`${mark} zivo besedilo`), false);

    const on = await setEntryActive(live.id, true, "test");
    check("vklop nazaj v active", on?.status, "active");
    section = await getActiveKnowledgeSection("casino777");
    check("vklopljen vnos spet v promptu", section.includes(`${mark} zivo besedilo`), true);

    const nope = await setEntryActive(past.id, true, "test");
    check("vklop ze aktivnega ne naredi nic", nope, null);
  } finally {
    if (created.length) {
      await supabase.from("bot_knowledge").delete().in("id", created);
      console.log(`     (pociscenih testnih vnosov: ${created.length})`);
    }
    invalidateActiveCache();
  }
}

console.log(failures === 0 ? "\nVSI TESTI OK" : `\n${failures} NEUSPESNIH`);
process.exit(failures === 0 ? 0 : 1);
