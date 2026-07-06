import { redirect } from "next/navigation";

// The funds list lives on /catalog (screener). This legacy route redirects there.
export default function FundsRedirect() {
  redirect("/catalog");
}
