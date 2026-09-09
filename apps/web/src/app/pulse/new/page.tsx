// SPDX-License-Identifier: AGPL-3.0-or-later
import { getDb } from "@/lib/db";
import * as repo from "@/lib/repo";
import { OrgForm } from "./OrgForm";

export const dynamic = "force-dynamic";

export default function NewRoundPage() {
  const org = repo.getOrganization(getDb());
  return <OrgForm initial={org} />;
}
