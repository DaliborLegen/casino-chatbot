import { redirect } from "next/navigation";

// chat-bot.bet no longer serves a public site — the domain is the admin
// dashboard. The demo replica that used to live here was removed on client
// request (2026-07-21); the ChatWidget component remains for embedding.
export default function Home() {
  redirect("/admin");
}
