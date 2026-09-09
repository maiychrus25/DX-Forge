// SPDX-License-Identifier: AGPL-3.0-or-later
import { SurveyForm } from "@/components/SurveyForm";

export default async function SurveyPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  return <SurveyForm token={token} />;
}
