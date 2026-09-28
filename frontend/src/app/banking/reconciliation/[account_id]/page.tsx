"use client";

import React, { use } from "react";
import { BankReconciliationView } from "../ReconciliationView";

export default function AccountReconciliationRoute({
  params,
}: {
  params: Promise<{ account_id: string }>;
}) {
  const resolvedParams = use(params);
  const accountId = parseInt(resolvedParams.account_id, 10);

  return <BankReconciliationView initialAccountId={isNaN(accountId) ? undefined : accountId} />;
}
